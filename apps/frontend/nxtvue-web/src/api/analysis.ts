import type { SseEvent } from '@/types/api'
import { openSsePost, openSseStream } from './client'
import { validateAnalysisResult, validateCompareResult, validatePortfolioResult } from './validators'
import type { AnalysisResult, CompareResult, PortfolioResult } from './validators'

// ─── URL builders ─────────────────────────────────────────────────────────────

export function stockStreamUrl(ticker: string, market: string, year: number): string {
  return `/api/v1/stream/stock?ticker=${encodeURIComponent(ticker)}&market=${encodeURIComponent(market)}&year=${year}`
}

export function compareStreamUrl(
  a: string,
  ma: string,
  b: string,
  mb: string,
  year: number,
): string {
  return (
    `/api/v1/stream/compare?a=${encodeURIComponent(a)}&ma=${encodeURIComponent(ma)}` +
    `&b=${encodeURIComponent(b)}&mb=${encodeURIComponent(mb)}&year=${year}`
  )
}

export function portfolioDefaultStreamUrl(year: number): string {
  return `/api/v1/stream/portfolio/default?year=${year}`
}

// ─── Stream openers with validation ───────────────────────────────────────────

/** Open SSE stream for a single stock analysis (GET). Returns cleanup fn. */
export function openStockStream(
  ticker: string,
  market: string,
  year: number,
  onEvent: (e: SseEvent) => void,
  onError: (e: Error) => void,
  options?: { maxRetries?: number; baseDelayMs?: number; onRetry?: (attempt: number, error: Error) => void }
): () => void {
  const originalOnEvent = onEvent
  const wrappedOnEvent = (event: SseEvent) => {
    if (event.status === 'complete' && event.result) {
      // Validate the result
      const validated = validateAnalysisResult(event.result)
      if (validated) {
        originalOnEvent({ ...event, result: validated })
      } else {
        onError(new Error('Invalid analysis result from server'))
      }
    } else {
      originalOnEvent(event)
    }
  }

  return openSseStream(stockStreamUrl(ticker, market, year), wrappedOnEvent, onError, options)
}

/** Open SSE stream for a comparison analysis (GET). Returns cleanup fn. */
export function openCompareStream(
  a: string,
  ma: string,
  b: string,
  mb: string,
  year: number,
  onEvent: (e: SseEvent) => void,
  onError: (e: Error) => void,
  options?: { maxRetries?: number; baseDelayMs?: number; onRetry?: (attempt: number, error: Error) => void }
): () => void {
  const originalOnEvent = onEvent
  const wrappedOnEvent = (event: SseEvent) => {
    if (event.status === 'complete' && event.result) {
      const validated = validateCompareResult(event.result)
      if (validated) {
        originalOnEvent({ ...event, result: validated })
      } else {
        onError(new Error('Invalid comparison result from server'))
      }
    } else {
      originalOnEvent(event)
    }
  }

  return openSseStream(compareStreamUrl(a, ma, b, mb, year), wrappedOnEvent, onError, options)
}

/** Open SSE stream for the default server-side portfolio (GET). Returns cleanup fn. */
export function openPortfolioDefaultStream(
  year: number,
  onEvent: (e: SseEvent) => void,
  onError: (e: Error) => void,
  options?: { maxRetries?: number; baseDelayMs?: number; onRetry?: (attempt: number, error: Error) => void }
): () => void {
  const originalOnEvent = onEvent
  const wrappedOnEvent = (event: SseEvent) => {
    if (event.status === 'complete' && event.result) {
      const validated = validatePortfolioResult(event.result)
      if (validated) {
        originalOnEvent({ ...event, result: validated })
      } else {
        onError(new Error('Invalid portfolio result from server'))
      }
    } else {
      originalOnEvent(event)
    }
  }

  return openSseStream(portfolioDefaultStreamUrl(year), wrappedOnEvent, onError, options)
}

/** Open SSE stream for a portfolio file upload (POST multipart). Returns AbortController. */
export function openPortfolioUploadStream(
  file: File,
  year: number,
  onEvent: (e: SseEvent) => void,
  onError: (e: Error) => void,
  options?: { maxRetries?: number; baseDelayMs?: number; onRetry?: (attempt: number, error: Error) => void }
): AbortController {
  const body = new FormData()
  body.append('file', file)

  const originalOnEvent = onEvent
  const wrappedOnEvent = (event: SseEvent) => {
    if (event.status === 'complete' && event.result) {
      const validated = validatePortfolioResult(event.result)
      if (validated) {
        originalOnEvent({ ...event, result: validated })
      } else {
        onError(new Error('Invalid portfolio result from server'))
      }
    } else {
      originalOnEvent(event)
    }
  }

  return openSsePost(`/api/v1/stream/portfolio?year=${year}`, body, wrappedOnEvent, onError, options)
}

// ─── REST API endpoints ───────────────────────────────────────────────────────

import { apiGet, apiPost } from './client'
import { AnalysisResultSchema, CompareResultSchema, PortfolioResultSchema } from './validators'

export async function fetchAnalysis(ticker: string, market: string, year: number): Promise<AnalysisResult> {
  return apiGet(
    `/api/v1/analysis/stock?ticker=${encodeURIComponent(ticker)}&market=${encodeURIComponent(market)}&year=${year}`,
    (data) => AnalysisResultSchema.parse(data)
  )
}

export async function fetchCompare(
  tickerA: string,
  marketA: string,
  tickerB: string,
  marketB: string,
  year: number
): Promise<CompareResult> {
  return apiGet(
    `/api/v1/analysis/compare?ticker_a=${encodeURIComponent(tickerA)}&market_a=${encodeURIComponent(marketA)}&ticker_b=${encodeURIComponent(tickerB)}&market_b=${encodeURIComponent(marketB)}&year=${year}`,
    (data) => CompareResultSchema.parse(data)
  )
}

export async function fetchPortfolioAnalysis(holdings: Array<{ ticker: string; qty: number; avg_cost: number; market?: string }>, year: number): Promise<PortfolioResult> {
  return apiPost('/api/v1/analysis/portfolio', { holdings, year }, (data) => PortfolioResultSchema.parse(data))
}

// ─── PDF download URL (no fetch — used as <a href> target) ───────────────────

export function getReportUrl(filename: string): string {
  return `/api/v1/reports/${encodeURIComponent(filename)}`
}