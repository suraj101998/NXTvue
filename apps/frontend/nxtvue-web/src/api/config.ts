// ─── Environment Configuration ──────────────────────────────────────────────────

interface EnvConfig {
  apiBaseUrl: string
  wsBaseUrl: string
  appEnv: 'development' | 'staging' | 'production'
  enableMockData: boolean
  logLevel: 'debug' | 'info' | 'warn' | 'error'
}

function getEnvConfig(): EnvConfig {
  const mode = import.meta.env.MODE || 'development'
  const isDev = mode === 'development'

  // Vite exposes env vars prefixed with VITE_
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ||
    (isDev ? '' : '/api') // Empty string in dev uses Vite proxy

  const wsBaseUrl = import.meta.env.VITE_WS_BASE_URL ||
    (isDev ? '' : '/api') // Empty string in dev uses Vite proxy

  return {
    apiBaseUrl,
    wsBaseUrl,
    appEnv: (import.meta.env.VITE_APP_ENV as EnvConfig['appEnv']) || 'development',
    enableMockData: import.meta.env.VITE_ENABLE_MOCK_DATA === 'true' || isDev,
    logLevel: (import.meta.env.VITE_LOG_LEVEL as EnvConfig['logLevel']) || (isDev ? 'debug' : 'warn'),
  }
}

export const envConfig = getEnvConfig()

// ─── API URL Builder ────────────────────────────────────────────────────────────

export function buildApiUrl(path: string): string {
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const base = envConfig.apiBaseUrl.replace(/\/+$/, '')
  return `${base}${normalizedPath}`
}

export function buildWsUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const base = envConfig.wsBaseUrl.replace(/\/+$/, '')
  // Convert http(s) to ws(s)
  const wsBase = base.replace(/^http/, 'ws')
  return `${wsBase}${normalizedPath}`
}

// ─── Logger ─────────────────────────────────────────────────────────────────────

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const currentLogLevel = LOG_LEVELS[envConfig.logLevel]

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= currentLogLevel
}

export const logger = {
  debug: (...args: unknown[]) => {
    if (shouldLog('debug')) console.debug('[DEBUG]', ...args)
  },
  info: (...args: unknown[]) => {
    if (shouldLog('info')) console.info('[INFO]', ...args)
  },
  warn: (...args: unknown[]) => {
    if (shouldLog('warn')) console.warn('[WARN]', ...args)
  },
  error: (...args: unknown[]) => {
    if (shouldLog('error')) console.error('[ERROR]', ...args)
  },
}

// ─── Feature Flags ──────────────────────────────────────────────────────────────

export const features = {
  useWebSocketForIndices: false, // Future: WebSocket alternative to polling
  enableRealChat: false, // Will be enabled in Phase 4
  enablePortfolioSync: false, // Will be enabled in Phase 3
  enableWatchlistSync: false, // Will be enabled in Phase 3
  enableAnalysisHistory: false, // Will be enabled in Phase 3
}