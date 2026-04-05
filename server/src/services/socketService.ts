import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { query, queryOne, queryAll } from '../db';
import { streamChat, parseToolName, buildToolsForSession } from './llmService';
import { JwtPayload } from '../middleware/auth';

// Track active generations for cancellation
const activeGenerations = new Map<string, AbortController>();

// Track tool call pending results
const pendingToolCalls = new Map<string, {
  resolve: (result: unknown) => void;
  reject: (err: Error) => void;
  timeout: NodeJS.Timeout;
}>();

export function initializeSocketService(io: SocketIOServer): void {
  // JWT authentication middleware for Socket.io
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
      (socket as any).user = decoded;
      next();
    } catch (err) {
      return next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user as JwtPayload;
    console.log(`[Socket.io] Authenticated client connected: ${socket.id} (user: ${user.email})`);

    // Join user to their own room for targeted messages
    socket.join(`user:${user.userId}`);

    // --- Chat message handler ---
    socket.on('chat:message', async (data: {
      sessionId: string;
      content: string;
    }) => {
      console.log(`[Socket.io] chat:message received:`, JSON.stringify(data));
      const { sessionId, content } = data;

      if (!sessionId || !content) {
        console.log(`[Socket.io] Missing sessionId or content`);
        socket.emit('chat:error', { message: 'sessionId and content are required' });
        return;
      }

      // Verify session ownership
      const session = await queryOne<any>(
        'SELECT * FROM sessions WHERE id = $1 AND user_id = $2',
        [sessionId, user.userId]
      );

      if (!session) {
        console.log(`[Socket.io] Session not found: ${sessionId} for user ${user.userId}`);
        socket.emit('chat:error', { message: 'Session not found or access denied' });
        return;
      }

      // Save user message to DB
      const userMsgId = uuidv4();
      const now = new Date().toISOString();
      await query(
        'INSERT INTO messages (id, session_id, role, content, created_at) VALUES ($1, $2, $3, $4, $5)',
        [userMsgId, sessionId, 'user', content, now]
      );

      await query('UPDATE sessions SET updated_at = $1 WHERE id = $2', [now, sessionId]);

      // Load conversation history for context
      const historyRows = await queryAll<{ role: string; content: string; metadata: string | null }>(
        'SELECT role, content, metadata FROM messages WHERE session_id = $1 ORDER BY created_at ASC',
        [sessionId]
      );

      // Convert to message format, keeping last 50 messages for context
      // Filter out empty content (from tool calls, etc.) — Anthropic API rejects empty text blocks
      const messages = historyRows
        .filter(row => row.content && row.content.trim().length > 0 && row.role !== 'system')
        .slice(-50)
        .map(row => ({
          role: row.role as 'user' | 'assistant',
          content: row.content,
        }));

      // Create AbortController for cancellation
      const abortController = new AbortController();
      const generationId = `${sessionId}:${Date.now()}`;
      activeGenerations.set(generationId, abortController);

      // Tell client we're starting
      socket.emit('chat:stream:start', { sessionId, generationId });

      const assistantMsgId = uuidv4();
      let fullResponse = '';

      console.log(`[Socket.io] Sending ${messages.length} messages to LLM`);

      await streamChat({
        messages,
        sessionId,
        signal: abortController.signal,
        onToken: (token) => {
          fullResponse += token;
          socket.emit('chat:stream', { sessionId, token, generationId });
        },
        onToolCall: (toolCallId, toolName, args) => {
          const parsed = parseToolName(toolName);
          if (parsed) {
            console.log(`[Socket.io] Emitting plugin:invoke for ${parsed.pluginId}/${parsed.toolName}`);
            socket.emit('plugin:invoke', {
              toolCallId,
              pluginId: parsed.pluginId,
              toolName: parsed.toolName,
              parameters: args,
              sessionId,
            });
          }
        },
        onFinish: async (text, usage) => {
          // Only save assistant message if it has content
          const finishTime = new Date().toISOString();
          if (text && text.trim().length > 0) {
            await query(
              'INSERT INTO messages (id, session_id, role, content, metadata, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
              [
                assistantMsgId,
                sessionId,
                'assistant',
                text,
                JSON.stringify({ usage }),
                finishTime
              ]
            );
          }

          await query('UPDATE sessions SET updated_at = $1 WHERE id = $2', [finishTime, sessionId]);

          socket.emit('chat:stream:end', {
            sessionId,
            generationId,
            messageId: assistantMsgId,
            usage,
          });

          activeGenerations.delete(generationId);
        },
        onError: (error) => {
          console.error('[Socket.io] LLM error:', error.message, error.stack?.slice(0, 200));
          socket.emit('chat:error', {
            sessionId,
            generationId,
            message: 'Failed to generate response. Please try again.',
          });
          activeGenerations.delete(generationId);
        },
      });
    });

    // --- Cancel generation ---
    socket.on('chat:cancel', (data: { generationId: string }) => {
      const controller = activeGenerations.get(data.generationId);
      if (controller) {
        controller.abort();
        activeGenerations.delete(data.generationId);
        socket.emit('chat:cancelled', { generationId: data.generationId });
      }
    });

    // --- Plugin tool result from frontend ---
    socket.on('plugin:result', (data: {
      toolCallId: string;
      result: unknown;
    }) => {
      const pending = pendingToolCalls.get(data.toolCallId);
      if (pending) {
        clearTimeout(pending.timeout);
        pending.resolve(data.result);
        pendingToolCalls.delete(data.toolCallId);
      }
    });

    // --- Plugin completion from frontend ---
    socket.on('plugin:complete', async (data: {
      sessionId: string;
      pluginId: string;
      instanceId: string;
      event: string;
      completionData: Record<string, unknown>;
      summary: string;
    }) => {
      const now = new Date().toISOString();

      // Update plugin instance status
      await query(`
        UPDATE plugin_instances SET status = 'completed', completion_data = $1, updated_at = $2
        WHERE id = $3 AND session_id = $4
      `, [JSON.stringify(data.completionData), now, data.instanceId, data.sessionId]);

      // Inject completion context as system message
      const contextMsg = `[Plugin Completion] ${data.pluginId}: ${data.summary}`;
      await query(
        'INSERT INTO messages (id, session_id, role, content, metadata, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          uuidv4(),
          data.sessionId,
          'system',
          contextMsg,
          JSON.stringify({ pluginId: data.pluginId, event: data.event, completionData: data.completionData }),
          now
        ]
      );

      console.log(`[Socket.io] Plugin completed: ${data.pluginId} in session ${data.sessionId}`);
    });

    // --- Plugin state update from frontend ---
    socket.on('plugin:state', async (data: {
      sessionId: string;
      pluginId: string;
      instanceId: string;
      state: Record<string, unknown>;
      summary?: string;
    }) => {
      const now = new Date().toISOString();

      await query(`
        UPDATE plugin_instances SET state = $1, updated_at = $2
        WHERE id = $3 AND session_id = $4
      `, [JSON.stringify(data.state), now, data.instanceId, data.sessionId]);
    });

    // --- Disconnect ---
    socket.on('disconnect', (reason) => {
      console.log(`[Socket.io] Client disconnected: ${socket.id} (${reason})`);
      // Clean up any active generations for this socket
      // (In production, would track socket->generationId mapping)
    });
  });
}
