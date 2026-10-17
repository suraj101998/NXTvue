// ─── Auth Types ────────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  name: string
  avatar_url?: string | null
  is_family_head: boolean
}

export interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export interface AuthResponse {
  user: User
  tokens: TokenPair
}

export interface RefreshResponse {
  access_token: string
  token_type: string
  expires_in: number
}

export interface UserResponse {
  id: string
  email: string
  name: string
  avatar_url?: string | null
  is_family_head: boolean
}

export interface AuthStatusResponse {
  authenticated: boolean
  user?: User
}

export interface LoginResponse {
  message: string
  oauth_url: string
  state: string
  dev_note?: string
}