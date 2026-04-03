import { Paper } from '@mantine/core';
import { useCallback, useEffect, useRef, useState, type FC } from 'react';
import { pluginBridge } from '@/packages/plugin-bridge';
import { PluginErrorState, PluginLoading } from './PluginLoadingState';

interface PluginFrameProps {
  instanceId: string;
  pluginId: string;
  pluginName: string;
  iframeUrl: string;
  defaultHeight: number;
  maxHeight: number;
  sessionId: string;
  theme: 'light' | 'dark';
  onReady?: () => void;
  onComplete?: (
    event: string,
    data: Record<string, unknown>,
    summary: string
  ) => void;
  onError?: (message: string) => void;
}

const LOAD_TIMEOUT_MS = 5000;

const PluginFrame: FC<PluginFrameProps> = ({
  instanceId,
  pluginId,
  pluginName,
  iframeUrl,
  defaultHeight,
  maxHeight,
  sessionId,
  theme,
  onReady,
  onComplete,
  onError,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<
    'loading' | 'ready' | 'error'
  >('loading');
  const [height, setHeight] = useState(defaultHeight);
  const [errorMessage, setErrorMessage] = useState('');
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const handleRetry = useCallback(() => {
    setStatus('loading');
    setErrorMessage('');
    // Force iframe reload by resetting src
    const iframe = iframeRef.current;
    if (iframe) {
      iframe.src = iframeUrl;
    }
  }, [iframeUrl]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Set up bridge callbacks for this plugin
    const prevOnReady = pluginBridge.onReady;
    const prevOnResize = pluginBridge.onResize;
    const prevOnComplete = pluginBridge.onComplete;
    const prevOnError = pluginBridge.onError;

    pluginBridge.onReady = (readyPluginId: string) => {
      if (readyPluginId === pluginId) {
        setStatus('ready');
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current);
        }
        onReady?.();
      }
      // Chain to previous handler for other plugins
      prevOnReady?.(readyPluginId);
    };

    pluginBridge.onResize = (resizePluginId: string, newHeight: number) => {
      if (resizePluginId === pluginId) {
        setHeight(Math.min(newHeight, maxHeight));
      }
      prevOnResize?.(resizePluginId, newHeight);
    };

    pluginBridge.onComplete = (
      completePluginId: string,
      event: string,
      data: Record<string, unknown>,
      summary: string
    ) => {
      if (completePluginId === pluginId) {
        onComplete?.(event, data, summary);
      }
      prevOnComplete?.(completePluginId, event, data, summary);
    };

    pluginBridge.onError = (
      errorPluginId: string,
      code: string,
      message: string
    ) => {
      if (errorPluginId === pluginId) {
        setStatus('error');
        setErrorMessage(`[${code}] ${message}`);
        onError?.(message);
      }
      prevOnError?.(errorPluginId, code, message);
    };

    // Register with bridge on iframe load
    const handleIframeLoad = () => {
      pluginBridge.registerPlugin(pluginId, iframe, iframeUrl);
      pluginBridge.sendInit(pluginId, sessionId, theme);

      // Start load timeout
      loadTimeoutRef.current = setTimeout(() => {
        if (status === 'loading') {
          setStatus('error');
          setErrorMessage(
            `Plugin "${pluginName}" failed to respond within ${LOAD_TIMEOUT_MS / 1000} seconds`
          );
          onError?.(
            `Plugin "${pluginName}" failed to respond within ${LOAD_TIMEOUT_MS / 1000} seconds`
          );
        }
      }, LOAD_TIMEOUT_MS);
    };

    iframe.addEventListener('load', handleIframeLoad);

    return () => {
      iframe.removeEventListener('load', handleIframeLoad);
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
      // Send destroy before unregistering
      pluginBridge.sendDestroy(pluginId);
      pluginBridge.unregisterPlugin(pluginId);

      // Restore previous handlers
      pluginBridge.onReady = prevOnReady;
      pluginBridge.onResize = prevOnResize;
      pluginBridge.onComplete = prevOnComplete;
      pluginBridge.onError = prevOnError;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pluginId, iframeUrl, instanceId]);

  // Send theme updates when theme changes (after initial mount)
  useEffect(() => {
    if (status === 'ready' || status === 'loading') {
      pluginBridge.sendThemeUpdate(pluginId, theme);
    }
  }, [theme, pluginId, status]);

  if (status === 'error') {
    return (
      <PluginErrorState
        errorMessage={errorMessage}
        onRetry={handleRetry}
      />
    );
  }

  return (
    <Paper shadow="xs" radius="md" className="overflow-hidden my-2">
      {status === 'loading' && <PluginLoading pluginName={pluginName} />}
      <iframe
        ref={iframeRef}
        src={iframeUrl}
        sandbox="allow-scripts allow-popups"
        style={{
          width: '100%',
          height: `${height}px`,
          border: 'none',
          display: status === 'loading' ? 'none' : 'block',
        }}
        title={`Plugin: ${pluginName}`}
      />
    </Paper>
  );
};

export default PluginFrame;
