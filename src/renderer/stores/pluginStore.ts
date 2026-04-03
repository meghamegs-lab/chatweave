import { createStore, useStore } from 'zustand'
import { immer } from 'zustand/middleware/immer'

export interface PluginInfo {
  id: string;
  name: string;
  iframeUrl: string;
  defaultHeight: number;
  maxHeight: number;
}

export interface ActivePlugin {
  pluginId: string;
  instanceId: string;
  status: 'loading' | 'ready' | 'active' | 'completed' | 'error';
  height: number;
  state: Record<string, unknown>;
  stateSummary?: string;
  completionData?: {
    event: string;
    data: Record<string, unknown>;
    summary: string;
  };
  errorMessage?: string;
}

interface PluginStoreState {
  registeredPlugins: PluginInfo[];
  activePlugins: Record<string, ActivePlugin>;
}

interface PluginStoreActions {
  setRegisteredPlugins: (plugins: PluginInfo[]) => void;
  activatePlugin: (pluginId: string, plugin: PluginInfo) => string;
  setPluginStatus: (
    instanceId: string,
    status: ActivePlugin['status']
  ) => void;
  setPluginHeight: (instanceId: string, height: number) => void;
  updatePluginState: (
    instanceId: string,
    state: Record<string, unknown>,
    summary?: string
  ) => void;
  completePlugin: (
    instanceId: string,
    event: string,
    data: Record<string, unknown>,
    summary: string
  ) => void;
  setPluginError: (instanceId: string, message: string) => void;
  deactivatePlugin: (instanceId: string) => void;
  getActiveByPluginId: (pluginId: string) => ActivePlugin | undefined;
}

function generateInstanceId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const pluginStore = createStore<PluginStoreState & PluginStoreActions>()(
  immer((set, get) => ({
    registeredPlugins: [],
    activePlugins: {},

    setRegisteredPlugins: (plugins: PluginInfo[]) => {
      set((state) => {
        state.registeredPlugins = plugins;
      });
    },

    activatePlugin: (pluginId: string, plugin: PluginInfo): string => {
      const instanceId = generateInstanceId();
      set((state) => {
        state.activePlugins[instanceId] = {
          pluginId,
          instanceId,
          status: 'loading',
          height: plugin.defaultHeight,
          state: {},
        };
      });
      return instanceId;
    },

    setPluginStatus: (
      instanceId: string,
      status: ActivePlugin['status']
    ) => {
      set((state) => {
        const plugin = state.activePlugins[instanceId];
        if (plugin) {
          plugin.status = status;
        }
      });
    },

    setPluginHeight: (instanceId: string, height: number) => {
      set((state) => {
        const plugin = state.activePlugins[instanceId];
        if (plugin) {
          plugin.height = height;
        }
      });
    },

    updatePluginState: (
      instanceId: string,
      pluginState: Record<string, unknown>,
      summary?: string
    ) => {
      set((state) => {
        const plugin = state.activePlugins[instanceId];
        if (plugin) {
          plugin.state = pluginState;
          plugin.stateSummary = summary;
          if (plugin.status === 'ready') {
            plugin.status = 'active';
          }
        }
      });
    },

    completePlugin: (
      instanceId: string,
      event: string,
      data: Record<string, unknown>,
      summary: string
    ) => {
      set((state) => {
        const plugin = state.activePlugins[instanceId];
        if (plugin) {
          plugin.status = 'completed';
          plugin.completionData = { event, data, summary };
        }
      });
    },

    setPluginError: (instanceId: string, message: string) => {
      set((state) => {
        const plugin = state.activePlugins[instanceId];
        if (plugin) {
          plugin.status = 'error';
          plugin.errorMessage = message;
        }
      });
    },

    deactivatePlugin: (instanceId: string) => {
      set((state) => {
        delete state.activePlugins[instanceId];
      });
    },

    getActiveByPluginId: (pluginId: string): ActivePlugin | undefined => {
      const { activePlugins } = get();
      return Object.values(activePlugins).find(
        (p) => p.pluginId === pluginId
      );
    },
  }))
);

export function usePluginStore<U>(
  selector: Parameters<typeof useStore<typeof pluginStore, U>>[1]
) {
  return useStore<typeof pluginStore, U>(pluginStore, selector);
}
