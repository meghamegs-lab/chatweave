// ============================================================================
// Platform → Plugin Messages
// Mirrored from plugins/sdk/src/types.ts to avoid cross-package dependency
// ============================================================================

export interface PlatformInitMessage {
  type: 'PLUGIN_INIT';
  messageId: string;
  payload: {
    sessionId: string;
    theme: 'light' | 'dark';
    locale: string;
    config: Record<string, unknown>;
  };
}

export interface PlatformToolInvokeMessage {
  type: 'TOOL_INVOKE';
  messageId: string;
  payload: {
    toolName: string;
    parameters: Record<string, unknown>;
  };
}

export interface PlatformThemeUpdateMessage {
  type: 'THEME_UPDATE';
  messageId: string;
  payload: {
    theme: 'light' | 'dark';
  };
}

export interface PlatformDestroyMessage {
  type: 'PLUGIN_DESTROY';
  messageId: string;
  payload: Record<string, never>;
}

export type PlatformToPluginMessage =
  | PlatformInitMessage
  | PlatformToolInvokeMessage
  | PlatformThemeUpdateMessage
  | PlatformDestroyMessage;

// ============================================================================
// Plugin → Platform Messages
// ============================================================================

export interface PluginReadyMessage {
  type: 'PLUGIN_READY';
  messageId: string;
  payload: {
    version: string;
  };
}

export interface PluginToolResultMessage {
  type: 'TOOL_RESULT';
  messageId: string;
  payload: {
    result: unknown;
    error?: string;
  };
}

export interface PluginStateUpdateMessage {
  type: 'STATE_UPDATE';
  messageId: string;
  payload: {
    state: Record<string, unknown>;
    summary?: string;
  };
}

export interface PluginCompleteMessage {
  type: 'PLUGIN_COMPLETE';
  messageId: string;
  payload: {
    event: string;
    data: Record<string, unknown>;
    summary: string;
  };
}

export interface PluginResizeMessage {
  type: 'PLUGIN_RESIZE';
  messageId: string;
  payload: {
    height: number;
  };
}

export interface PluginErrorMessage {
  type: 'PLUGIN_ERROR';
  messageId: string;
  payload: {
    code: string;
    message: string;
  };
}

export type PluginToPlatformMessage =
  | PluginReadyMessage
  | PluginToolResultMessage
  | PluginStateUpdateMessage
  | PluginCompleteMessage
  | PluginResizeMessage
  | PluginErrorMessage;
