// ─── Auth Context ──────────────────────────────────────────────────────────────

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import {
  getCurrentUser,
  logout as apiLogout,
  checkAuthStatus,
  refreshAccessToken,
  devLogin,
  setAuthStorage,
  clearAuthStorage,
  updateAccessToken,
  getStoredUser,
} from './api'
import type { User } from './types'

interface AuthContextType {
  user: User | null
  loading: boolean
  error: string | null
  login: (email: string, name: string, isFamilyHead?: boolean) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Initialize auth state on mount
  useEffect(() => {
    initAuth()
  }, [])

  const initAuth = useCallback(async () => {
    try {
      setLoading(true)
      const storedUser = getStoredUser()
      if (storedUser) {
        setUser(storedUser)
      }

      // Verify with server
      const status = await checkAuthStatus()
      if (status.authenticated && status.user) {
        setUser(status.user)
      } else if (storedUser) {
        // Stored user but server says not authenticated - try refresh
        await tryRefreshToken()
      }
    } catch (err) {
      console.error('Auth init failed:', err)
      // Try refresh token as fallback
      await tryRefreshToken()
    } finally {
      setLoading(false)
    }
  }, [])

  const tryRefreshToken = useCallback(async () => {
    try {
      const result = await refreshAccessToken()
      updateAccessToken(result.access_token)
      // Fetch user again with new token
      const userData = await getCurrentUser()
      setUser(userData)
    } catch {
      // Refresh failed - clear storage
      clearAuthStorage()
      setUser(null)
    }
  }, [])

  const login = useCallback(async (email: string, name: string, isFamilyHead = false) => {
    try {
      setError(null)
      const response = await devLogin(email, name, isFamilyHead)
      setAuthStorage(response.user, response.tokens)
      setUser(response.user)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed'
      setError(message)
      throw err
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiLogout()
    } catch (err) {
      console.error('Logout API error:', err)
    } finally {
      clearAuthStorage()
      setUser(null)
    }
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const userData = await getCurrentUser()
      setUser(userData)
      // Update stored user
      if (typeof window !== 'undefined') {
        localStorage.setItem('nxtvue_user', JSON.stringify(userData))
      }
    } catch (err) {
      console.error('Failed to refresh user:', err)
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        logout,
        refreshUser,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}