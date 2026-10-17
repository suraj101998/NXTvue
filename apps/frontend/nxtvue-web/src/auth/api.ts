// ─── Auth API ──────────────────────────────────────────────────────────────────

import { apiGet, apiPost } from '@/api/client'
import type {
  User,
  TokenPair,
  AuthResponse,
  RefreshResponse,
  UserResponse,
  AuthStatusResponse,
  LoginResponse,
} from './types'

const AUTH_BASE = '/api/v1/auth'

export async function getLoginUrl(redirectUrl: string = '/dashboard'): Promise<LoginResponse> {
  return apiGet(`${AUTH_BASE}/login?redirect_url=${encodeURIComponent(redirectUrl)}`, (data) => data as LoginResponse)
}

export async function devLogin(
  email: string = 'test@example.com',
  name: string = 'Test User',
  isFamilyHead: boolean = false
): Promise<AuthResponse> {
  return apiPost(`${AUTH_BASE}/dev-login`, { email, name, is_family_head: isFamilyHead }, (data) => data as AuthResponse)
}

export async function refreshAccessToken(refreshToken?: string): Promise<RefreshResponse> {
  return apiPost(`${AUTH_BASE}/refresh`, { refresh_token: refreshToken }, (data) => data as RefreshResponse)
}

export async function getCurrentUser(): Promise<UserResponse> {
  return apiGet(`${AUTH_BASE}/me`, (data) => data as UserResponse)
}

export async function logout(): Promise<{ message: string }> {
  return apiPost(`${AUTH_BASE}/logout`, {}, (data) => data as { message: string })
}

export async function checkAuthStatus(): Promise<AuthStatusResponse> {
  return apiGet(`${AUTH_BASE}/status`, (data) => data as AuthStatusResponse)
}

// ─── Token Storage ─────────────────────────────────────────────────────────────

const ACCESS_TOKEN_KEY = 'nxtvue_access_token'
const REFRESH_TOKEN_KEY = 'nxtvue_refresh_token'
const USER_KEY = 'nxtvue_user'

export function getStoredAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getStoredRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem(USER_KEY)
  if (!stored) return null
  try {
    return JSON.parse(stored) as User
  } catch {
    return null
  }
}

export function setAuthStorage(user: User, tokens: TokenPair): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token)
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token)
}

export function clearAuthStorage(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function updateAccessToken(accessToken: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
}