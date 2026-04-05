import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, queryAll } from '../db';
import { pluginRegistry } from './pluginRegistry';
import { AppError } from '../middleware/errorHandler';

// Track processed completion IDs for idempotency
const processedCompletions = new Set<string>();

export interface CompletionEvent {
  sessionId: string;
  pluginId: string;
  instanceId: string;
  event: string;
  data: Record<string, unknown>;
  summary: string;
}

/**
 * Create a new plugin instance record when a plugin is activated.
 */
export async function createPluginInstance(
  sessionId: string,
  pluginId: string,
): Promise<string> {
  const id = uuidv4();
  const now = new Date().toISOString();

  await query(`
    INSERT INTO plugin_instances (id, session_id, plugin_id, state, status, created_at, updated_at)
    VALUES ($1, $2, $3, '{}', 'active', $4, $5)
  `, [id, sessionId, pluginId, now, now]);

  return id;
}

/**
 * Update the state of a plugin instance.
 */
export async function updatePluginInstanceState(
  instanceId: string,
  state: Record<string, unknown>,
): Promise<void> {
  const now = new Date().toISOString();

  await query(`
    UPDATE plugin_instances SET state = $1, updated_at = $2
    WHERE id = $3
  `, [JSON.stringify(state), now, instanceId]);
}

/**
 * Process a plugin completion event.
 * - Validates the event against the plugin manifest's completion_events
 * - Checks idempotency (duplicate completion IDs are no-ops)
 * - Updates plugin_instances table
 * - Injects a system message with the completion summary
 * - Returns the context message for LLM follow-up
 */
export async function processCompletion(completion: CompletionEvent): Promise<{
  contextMessage: string;
  alreadyProcessed: boolean;
}> {
  // Idempotency: check if this completion was already processed
  const completionKey = `${completion.instanceId}:${completion.event}`;
  if (processedCompletions.has(completionKey)) {
    return { contextMessage: '', alreadyProcessed: true };
  }

  // Validate the event against the plugin's manifest
  const plugin = pluginRegistry.getById(completion.pluginId);
  if (!plugin) {
    throw new AppError(`Plugin "${completion.pluginId}" not found`, 404, 'PLUGIN_NOT_FOUND');
  }

  if (plugin.completion_events.length > 0 && !plugin.completion_events.includes(completion.event)) {
    throw new AppError(
      `Event "${completion.event}" is not a valid completion event for plugin "${completion.pluginId}"`,
      400,
      'INVALID_COMPLETION_EVENT'
    );
  }

  const now = new Date().toISOString();

  // Update plugin instance to completed status
  await query(`
    UPDATE plugin_instances
    SET status = 'completed', completion_data = $1, updated_at = $2
    WHERE id = $3
  `, [JSON.stringify({ event: completion.event, data: completion.data, summary: completion.summary }), now, completion.instanceId]);

  // Build context message for LLM
  const contextMessage = buildCompletionContextMessage(plugin.name, completion);

  // Inject as system message
  await query(`
    INSERT INTO messages (id, session_id, role, content, metadata, created_at)
    VALUES ($1, $2, 'system', $3, $4, $5)
  `, [
    uuidv4(),
    completion.sessionId,
    contextMessage,
    JSON.stringify({
      type: 'plugin_completion',
      pluginId: completion.pluginId,
      instanceId: completion.instanceId,
      event: completion.event,
      data: completion.data,
    }),
    now
  ]);

  // Update session timestamp
  await query('UPDATE sessions SET updated_at = $1 WHERE id = $2',
    [now, completion.sessionId]);

  // Mark as processed
  processedCompletions.add(completionKey);

  return { contextMessage, alreadyProcessed: false };
}

/**
 * Build a human-readable context message for the LLM from a completion event.
 */
function buildCompletionContextMessage(
  pluginName: string,
  completion: CompletionEvent,
): string {
  let msg = `[${pluginName} - Completed] ${completion.summary}`;

  // Add structured data summary if present
  const dataEntries = Object.entries(completion.data);
  if (dataEntries.length > 0) {
    const details = dataEntries
      .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
      .join(', ');
    msg += ` | Details: ${details}`;
  }

  return msg;
}

/**
 * Get all plugin instances for a session.
 */
export async function getPluginInstances(sessionId: string): Promise<Array<{
  id: string;
  pluginId: string;
  status: string;
  state: Record<string, unknown>;
  completionData: Record<string, unknown> | null;
  createdAt: string;
}>> {
  const rows = await queryAll<{
    id: string;
    plugin_id: string;
    status: string;
    state: string;
    completion_data: string | null;
    created_at: string;
  }>(`
    SELECT id, plugin_id, status, state, completion_data, created_at
    FROM plugin_instances
    WHERE session_id = $1
    ORDER BY created_at ASC
  `, [sessionId]);

  return rows.map(row => ({
    id: row.id,
    pluginId: row.plugin_id,
    status: row.status,
    state: JSON.parse(row.state || '{}'),
    completionData: row.completion_data ? JSON.parse(row.completion_data) : null,
    createdAt: row.created_at,
  }));
}

/**
 * Clean up old processed completion IDs to prevent memory leaks.
 * Call periodically (e.g., every hour).
 */
export function cleanupProcessedCompletions(): void {
  processedCompletions.clear();
}
