import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { query, queryOne, queryAll } from '../db';
import { streamChat, parseToolName, buildToolsForSession, ToolExecutor } from './llmService';
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
      const toolInteractions: Array<{ tool: string; args: Record<string, unknown>; result: string }> = [];

      console.log(`[Socket.io] Sending ${messages.length} messages to LLM`);

      // Tool executor: sends tool calls to the frontend plugin and waits for results
      const toolExecutor: ToolExecutor = (pluginId, toolName, args) => {
        return new Promise<string>((resolve, reject) => {
          const toolCallId = uuidv4();

          // Tell the frontend we're waiting for a tool result
          socket.emit('chat:tool:executing', { sessionId, generationId, pluginId, toolName });

          const timeout = setTimeout(() => {
            pendingToolCalls.delete(toolCallId);
            console.log(`[Socket.io] Tool call timed out: ${pluginId}/${toolName}`);
            const errResult = JSON.stringify({ error: 'Tool call timed out after 30 seconds' });
            toolInteractions.push({ tool: `${pluginId}/${toolName}`, args, result: errResult });
            socket.emit('chat:tool:done', { sessionId, generationId });
            resolve(errResult);
          }, 30000);

          pendingToolCalls.set(toolCallId, {
            resolve: (result) => {
              const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
              toolInteractions.push({ tool: `${pluginId}/${toolName}`, args, result: resultStr });
              socket.emit('chat:tool:done', { sessionId, generationId });
              resolve(resultStr);
            },
            reject,
            timeout,
          });

          console.log(`[Socket.io] Emitting plugin:invoke for ${pluginId}/${toolName} (toolCallId: ${toolCallId})`);
          socket.emit('plugin:invoke', {
            toolCallId,
            pluginId,
            toolName,
            parameters: args,
            sessionId,
          });
        });
      };

      await streamChat({
        messages,
        sessionId,
        signal: abortController.signal,
        toolExecutor,
        onToken: (token) => {
          fullResponse += token;
          socket.emit('chat:stream', { sessionId, token, generationId });
        },
        onFinish: async (text, usage) => {
          const finishTime = new Date().toISOString();

          // Build the full content including tool context for conversation history
          let savedContent = text || '';
          if (toolInteractions.length > 0) {
            const toolContext = toolInteractions
              .map(t => `[Used tool ${t.tool}: ${t.result}]`)
              .join('\n');
            savedContent = savedContent
              ? `${savedContent}\n\n${toolContext}`
              : toolContext;
          }

          if (savedContent && savedContent.trim().length > 0) {
            await query(
              'INSERT INTO messages (id, session_id, role, content, metadata, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
              [
                assistantMsgId,
                sessionId,
                'assistant',
                savedContent,
                JSON.stringify({ usage, toolCalls: toolInteractions.length > 0 ? toolInteractions : undefined }),
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
          console.error('[Socket.io] LLM error:', error.message, error.stack?.slice(0, 500));
          socket.emit('chat:error', {
            sessionId,
            generationId,
            message: `Failed to generate response: ${error.message}`,
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

    // --- Plugin error from frontend ---
    socket.on('plugin:error', async (data: {
      sessionId: string;
      pluginId: string;
      instanceId: string;
      code: string;
      message: string;
    }) => {
      const now = new Date().toISOString();

      // Update plugin instance to error status
      await query(`
        UPDATE plugin_instances SET status = 'error', completion_data = $1, updated_at = $2
        WHERE id = $3 AND session_id = $4
      `, [JSON.stringify({ error: data.code, message: data.message }), now, data.instanceId, data.sessionId]);

      // Inject error context so LLM knows the plugin failed
      const errorMsg = `[Plugin Error] ${data.pluginId}: ${data.message} (code: ${data.code})`;
      await query(
        'INSERT INTO messages (id, session_id, role, content, metadata, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          uuidv4(),
          data.sessionId,
          'system',
          errorMsg,
          JSON.stringify({ pluginId: data.pluginId, error: data.code, message: data.message }),
          now
        ]
      );

      console.log(`[Socket.io] Plugin error: ${data.pluginId} in session ${data.sessionId} — ${data.code}: ${data.message}`);
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
