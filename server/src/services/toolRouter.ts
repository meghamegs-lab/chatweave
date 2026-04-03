import { pluginRegistry, Plugin } from './pluginRegistry';
import { PluginTool } from '../types/plugin';

export interface NamespacedTool {
  namespacedName: string;
  pluginId: string;
  pluginName: string;
  toolName: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * Build a flat list of all tools from enabled plugins,
 * with namespaced names and enriched descriptions.
 */
export function getAllNamespacedTools(): NamespacedTool[] {
  const pluginTools = pluginRegistry.getToolsForEnabledPlugins();
  const result: NamespacedTool[] = [];

  for (const { pluginId, tool } of pluginTools) {
    const plugin = pluginRegistry.getById(pluginId);
    const pluginName = plugin?.name ?? pluginId;

    result.push({
      namespacedName: `${pluginId}__${tool.name}`,
      pluginId,
      pluginName,
      toolName: tool.name,
      description: `[${pluginName}] ${tool.description}`,
      parameters: {
        type: 'object' as const,
        properties: tool.parameters.properties ?? {},
        ...(tool.parameters.required ? { required: tool.parameters.required } : {}),
      },
    });
  }

  return result;
}

/**
 * Parse a namespaced tool name (e.g. "chess-game__start_chess_game")
 * back into its pluginId and toolName components.
 */
export function parseNamespacedToolName(name: string): { pluginId: string; toolName: string } | null {
  const separatorIndex = name.indexOf('__');
  if (separatorIndex === -1) return null;

  return {
    pluginId: name.substring(0, separatorIndex),
    toolName: name.substring(separatorIndex + 2),
  };
}

/**
 * Look up the plugin and tool definition for a namespaced tool name.
 * Returns null if the plugin doesn't exist or isn't enabled.
 */
export function resolveToolCall(namespacedName: string): {
  plugin: Plugin;
  tool: PluginTool;
  pluginId: string;
  toolName: string;
} | null {
  const parsed = parseNamespacedToolName(namespacedName);
  if (!parsed) return null;

  const plugin = pluginRegistry.getById(parsed.pluginId);
  if (!plugin || !plugin.is_enabled) return null;

  const tool = plugin.tools.find(t => t.name === parsed.toolName);
  if (!tool) return null;

  return {
    plugin,
    tool,
    pluginId: parsed.pluginId,
    toolName: parsed.toolName,
  };
}

/**
 * Build the system prompt section that describes available plugins and their tools.
 */
export function buildPluginSystemPrompt(): string {
  const tools = getAllNamespacedTools();

  if (tools.length === 0) {
    return '';
  }

  const pluginGroups = new Map<string, NamespacedTool[]>();
  for (const t of tools) {
    const existing = pluginGroups.get(t.pluginId) || [];
    existing.push(t);
    pluginGroups.set(t.pluginId, existing);
  }

  let prompt = '\n\nAvailable plugins and their tools:\n';

  for (const [pluginId, pluginTools] of Array.from(pluginGroups.entries())) {
    const plugin = pluginRegistry.getById(pluginId);
    const name = plugin?.name ?? pluginId;
    const desc = plugin?.description ?? '';

    prompt += `\n### ${name}${desc ? ` — ${desc}` : ''}\n`;

    for (const t of pluginTools) {
      prompt += `- **${t.namespacedName}**: ${t.description}\n`;
    }
  }

  return prompt;
}
