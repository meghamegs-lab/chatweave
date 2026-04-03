import { streamText, tool, LanguageModel, stepCountIs } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { config } from '../config';
import { pluginRegistry } from './pluginRegistry';
import { z } from 'zod';

// Initialize providers
const openai = createOpenAI({ apiKey: config.openaiApiKey });
const anthropic = createAnthropic({ apiKey: config.anthropicApiKey });

// Default model
function getModel(): LanguageModel {
  if (config.anthropicApiKey) {
    return anthropic('claude-sonnet-4-20250514');
  }
  return openai('gpt-4o');
}

// System prompt for ChatBridge
const SYSTEM_PROMPT = `You are ChatBridge, an AI learning assistant. You help students with their studies and can use various tools/apps when appropriate.

When a user asks to play chess, check the weather, create playlists, or use any available tool, use the appropriate tool call. Always be helpful, educational, and encouraging.

Available plugins will provide tools you can call. Tool names are formatted as pluginId__toolName. When you use a tool, the corresponding app will appear in the chat for the user to interact with.`;

// Build tools object for Vercel AI SDK from enabled plugins
export function buildToolsForSession(): Record<string, any> {
  const pluginTools = pluginRegistry.getToolsForEnabledPlugins();
  const tools: Record<string, any> = {};

  for (const { pluginId, tool: pluginTool } of pluginTools) {
    const namespacedName = `${pluginId}__${pluginTool.name}`;

    // Convert JSON Schema properties to Zod schema
    const zodProperties: Record<string, any> = {};
    const props = pluginTool.parameters.properties || {};
    const required = pluginTool.parameters.required || [];

    for (const [key, value] of Object.entries(props)) {
      const v = value as any;
      let zodType: any;
      switch (v.type) {
        case 'string':
          zodType = v.enum ? z.enum(v.enum) : z.string();
          if (v.description) zodType = zodType.describe(v.description);
          break;
        case 'number':
        case 'integer':
          zodType = z.number();
          if (v.description) zodType = zodType.describe(v.description);
          break;
        case 'boolean':
          zodType = z.boolean();
          if (v.description) zodType = zodType.describe(v.description);
          break;
        case 'array':
          zodType = z.array(z.any());
          if (v.description) zodType = zodType.describe(v.description);
          break;
        default:
          zodType = z.any();
      }

      if (!required.includes(key)) {
        zodType = zodType.optional();
      }
      zodProperties[key] = zodType;
    }

    const pluginInfo = pluginRegistry.getById(pluginId);
    const description = pluginInfo
      ? `[${pluginInfo.name}] ${pluginTool.description}`
      : pluginTool.description;

    tools[namespacedName] = tool({
      description,
      inputSchema: z.object(zodProperties),
    } as any);
  }

  return tools;
}

// Parse namespaced tool name back to pluginId and toolName
export function parseToolName(namespacedName: string): { pluginId: string; toolName: string } | null {
  const idx = namespacedName.indexOf('__');
  if (idx === -1) return null;
  return {
    pluginId: namespacedName.substring(0, idx),
    toolName: namespacedName.substring(idx + 2),
  };
}

export interface StreamChatOptions {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  sessionId: string;
  onToken: (token: string) => void;
  onToolCall: (toolCallId: string, toolName: string, args: Record<string, unknown>) => void;
  onFinish: (fullText: string, usage: { promptTokens: number; completionTokens: number }) => void;
  onError: (error: Error) => void;
  signal?: AbortSignal;
}

export async function streamChat(options: StreamChatOptions): Promise<void> {
  const { messages, onToken, onToolCall, onFinish, onError, signal } = options;

  try {
    const tools = buildToolsForSession();

    const result = streamText({
      model: getModel(),
      system: SYSTEM_PROMPT,
      messages,
      tools: Object.keys(tools).length > 0 ? tools : undefined,
      abortSignal: signal,
      stopWhen: stepCountIs(5),
    });

    let fullText = '';

    // Use fullStream to capture both text and tool call events
    for await (const part of result.fullStream) {
      switch (part.type) {
        case 'text-delta':
          if (part.textDelta) {
            fullText += part.textDelta;
            onToken(part.textDelta);
          }
          break;
        case 'tool-call': {
          // Vercel AI SDK v6 uses 'input' instead of 'args'
          const toolArgs = ((part as any).input ?? (part as any).args ?? {}) as Record<string, unknown>;
          console.log(`[LLM] Tool call: ${part.toolName}`, JSON.stringify(toolArgs));
          onToolCall(part.toolCallId, part.toolName, toolArgs);
        }
          break;
        // Ignore other part types (step-start, step-finish, tool-result, etc.)
        default:
          break;
      }
    }

    const usage = await result.usage;
    onFinish(fullText, {
      promptTokens: usage?.inputTokens ?? 0,
      completionTokens: usage?.outputTokens ?? 0,
    });
  } catch (err: any) {
    if (err.name === 'AbortError') return;
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}

export { SYSTEM_PROMPT };
