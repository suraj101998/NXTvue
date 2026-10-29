import type { SseEvent } from '@/types/api'
import { validateSseEvent } from './validators'
import { ApiError, withRetry } from './errors'
import { buildApiUrl, logger } from './config'

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface SseStreamOptions {
  maxRetries?: number
  baseDelayMs?: number
  onRetry?: (attempt: number, error: Error) => void
}

export interface FetchOptions extends RequestInit {
  timeoutMs?: number
  validateStatus?: (status: number) => boolean
}

// ─── SSE over GET (EventSource) with Reconnection ───────────────────────────────

/**
 * Open an SSE stream to a GET endpoint using the native EventSource API.
 * Includes automatic reconnection with exponential backoff.
 * Returns a cleanup function — call it to close the connection.
 */
export function openSseStream(
  url: string,
  onEvent: (e: SseEvent) => void,
  onError: (e: Error) => void,
  options: SseStreamOptions = {}
): () => void {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    onRetry,
  } = options

  let retryCount = 0
  let isClosed = false
  let source: EventSource | null = null

  const fullUrl = buildApiUrl(url)

  const connect = () => {
    if (isClosed) return

    source = new EventSource(fullUrl)

    source.onmessage = (ev) => {
      try {
        const data = validateSseEvent(JSON.parse(ev.data))
        onEvent(data)

        // Close after terminal events
        if (data.status === 'complete' || data.status === 'error') {
          source?.close()
          source = null
        }
      } catch (err) {
        const parseError = err instanceof Error ? err : new Error(String(err))
        logger.error('SSE parse error:', parseError)
        onError(ApiError.sseParseError(parseError))
        source?.close()
        source = null
      }
    }

    source.onerror = (err) => {
      if (isClosed) return

      logger.warn('SSE connection error, retry:', retryCount + 1)
      source?.close()
      source = null

      if (retryCount < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, retryCount)
        retryCount++

        onRetry?.(retryCount, new Error('SSE connection lost'))

        setTimeout(() => {
          if (!isClosed) connect()
        }, delay)
      } else {
        onError(ApiError.sseConnectionLost(err instanceof Error ? err : undefined))
      }
    }
  }

  connect()

  return () => {
    isClosed = true
    source?.close()
    source = null
  }
}

// ─── SSE over POST (fetch + ReadableStream) with Reconnection ───────────────────

/**
 * Open an SSE stream to a POST endpoint (e.g. file upload).
 * Manually reads the chunked response and parses `data: {...}` lines.
 * Includes automatic reconnection for retriable errors.
 * Returns an AbortController — call `.abort()` to cancel.
 */
export function openSsePost(
  url: string,
  body: FormData,
  onEvent: (e: SseEvent) => void,
  onError: (e: Error) => void,
  options: SseStreamOptions = {}
): AbortController {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    onRetry,
  } = options

  const controller = new AbortController()
  let retryCount = 0
  let isAborted = false

  const fullUrl = buildApiUrl(url)

  const connect = async () => {
    if (isAborted) return

    let response: Response
    try {
      response = await fetch(fullUrl, {
        method: 'POST',
        body,
        signal: controller.signal,
      })
    } catch (err) {
      if (isAborted || (err as Error).name === 'AbortError') return

      const error = err instanceof Error ? err : new Error(String(err))
      logger.error('SSE POST fetch error:', error)

      if (retryCount < maxRetries && ApiError.fromError(error).retryable) {
        const delay = baseDelayMs * Math.pow(2, retryCount)
        retryCount++
        onRetry?.(retryCount, error)
        setTimeout(connect, delay)
      } else {
        onError(ApiError.fromError(error))
      }
      return
    }

    if (!response.ok) {
      const apiError = ApiError.fromResponse(response)
      logger.error('SSE POST HTTP error:', apiError)

      if (retryCount < maxRetries && apiError.retryable) {
        const delay = baseDelayMs * Math.pow(2, retryCount)
        retryCount++
        onRetry?.(retryCount, apiError)
        setTimeout(connect, delay)
      } else {
        onError(apiError)
      }
      return
    }

    const reader = response.body?.getReader()
    if (!reader) {
      onError(new Error('No response body'))
      return
    }

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        if (isAborted) break

        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // SSE lines end with \n\n — split and process complete events
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? '' // keep incomplete last chunk

        for (const part of parts) {
          for (const line of part.split('\n')) {
            if (line.startsWith('data: ')) {
              try {
                const data = validateSseEvent(JSON.parse(line.slice(6)))
                onEvent(data)
                if (data.status === 'complete' || data.status === 'error') {
                  reader.cancel()
                  return
                }
              } catch {
                // ignore malformed lines
              }
            }
          }
        }
      }
    } catch (err) {
      if (isAborted || (err as Error).name === 'AbortError') return

      const error = err instanceof Error ? err : new Error(String(err))
      logger.error('SSE POST stream error:', error)

      if (retryCount < maxRetries && ApiError.fromError(error).retryable) {
        const delay = baseDelayMs * Math.pow(2, retryCount)
        retryCount++
        onRetry?.(retryCount, error)
        setTimeout(connect, delay)
      } else {
        onError(ApiError.fromError(error))
      }
    }
  }

  connect()

  // Wrap abort to prevent further retries
  const originalAbort = controller.abort.bind(controller)
  controller.abort = (reason?: unknown) => {
    isAborted = true
    originalAbort(reason)
  }

  return controller
}

// ─── REST API Client with Validation & Retry ────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 30000

async function fetchWithTimeout(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, validateStatus, ...fetchOptions } = options

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    })

    if (validateStatus && !validateStatus(response.status)) {
      throw ApiError.fromResponse(response)
    }

    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function apiGet<T>(
  path: string,
  validator: (data: unknown) => T,
  options: FetchOptions = {}
): Promise<T> {
  const url = buildApiUrl(path)

  return withRetry(async () => {
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...options.headers,
      },
      ...options,
    })

    const data = await response.json()
    return validator(data)
  }, {
    maxRetries: options.timeoutMs ? 0 : 2, // Don't retry if custom timeout (likely user-initiated)
    onRetry: (attempt, error) => logger.info(`Retry ${attempt} for GET ${path}:`, error.message),
  })
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  validator: (data: unknown) => T,
  options: FetchOptions = {}
): Promise<T> {
  const url = buildApiUrl(path)

  return withRetry(async () => {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(body),
      ...options,
    })

    const data = await response.json()
    return validator(data)
  }, {
    onRetry: (attempt, error) => logger.info(`Retry ${attempt} for POST ${path}:`, error.message),
  })
}

export async function apiPostForm<T>(
  path: string,
  body: FormData,
  validator: (data: unknown) => T,
  options: FetchOptions = {}
): Promise<T> {
  const url = buildApiUrl(path)

  return withRetry(async () => {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        ...options.headers,
      },
      body,
      ...options,
    })

    const data = await response.json()
    return validator(data)
  }, {
    onRetry: (attempt, error) => logger.info(`Retry ${attempt} for POST ${path}:`, error.message),
  })
}

// ─── Health Check ────────────────────────────────────────────────────────────────

import { HealthResponseSchema, type HealthResponse } from './validators'

export async function checkHealth(): Promise<HealthResponse> {
  return apiGet('/api/v1/health', (data) => HealthResponseSchema.parse(data))
}

// ─── Indices ─────────────────────────────────────────────────────────────────────

import { IndicesDataSchema, type IndicesData } from './validators'

export async function fetchIndices(): Promise<IndicesData> {
  return apiGet('/api/v1/indices', (data) => IndicesDataSchema.parse(data))
}

// ─── Report Download ─────────────────────────────────────────────────────────────

export function getReportUrl(filename: string): string {
  return buildApiUrl(`/api/v1/reports/${encodeURIComponent(filename)}`)
}

// ─── Portfolio Intelligence ──────────────────────────────────────────────────────

import {
  PortfolioIntelligenceSchema,
  type PortfolioIntelligenceResponse,
  PortfolioResponseSchema,
  type PortfolioResponse,
  WatchlistResponseSchema,
  type WatchlistResponse,
  AnalysisHistoryResponseSchema,
  type AnalysisHistoryResponse,
  SearchResponseSchema,
  type SearchResponse,
} from './validators'

export async function fetchPortfolioIntelligence(): Promise<PortfolioIntelligenceResponse> {
  return apiGet('/api/v1/portfolio/intelligence', (data) => PortfolioIntelligenceSchema.parse(data))
}

// ─── Portfolio ────────────────────────────────────────────────────────────────────

export async function fetchPortfolioHoldings(): Promise<PortfolioResponse> {
  return apiGet('/api/v1/portfolio/holdings', (data) => PortfolioResponseSchema.parse(data))
}

export async function syncPortfolio(source: string = 'indmoney', holdings?: Array<{ ticker: string; qty: number; avg_cost: number; market?: string }>): Promise<any> {
  return apiPost('/api/v1/portfolio/sync', { source, holdings }, (data) => data)
}

export async function fetchWatchlist(): Promise<WatchlistResponse> {
  return apiGet('/api/v1/portfolio/watchlist', (data) => WatchlistResponseSchema.parse(data))
}

export async function addToWatchlist(ticker: string, name?: string, market: string = 'india'): Promise<WatchlistResponse> {
  return apiPost('/api/v1/portfolio/watchlist', { ticker, name, market }, (data) => WatchlistResponseSchema.parse(data))
}

export async function removeFromWatchlist(ticker: string): Promise<WatchlistResponse> {
  return apiPost(`/api/v1/portfolio/watchlist/${ticker}`, { _method: 'DELETE' }, (data) => WatchlistResponseSchema.parse(data))
}

export async function fetchAnalysisHistory(page: number = 1, pageSize: number = 10, analysisType?: string): Promise<AnalysisHistoryResponse> {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
  if (analysisType) params.append('analysis_type', analysisType)
  return apiGet(`/api/v1/portfolio/analysis/history?${params.toString()}`, (data) => AnalysisHistoryResponseSchema.parse(data))
}

export async function searchTickers(query: string, limit: number = 10): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query, limit: String(limit) })
  return apiGet(`/api/v1/portfolio/search?${params.toString()}`, (data) => SearchResponseSchema.parse(data))
}

// ─── INDmoney ─────────────────────────────────────────────────────────────────────

import {
  IndMoneySnapshotSchema,
  IndMoneyAllHoldingsSchema,
  IndMoneyWatchlistResponseSchema,
  IndMoneyHoldingsGroupSchema,
  type IndMoneySnapshot,
  type IndMoneyAllHoldings,
  type IndMoneyWatchlistResponse,
  type IndMoneyHoldingsGroup,
} from './validators'

export async function fetchIndMoneySnapshot(): Promise<IndMoneySnapshot> {
  return apiGet('/api/v1/indmoney/snapshot', (data) => IndMoneySnapshotSchema.parse(data))
}

export async function fetchIndMoneyAllHoldings(bustCache = false): Promise<IndMoneyAllHoldings> {
  const path = bustCache ? '/api/v1/indmoney/holdings?refresh=true' : '/api/v1/indmoney/holdings'
  return apiGet(path, (data) => IndMoneyAllHoldingsSchema.parse(data))
}

export async function fetchIndMoneyHoldingsByType(assetType: string): Promise<IndMoneyHoldingsGroup> {
  return apiGet(
    `/api/v1/indmoney/holdings/${encodeURIComponent(assetType)}`,
    (data) => IndMoneyHoldingsGroupSchema.parse(data),
  )
}

export async function fetchIndMoneyWatchlist(): Promise<IndMoneyWatchlistResponse> {
  return apiGet('/api/v1/indmoney/watchlist', (data) => IndMoneyWatchlistResponseSchema.parse(data))
}

export interface GeneratedReportItem {
  filename: string
  ticker: string
  size: number
  updated_at: number
  url: string
}

export async function fetchGeneratedReports(): Promise<{ reports: GeneratedReportItem[] }> {
  return apiGet('/api/v1/reports', (data) => data as { reports: GeneratedReportItem[] })
}

export type {
  IndMoneySnapshot,
  IndMoneyAllHoldings,
  IndMoneyHoldingsGroup,
  IndMoneyWatchlistResponse,
} from './validators'

// ─── Re-export types ─────────────────────────────────────────────────────────────

export type { IndicesData, IndexQuote, HealthResponse, PortfolioIntelligenceResponse } from './validators'