import type { PlatformToPluginMessage } from './types';

export type { PlatformToPluginMessage, PluginToPlatformMessage } from './types';

type ToolResultCallback = (result: unknown, error?: string) => void;

class PluginBridge {
  private iframes = new Map<string, HTMLIFrameElement>();
  private origins = new Map<string, string>();
  private pendingInvocations = new Map<
    string,
    { resolve: ToolResultCallback; timeout: ReturnType<typeof setTimeout> }
  >();
  private messageCounter = 0;
  private boundHandleMessage: (event: MessageEvent) => void;

  // Callbacks set by consumers
  public onReady?: (pluginId: string) => void;
  public onStateUpdate?: (
    pluginId: string,
    state: Record<string, unknown>,
    summary?: string
  ) => void;
  public onComplete?: (
    pluginId: string,
    event: string,
    data: Record<string, unknown>,
    summary: string
  ) => void;
  public onResize?: (pluginId: string, height: number) => void;
  public onError?: (pluginId: string, code: string, message: string) => void;

  constructor() {
    this.boundHandleMessage = this.handleMessage.bind(this);
    window.addEventListener('message', this.boundHandleMessage);
  }

  generateMessageId(): string {
    return `msg_${Date.now()}_${++this.messageCounter}`;
  }

  registerPlugin(
    pluginId: string,
    iframe: HTMLIFrameElement,
    iframeUrl: string
  ): void {
    this.iframes.set(pluginId, iframe);
    const origin = new URL(iframeUrl).origin;
    this.origins.set(pluginId, origin);
  }

  unregisterPlugin(pluginId: string): void {
    this.iframes.delete(pluginId);
    this.origins.delete(pluginId);
  }

  private getPluginByOrigin(origin: string): string | undefined {
    for (const [id, o] of this.origins) {
      if (o === origin) return id;
    }
    return undefined;
  }

  private sendToPlugin(
    pluginId: string,
    message: PlatformToPluginMessage
  ): void {
    const iframe = this.iframes.get(pluginId);
    const origin = this.origins.get(pluginId);
    if (!iframe?.contentWindow || !origin) return;
    iframe.contentWindow.postMessage(message, origin);
  }

  sendInit(
    pluginId: string,
    sessionId: string,
    theme: 'light' | 'dark'
  ): void {
    this.sendToPlugin(pluginId, {
      type: 'PLUGIN_INIT',
      messageId: this.generateMessageId(),
      payload: { sessionId, theme, locale: navigator.language, config: {} },
    });
  }

  invokeTool(
    pluginId: string,
    toolName: string,
    parameters: Record<string, unknown>
  ): Promise<{ result: unknown; error?: string }> {
    return new Promise((resolve, reject) => {
      const messageId = this.generateMessageId();
      const timeout = setTimeout(() => {
        this.pendingInvocations.delete(messageId);
        reject(
          new Error(
            `Tool invocation timed out after 10 seconds: ${toolName}`
          )
        );
      }, 10_000);

      this.pendingInvocations.set(messageId, {
        resolve: (result, error) => resolve({ result, error }),
        timeout,
      });

      this.sendToPlugin(pluginId, {
        type: 'TOOL_INVOKE',
        messageId,
        payload: { toolName, parameters },
      });
    });
  }

  sendThemeUpdate(pluginId: string, theme: 'light' | 'dark'): void {
    this.sendToPlugin(pluginId, {
      type: 'THEME_UPDATE',
      messageId: this.generateMessageId(),
      payload: { theme },
    });
  }

  sendDestroy(pluginId: string): void {
    this.sendToPlugin(pluginId, {
      type: 'PLUGIN_DESTROY',
      messageId: this.generateMessageId(),
      payload: {} as Record<string, never>,
    });
  }

  private handleMessage(event: MessageEvent): void {
    // Validate trusted
    if (!event.isTrusted) return;

    // Find which plugin sent this message
    const pluginId = this.getPluginByOrigin(event.origin);
    if (!pluginId) return;

    const data = event.data;
    if (!data || typeof data.type !== 'string') return;

    switch (data.type) {
      case 'PLUGIN_READY':
        this.onReady?.(pluginId);
        break;
      case 'TOOL_RESULT': {
        const pending = this.pendingInvocations.get(data.messageId);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingInvocations.delete(data.messageId);
          pending.resolve(data.payload?.result, data.payload?.error);
        }
        break;
      }
      case 'STATE_UPDATE':
        this.onStateUpdate?.(
          pluginId,
          data.payload?.state || {},
          data.payload?.summary
        );
        break;
      case 'PLUGIN_COMPLETE':
        this.onComplete?.(
          pluginId,
          data.payload?.event,
          data.payload?.data || {},
          data.payload?.summary || ''
        );
        break;
      case 'PLUGIN_RESIZE':
        this.onResize?.(pluginId, data.payload?.height || 400);
        break;
      case 'PLUGIN_ERROR':
        this.onError?.(
          pluginId,
          data.payload?.code || 'UNKNOWN',
          data.payload?.message || 'Unknown error'
        );
        break;
    }
  }

  destroy(): void {
    window.removeEventListener('message', this.boundHandleMessage);
    for (const [, { timeout }] of this.pendingInvocations) {
      clearTimeout(timeout);
    }
    this.pendingInvocations.clear();
    this.iframes.clear();
    this.origins.clear();
  }
}

// Singleton
export const pluginBridge = new PluginBridge();
