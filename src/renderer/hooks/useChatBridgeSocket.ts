import { useEffect, useRef, useCallback, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useChatBridgeAuth } from '../stores/chatbridgeAuthStore'

const SOCKET_URL = 'http://localhost:3001'

interface UseChatBridgeSocketOptions {
  onToken?: (data: { sessionId: string; token: string; generationId: string }) => void
  onStreamStart?: (data: { sessionId: string; generationId: string }) => void
  onStreamEnd?: (data: {
    sessionId: string
    generationId: string
    messageId: string
    usage: any
  }) => void
  onError?: (data: { sessionId?: string; message: string }) => void
  onPluginInvoke?: (data: {
    toolCallId: string
    pluginId: string
    toolName: string
    parameters: Record<string, unknown>
    sessionId: string
  }) => void
}

export function useChatBridgeSocket(options: UseChatBridgeSocketOptions = {}) {
  const token = useChatBridgeAuth((s) => s.token)
  const isAuthenticated = useChatBridgeAuth((s) => s.isAuthenticated)
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
        setIsConnected(false)
      }
      return
    }

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    })

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id)
      setIsConnected(true)
    })

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason)
      setIsConnected(false)
    })

    socket.on('chat:stream:start', (data) => options.onStreamStart?.(data))
    socket.on('chat:stream', (data) => options.onToken?.(data))
    socket.on('chat:stream:end', (data) => options.onStreamEnd?.(data))
    socket.on('chat:error', (data) => options.onError?.(data))
    socket.on('plugin:invoke', (data) => options.onPluginInvoke?.(data))

    socketRef.current = socket

    return () => {
      socket.disconnect()
      socketRef.current = null
      setIsConnected(false)
    }
  }, [isAuthenticated, token])

  const sendMessage = useCallback((sessionId: string, content: string) => {
    socketRef.current?.emit('chat:message', { sessionId, content })
  }, [])

  const cancelGeneration = useCallback((generationId: string) => {
    socketRef.current?.emit('chat:cancel', { generationId })
  }, [])

  const sendPluginResult = useCallback((toolCallId: string, result: unknown) => {
    socketRef.current?.emit('plugin:result', { toolCallId, result })
  }, [])

  const sendPluginComplete = useCallback(
    (data: {
      sessionId: string
      pluginId: string
      instanceId: string
      event: string
      completionData: Record<string, unknown>
      summary: string
    }) => {
      socketRef.current?.emit('plugin:complete', data)
    },
    []
  )

  return {
    isConnected,
    sendMessage,
    cancelGeneration,
    sendPluginResult,
    sendPluginComplete,
    socket: socketRef,
  }
}
