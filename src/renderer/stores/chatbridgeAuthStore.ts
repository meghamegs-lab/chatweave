import { createStore, useStore } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

interface User {
  id: string
  email: string
  displayName: string
  role: 'student' | 'teacher' | 'admin'
}

interface ChatBridgeAuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

interface ChatBridgeAuthActions {
  setAuth: (user: User, token: string) => void
  clearAuth: () => void
  setLoading: (loading: boolean) => void
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName: string, role: string) => Promise<void>
  refreshToken: () => Promise<boolean>
  fetchMe: () => Promise<void>
  logout: () => void
}

const API_BASE = 'http://localhost:3001/api'

export const chatbridgeAuthStore = createStore<ChatBridgeAuthState & ChatBridgeAuthActions>()(
  persist(
    immer((set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      setAuth: (user, token) => {
        set((state) => {
          state.user = user
          state.token = token
          state.isAuthenticated = true
          state.isLoading = false
        })
      },

      clearAuth: () => {
        set((state) => {
          state.user = null
          state.token = null
          state.isAuthenticated = false
          state.isLoading = false
        })
      },

      setLoading: (loading) => {
        set((state) => {
          state.isLoading = loading
        })
      },

      login: async (email, password) => {
        set((state) => {
          state.isLoading = true
        })
        try {
          const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password }),
          })
          if (!res.ok) {
            const err = await res.json()
            throw new Error(err.error?.message || 'Login failed')
          }
          const data = await res.json()
          set((state) => {
            state.user = data.user
            state.token = data.token
            state.isAuthenticated = true
            state.isLoading = false
          })
        } catch (err) {
          set((state) => {
            state.isLoading = false
          })
          throw err
        }
      },

      register: async (email, password, displayName, role) => {
        set((state) => {
          state.isLoading = true
        })
        try {
          const res = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password, displayName, role }),
          })
          if (!res.ok) {
            const err = await res.json()
            throw new Error(err.error?.message || 'Registration failed')
          }
          const data = await res.json()
          set((state) => {
            state.user = data.user
            state.token = data.token
            state.isAuthenticated = true
            state.isLoading = false
          })
        } catch (err) {
          set((state) => {
            state.isLoading = false
          })
          throw err
        }
      },

      refreshToken: async () => {
        try {
          const res = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
          })
          if (!res.ok) return false
          const data = await res.json()
          set((state) => {
            state.token = data.token
          })
          return true
        } catch {
          return false
        }
      },

      fetchMe: async () => {
        const { token } = get()
        if (!token) return
        try {
          const res = await fetch(`${API_BASE}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (!res.ok) {
            get().clearAuth()
            return
          }
          const data = await res.json()
          set((state) => {
            state.user = data.user
          })
        } catch {
          get().clearAuth()
        }
      },

      logout: () => {
        fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {})
        set((state) => {
          state.user = null
          state.token = null
          state.isAuthenticated = false
        })
      },
    })),
    {
      name: 'chatbridge-auth',
      version: 1,
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)

export function useChatBridgeAuth<U>(selector: Parameters<typeof useStore<typeof chatbridgeAuthStore, U>>[1]) {
  return useStore(chatbridgeAuthStore, selector)
}
