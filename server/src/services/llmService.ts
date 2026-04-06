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

// System prompt for ChatWeave
const SYSTEM_PROMPT = `You are ChatWeave, a friendly AI learning assistant for students. You help kids learn through interactive apps that launch right inside the chat.

You have these learning apps available as tools — USE THEM whenever a student wants to learn or practice:
- Chess Learning Game (chess-game__start_chess_game) — for strategy, logic, and chess practice
- Math Quest Adventure (math-quest__start_math_quest) — for math practice (addition, subtraction, multiplication, division, fractions, geometry)
- Spell & Learn Word Lab (word-lab__start_word_challenge) — for vocabulary, spelling, phonics, and word-building
- Money Sense (money-sense__start_money_lesson) — for financial literacy (counting money, making change, budgeting, shopping, saving)
- Fact or Fiction (fact-or-fiction__start_challenge) — for media literacy (spotting fake news, source evaluation, bias detection)
- Science Quiz (science-quiz__start_science_quiz) — for science trivia across biology, chemistry, physics, earth science
- Study Planner (study-planner__create_study_plan) — for creating personalized study plans with goals and milestones

IMPORTANT RULES:
1. When a user mentions ANY of these topics, IMMEDIATELY call the corresponding tool. Do NOT ask follow-up questions first — use reasonable defaults for any missing parameters.
2. For study plans: if no specific goal is mentioned, use "Master the subject" as the goal. If no duration is given, default to 4 weeks.
3. For games/quizzes: pick an appropriate difficulty level or topic based on what the user said.
4. NEVER explain what you could do — just DO IT by calling the tool right away.
5. After the tool launches the app, give a brief friendly message about what you launched.

Tool names are formatted as pluginId__toolName. When you use a tool, the app appears in the chat for the user to interact with.

Be encouraging, friendly, and age-appropriate. Use simple language. Keep responses SHORT — 1-2 sentences max.`;

// Callback type for executing a plugin tool and getting its result
export type ToolExecutor = (pluginId: string, toolName: string, args: Record<string, unknown>) => Promise<string>;

// Build tools object for Vercel AI SDK from enabled plugins
export function buildToolsForSession(executor?: ToolExecutor): Record<string, any> {
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
      ...(executor ? {
        execute: async (args: Record<string, unknown>) => {
          const result = await executor(pluginId, pluginTool.name, args);
          return result;
        },
      } : {}),
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
  onToolCall?: (toolCallId: string, toolName: string, args: Record<string, unknown>) => void;
  onFinish: (fullText: string, usage: { promptTokens: number; completionTokens: number }) => void;
  onError: (error: Error) => void;
  signal?: AbortSignal;
  toolExecutor?: ToolExecutor;
}

export async function streamChat(options: StreamChatOptions): Promise<void> {
  const { messages, onToken, onToolCall, onFinish, onError, signal, toolExecutor } = options;

  try {
    const tools = buildToolsForSession(toolExecutor);

    const result = streamText({
      model: getModel(),
      system: SYSTEM_PROMPT,
      messages,
      tools: Object.keys(tools).length > 0 ? tools : undefined,
      abortSignal: signal,
      stopWhen: stepCountIs(5),
      onStepFinish: (event: any) => {
        console.log(`[LLM] Step finished: type=${event.stepType ?? 'unknown'}, toolCalls=${event.toolCalls?.length ?? 0}, text=${(event.text ?? '').slice(0, 100)}`);
      },
      onError: (event: any) => {
        console.error(`[LLM] Stream error:`, event?.error?.message ?? event);
      },
    });

    let fullText = '';

    // Use fullStream to capture both text and tool call events
    for await (const part of result.fullStream) {
      switch (part.type) {
        case 'text-delta': {
          const delta = (part as any).textDelta ?? (part as any).text ?? '';
          if (delta) {
            fullText += delta;
            onToken(delta);
          }
        }
          break;
        case 'tool-call': {
          const toolArgs = ((part as any).input ?? (part as any).args ?? {}) as Record<string, unknown>;
          console.log(`[LLM] Tool call: ${part.toolName}`, JSON.stringify(toolArgs));
          if (onToolCall) {
            onToolCall(part.toolCallId, part.toolName, toolArgs);
          }
        }
          break;
        case 'tool-result': {
          const resultStr = JSON.stringify((part as any).result ?? (part as any).output ?? null);
          console.log(`[LLM] Tool result for ${(part as any).toolName}: ${(resultStr ?? '').slice(0, 200)}`);
        }
          break;
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
