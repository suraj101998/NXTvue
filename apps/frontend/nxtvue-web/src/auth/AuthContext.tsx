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
  setAuthStorage,
  clearAuthStorage,
  getStoredUser,
} from './api'
import type { User } from './types'

// ─── Hardcoded test user (no backend required) ─────────────────────────────────
const TEST_USER: User = {
  id: 'test-user-001',
  email: 'investor@nxtvue.com',
  name: 'Arjun Sharma',
  is_family_head: true,
  avatar_url: null,
}

const TEST_TOKENS = {
  access_token: 'dev-access-token-nxtvue',
  refresh_token: 'dev-refresh-token-nxtvue',
  token_type: 'bearer',
  expires_in: 86400,
}

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
      // Use stored user if present (persists across refreshes)
      const storedUser = getStoredUser()
      if (storedUser) {
        setUser(storedUser)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const login = useCallback(async (_email: string, _name: string, _isFamilyHead = false) => {
    setError(null)
    // Always log in as the hardcoded test user — no backend required
    setAuthStorage(TEST_USER, TEST_TOKENS)
    setUser(TEST_USER)
  }, [])

  const logout = useCallback(async () => {
    clearAuthStorage()
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    // Nothing to refresh — test user is static
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