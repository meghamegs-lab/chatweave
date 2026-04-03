import { generateMessageId, isOriginAllowed, sendMessage } from './bridge';
import type {
  PlatformToPluginMessage,
  PluginConfig,
  ToolInvokeHandler,
} from './types';

// Re-export all types for consumers
export type {
  PlatformToPluginMessage,
  PluginToPlatformMessage,
  PluginConfig,
  ToolInvokeHandler,
  InitMessage,
  ToolInvokeMessage,
  ThemeUpdateMessage,
  DestroyMessage,
  ReadyMessage,
  ToolResultMessage,
  StateUpdateMessage,
  CompleteMessage,
  ResizeMessage,
  ErrorMessage,
  AuthRequestMessage,
} from './types';

// Re-export bridge utilities for advanced use cases
export { generateMessageId, isOriginAllowed, sendMessage } from './bridge';

/**
 * Options for creating a ChatBridgePlugin instance.
 */
export interface ChatBridgePluginOptions {
  /** Unique plugin identifier */
  id: string;

  /** Plugin version (included in PLUGIN_READY message) */
  version?: string;

  /**
   * Platform origins to accept messages from.
   * Defaults to ['*'] for development. Should be restricted in production.
   */
  allowedOrigins?: string[];

  /** Called when the platform sends PLUGIN_INIT with session configuration */
  onInit?: (config: PluginConfig) => void;

  /** Called when the platform requests a tool invocation */
  onToolInvoke?: ToolInvokeHandler;

  /** Called when the platform theme changes */
  onThemeUpdate?: (theme: 'light' | 'dark') => void;

  /** Called when the platform requests plugin destruction */
  onDestroy?: () => void;
}

/**
 * Main SDK class that wraps all postMessage communication between a plugin
 * iframe and the ChatBridge platform.
 *
 * Usage:
 * ```typescript
 * import { ChatBridgePlugin } from '@chatbridge/plugin-sdk';
 *
 * const plugin = new ChatBridgePlugin({
 *   id: 'chess-game',
 *   onInit: (config) => console.log('Initialized', config),
 *   onToolInvoke: async (tool, params) => ({ success: true }),
 *   onDestroy: () => console.log('Destroyed'),
 * });
 * ```
 */
export class ChatBridgePlugin {
  private readonly id: string;
  private readonly version: string;
  private readonly allowedOrigins: string[];
  private readonly onInit?: (config: PluginConfig) => void;
  private readonly onToolInvoke?: ToolInvokeHandler;
  private readonly onThemeUpdate?: (theme: 'light' | 'dark') => void;
  private readonly onDestroyCallback?: () => void;

  private readonly messageHandler: (event: MessageEvent) => void;
  private destroyed = false;

  /**
   * The target origin used when sending messages to the platform.
   * Derived from allowedOrigins: uses the first non-wildcard origin,
   * or '*' if only wildcards are configured.
   */
  private readonly targetOrigin: string;

  constructor(options: ChatBridgePluginOptions) {
    this.id = options.id;
    this.version = options.version ?? '1.0.0';
    this.allowedOrigins = options.allowedOrigins ?? ['*'];
    this.onInit = options.onInit;
    this.onToolInvoke = options.onToolInvoke;
    this.onThemeUpdate = options.onThemeUpdate;
    this.onDestroyCallback = options.onDestroy;

    // Determine the best target origin for outgoing messages
    const specificOrigin = this.allowedOrigins.find((o) => o !== '*');
    this.targetOrigin = specificOrigin ?? '*';

    // Bind and register the message handler
    this.messageHandler = this.handleMessage.bind(this);

    if (typeof window !== 'undefined') {
      window.addEventListener('message', this.messageHandler);
    }

    // Send PLUGIN_READY to notify the platform that this plugin is loaded
    this.sendReady();
  }

  // ==========================================================================
  // Public API — Plugin → Platform
  // ==========================================================================

  /**
   * Sends a state update to the platform.
   */
  updateState(state: Record<string, unknown>, summary?: string): void {
    this.assertNotDestroyed();
    sendMessage(
      {
        type: 'STATE_UPDATE',
        messageId: generateMessageId(),
        payload: { state, summary },
      },
      this.targetOrigin,
    );
  }

  /**
   * Signals task completion to the platform.
   */
  complete(
    event: string,
    data: Record<string, unknown>,
    summary: string,
  ): void {
    this.assertNotDestroyed();
    sendMessage(
      {
        type: 'PLUGIN_COMPLETE',
        messageId: generateMessageId(),
        payload: { event, data, summary },
      },
      this.targetOrigin,
    );
  }

  /**
   * Requests iframe resize from the platform.
   */
  resize(height: number): void {
    this.assertNotDestroyed();
    sendMessage(
      {
        type: 'PLUGIN_RESIZE',
        messageId: generateMessageId(),
        payload: { height },
      },
      this.targetOrigin,
    );
  }

  /**
   * Requests an OAuth authentication flow from the platform.
   */
  requestAuth(provider: string): void {
    this.assertNotDestroyed();
    sendMessage(
      {
        type: 'AUTH_REQUEST',
        messageId: generateMessageId(),
        payload: { provider },
      },
      this.targetOrigin,
    );
  }

  /**
   * Reports an error to the platform.
   */
  reportError(code: string, message: string): void {
    this.assertNotDestroyed();
    sendMessage(
      {
        type: 'PLUGIN_ERROR',
        messageId: generateMessageId(),
        payload: { code, message },
      },
      this.targetOrigin,
    );
  }

  /**
   * Removes event listeners and marks the plugin as destroyed.
   * After calling destroy(), no further messages can be sent.
   */
  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;

    if (typeof window !== 'undefined') {
      window.removeEventListener('message', this.messageHandler);
    }
  }

  // ==========================================================================
  // Internal — Message Handling
  // ==========================================================================

  /**
   * Handles incoming postMessage events from the platform.
   */
  private handleMessage(event: MessageEvent): void {
    // Security: reject untrusted events
    if (!event.isTrusted) {
      return;
    }

    // Security: validate origin against allowlist
    if (!isOriginAllowed(event.origin, this.allowedOrigins)) {
      return;
    }

    const message = event.data as PlatformToPluginMessage;

    // Basic structural validation — must have a type and messageId
    if (
      !message ||
      typeof message !== 'object' ||
      typeof message.type !== 'string' ||
      typeof message.messageId !== 'string'
    ) {
      return;
    }

    switch (message.type) {
      case 'PLUGIN_INIT':
        this.handleInit(message.payload);
        break;

      case 'TOOL_INVOKE':
        this.handleToolInvoke(message.messageId, message.payload);
        break;

      case 'THEME_UPDATE':
        this.handleThemeUpdate(message.payload);
        break;

      case 'PLUGIN_DESTROY':
        this.handleDestroy();
        break;

      default:
        // Unknown message type — ignore silently
        break;
    }
  }

  private handleInit(payload: {
    sessionId: string;
    theme: 'light' | 'dark';
    locale: string;
    config: Record<string, unknown>;
  }): void {
    if (this.onInit) {
      const config: PluginConfig = {
        sessionId: payload.sessionId,
        theme: payload.theme,
        locale: payload.locale,
        config: payload.config,
      };
      this.onInit(config);
    }
  }

  private handleToolInvoke(
    messageId: string,
    payload: { toolName: string; parameters: Record<string, unknown> },
  ): void {
    if (!this.onToolInvoke) {
      // No handler registered — send error back
      sendMessage(
        {
          type: 'TOOL_RESULT',
          messageId,
          payload: {
            result: null,
            error: 'No tool invoke handler registered',
          },
        },
        this.targetOrigin,
      );
      return;
    }

    // Call the handler and send result back (or error on rejection)
    this.onToolInvoke(payload.toolName, payload.parameters)
      .then((result) => {
        sendMessage(
          {
            type: 'TOOL_RESULT',
            messageId,
            payload: { result },
          },
          this.targetOrigin,
        );
      })
      .catch((err: unknown) => {
        const errorMessage =
          err instanceof Error ? err.message : String(err);
        sendMessage(
          {
            type: 'TOOL_RESULT',
            messageId,
            payload: {
              result: null,
              error: errorMessage,
            },
          },
          this.targetOrigin,
        );
      });
  }

  private handleThemeUpdate(payload: { theme: 'light' | 'dark' }): void {
    if (this.onThemeUpdate) {
      this.onThemeUpdate(payload.theme);
    }
  }

  private handleDestroy(): void {
    if (this.onDestroyCallback) {
      this.onDestroyCallback();
    }
    this.destroy();
  }

  // ==========================================================================
  // Internal — Helpers
  // ==========================================================================

  private sendReady(): void {
    sendMessage(
      {
        type: 'PLUGIN_READY',
        messageId: generateMessageId(),
        payload: { version: this.version },
      },
      this.targetOrigin,
    );
  }

  private assertNotDestroyed(): void {
    if (this.destroyed) {
      throw new Error(
        `ChatBridgePlugin "${this.id}" has been destroyed. Cannot send messages.`,
      );
    }
  }
}
