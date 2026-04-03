import type { PluginToPlatformMessage } from './types';

/**
 * Counter for generating unique message IDs.
 * Combined with a timestamp prefix to avoid collisions across page reloads.
 */
let messageCounter = 0;

/**
 * Generates a unique message ID using a timestamp prefix and incrementing counter.
 * No external dependencies required.
 */
export function generateMessageId(): string {
  const timestamp = Date.now().toString(36);
  const count = (messageCounter++).toString(36);
  return `msg_${timestamp}_${count}`;
}

/**
 * Validates that a given origin is allowed based on the allowedOrigins list.
 *
 * - If allowedOrigins includes '*', all origins are accepted (development only).
 * - Otherwise, the event origin must exactly match one of the allowed origins.
 */
export function isOriginAllowed(
  eventOrigin: string,
  allowedOrigins: string[],
): boolean {
  if (allowedOrigins.includes('*')) {
    return true;
  }
  return allowedOrigins.includes(eventOrigin);
}

/**
 * Sends a message to the parent window (the platform host).
 *
 * @param message - The structured message to send
 * @param targetOrigin - The origin to target; defaults to '*' but should be
 *                        restricted in production to the known platform origin.
 */
export function sendMessage(
  message: PluginToPlatformMessage,
  targetOrigin: string = '*',
): void {
  if (typeof window === 'undefined' || !window.parent) {
    return;
  }

  // Determine the target origin for postMessage.
  // If a specific origin list is available, use the first non-wildcard entry.
  // Otherwise fall back to '*'.
  window.parent.postMessage(message, targetOrigin);
}
