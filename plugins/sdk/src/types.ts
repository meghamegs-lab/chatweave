// ============================================================================
// Platform → Plugin Messages
// ============================================================================

export interface InitMessage {
  type: 'PLUGIN_INIT';
  messageId: string;
  payload: {
    sessionId: string;
    theme: 'light' | 'dark';
    locale: string;
    config: Record<string, unknown>;
  };
}

export interface ToolInvokeMessage {
  type: 'TOOL_INVOKE';
  messageId: string;
  payload: {
    toolName: string;
    parameters: Record<string, unknown>;
  };
}

export interface ThemeUpdateMessage {
  type: 'THEME_UPDATE';
  messageId: string;
  payload: {
    theme: 'light' | 'dark';
  };
}

export interface DestroyMessage {
  type: 'PLUGIN_DESTROY';
  messageId: string;
  payload: Record<string, never>;
}

export type PlatformToPluginMessage =
  | InitMessage
  | ToolInvokeMessage
  | ThemeUpdateMessage
  | DestroyMessage;

// ============================================================================
// Plugin → Platform Messages
// ============================================================================

export interface ReadyMessage {
  type: 'PLUGIN_READY';
  messageId: string;
  payload: {
    version: string;
  };
}

export interface ToolResultMessage {
  type: 'TOOL_RESULT';
  messageId: string;
  payload: {
    result: unknown;
    error?: string;
  };
}

export interface StateUpdateMessage {
  type: 'STATE_UPDATE';
  messageId: string;
  payload: {
    state: Record<string, unknown>;
    summary?: string;
  };
}

export interface CompleteMessage {
  type: 'PLUGIN_COMPLETE';
  messageId: string;
  payload: {
    event: string;
    data: Record<string, unknown>;
    summary: string;
  };
}

export interface ResizeMessage {
  type: 'PLUGIN_RESIZE';
  messageId: string;
  payload: {
    height: number;
  };
}

export interface ErrorMessage {
  type: 'PLUGIN_ERROR';
  messageId: string;
  payload: {
    code: string;
    message: string;
  };
}

export interface AuthRequestMessage {
  type: 'AUTH_REQUEST';
  messageId: string;
  payload: {
    provider: string;
  };
}

export type PluginToPlatformMessage =
  | ReadyMessage
  | ToolResultMessage
  | StateUpdateMessage
  | CompleteMessage
  | ResizeMessage
  | ErrorMessage
  | AuthRequestMessage;

// ============================================================================
// SDK Config & Handler Types
// ============================================================================

/**
 * Session configuration received from the platform during initialization.
 */
export interface PluginConfig {
  sessionId: string;
  theme: 'light' | 'dark';
  locale: string;
  config: Record<string, unknown>;
}

/**
 * Handler for tool invocations from the platform.
 * Receives the tool name and parameters, returns the result (or throws on error).
 */
export type ToolInvokeHandler = (
  toolName: string,
  parameters: Record<string, unknown>,
) => Promise<unknown>;
