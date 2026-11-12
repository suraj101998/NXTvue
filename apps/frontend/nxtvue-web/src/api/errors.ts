// ─── Error Classes ──────────────────────────────────────────────────────────────

export type ApiErrorCode =
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'SERVER_ERROR'
  | 'RATE_LIMITED'
  | 'INDMONEY_REAUTH'
  | 'SSE_PARSE_ERROR'
  | 'SSE_CONNECTION_LOST'
  | 'UNKNOWN_ERROR'

export interface ApiErrorDetails {
  code: ApiErrorCode
  status: number
  message: string
  originalError?: Error
  retryable: boolean
  retryAfter?: number // seconds
  /** Machine code the backend sent in `detail.code`, e.g. indmoney_reauth_required. */
  serverCode?: string
  /** Human message the backend sent in `detail` / `detail.message`. */
  serverMessage?: string
}

/** Backend `detail` is either a plain string or an object like { code, reason, message }. */
function readDetail(body: unknown): { code?: string; message?: string } {
  if (!body || typeof body !== 'object' || !('detail' in body)) return {}
  const d = (body as { detail: unknown }).detail
  if (typeof d === 'string') return { message: d }
  if (d && typeof d === 'object') {
    const o = d as Record<string, unknown>
    return {
      code: typeof o.code === 'string' ? o.code : undefined,
      message: typeof o.message === 'string' ? o.message : undefined,
    }
  }
  return {}
}

export class ApiError extends Error {
  public readonly code: ApiErrorCode
  public readonly status: number
  public readonly retryable: boolean
  public readonly retryAfter?: number
  public readonly originalError?: Error
  public readonly serverCode?: string
  public readonly serverMessage?: string

  constructor(details: ApiErrorDetails) {
    super(details.message)
    this.name = 'ApiError'
    this.code = details.code
    this.status = details.status
    this.retryable = details.retryable
    this.retryAfter = details.retryAfter
    this.originalError = details.originalError
    this.serverCode = details.serverCode
    this.serverMessage = details.serverMessage
  }

  static fromResponse(response: Response, body?: unknown): ApiError {
    const status = response.status
    let code: ApiErrorCode = 'UNKNOWN_ERROR'
    let message = `HTTP ${status}: ${response.statusText}`
    let retryable = false
    let retryAfter: number | undefined

    const server = readDetail(body)
    const retryAfterHeader = response.headers.get('Retry-After')
    if (retryAfterHeader) {
      retryAfter = parseInt(retryAfterHeader, 10)
    }

    switch (status) {
      case 0:
        code = 'NETWORK_ERROR'
        message = 'Network error. Please check your connection.'
        retryable = true
        break
      case 400:
        code = 'VALIDATION_ERROR'
        message = body && typeof body === 'object' && 'detail' in body
          ? String(body.detail)
          : 'Invalid request. Please check your input.'
        break
      case 401:
        code = 'UNAUTHORIZED'
        message = 'Session expired. Please log in again.'
        break
      case 403:
        code = 'FORBIDDEN'
        message = 'You do not have permission to perform this action.'
        break
      case 404:
        code = 'NOT_FOUND'
        message = 'The requested resource was not found.'
        break
      case 424:
        if (server.code === 'indmoney_reauth_required') {
          code = 'INDMONEY_REAUTH'
          message = server.message ?? 'Your INDmoney connection has expired. Reconnect to see live portfolio data.'
          break
        }
        code = 'UNKNOWN_ERROR'
        message = server.message ?? `Unexpected error (${status})`
        break
      case 429:
        code = 'RATE_LIMITED'
        message = 'Too many requests. Please wait a moment.'
        retryable = true
        break
      case 500:
      case 502:
      case 503:
      case 504:
        code = 'SERVER_ERROR'
        message = 'Server error. Please try again later.'
        retryable = true
        break
      default:
        code = 'UNKNOWN_ERROR'
        message = `Unexpected error (${status})`
    }

    return new ApiError({ code, status, message, retryable, retryAfter, serverCode: server.code, serverMessage: server.message })
  }

  static fromError(error: Error, defaultCode: ApiErrorCode = 'UNKNOWN_ERROR'): ApiError {
    if (error instanceof ApiError) return error

    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return new ApiError({
        code: 'TIMEOUT',
        status: 0,
        message: 'Request timed out. Please try again.',
        originalError: error,
        retryable: true,
      })
    }

    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return new ApiError({
        code: 'NETWORK_ERROR',
        status: 0,
        message: 'Network error. Please check your connection.',
        originalError: error,
        retryable: true,
      })
    }

    return new ApiError({
      code: defaultCode,
      status: 0,
      message: error.message || 'An unexpected error occurred',
      originalError: error,
      retryable: false,
    })
  }

  static sseParseError(originalError: Error): ApiError {
    return new ApiError({
      code: 'SSE_PARSE_ERROR',
      status: 0,
      message: 'Failed to parse server response. Please try again.',
      originalError,
      retryable: true,
    })
  }

  static sseConnectionLost(originalError?: Error): ApiError {
    return new ApiError({
      code: 'SSE_CONNECTION_LOST',
      status: 0,
      message: 'Connection to server lost. Reconnecting...',
      originalError,
      retryable: true,
    })
  }

  // User-friendly message for display
  get userMessage(): string {
    switch (this.code) {
      case 'NETWORK_ERROR':
        return 'Unable to connect. Please check your internet connection.'
      case 'TIMEOUT':
        return 'Request took too long. Please try again.'
      case 'UNAUTHORIZED':
        return 'Your session has expired. Please log in again.'
      case 'FORBIDDEN':
        return 'You do not have permission to access this resource.'
      case 'NOT_FOUND':
        return 'The requested resource was not found.'
      case 'VALIDATION_ERROR':
        return this.message
      case 'RATE_LIMITED':
        return 'Too many requests. Please wait a moment and try again.'
      case 'INDMONEY_REAUTH':
        return this.message
      case 'SERVER_ERROR':
        return 'Our servers are experiencing issues. Please try again later.'
      case 'SSE_PARSE_ERROR':
        return 'Received invalid data from server. Please try again.'
      case 'SSE_CONNECTION_LOST':
        return 'Connection lost. Attempting to reconnect...'
      default:
        return this.message
    }
  }

  // Whether to show retry button in UI
  get shouldShowRetry(): boolean {
    return this.retryable && this.code !== 'UNAUTHORIZED' && this.code !== 'FORBIDDEN'
  }

  /** The INDmoney link was revoked or expired: retrying cannot help, the user has to sign in again. */
  get needsReconnect(): boolean {
    return this.code === 'INDMONEY_REAUTH'
  }
}

// ─── Error Handler ──────────────────────────────────────────────────────────────

export function handleApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (error instanceof Response) return ApiError.fromResponse(error)
  if (error instanceof Error) return ApiError.fromError(error)
  return new ApiError({
    code: 'UNKNOWN_ERROR',
    status: 0,
    message: String(error),
    retryable: false,
  })
}

// ─── Retry Utility ──────────────────────────────────────────────────────────────

export interface RetryOptions {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
  retryableCodes: ApiErrorCode[]
  onRetry?: (attempt: number, error: ApiError) => void
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableCodes: ['NETWORK_ERROR', 'TIMEOUT', 'SERVER_ERROR', 'RATE_LIMITED', 'SSE_CONNECTION_LOST'],
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options }
  let lastError: ApiError | undefined

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      const apiError = handleApiError(error)
      lastError = apiError

      if (attempt === opts.maxRetries || !opts.retryableCodes.includes(apiError.code)) {
        throw apiError
      }

      const delay = Math.min(
        opts.baseDelayMs * Math.pow(opts.backoffMultiplier, attempt),
        opts.maxDelayMs
      )

      opts.onRetry?.(attempt + 1, apiError)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError!
}