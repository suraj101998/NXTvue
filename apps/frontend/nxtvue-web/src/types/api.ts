// ─── Re-export from validators for backward compatibility ──────────────────────

export {
  type SseStatus,
  type SseEvent,
  type KeyMetrics,
  type AnalysisResult,
  type CompareResult,
  type PortfolioHolding,
  type PortfolioSummary,
  type PortfolioMetrics,
  type PortfolioResult,
  type IndexQuote,
  type IndicesData,
} from '@/api/validators'

// Legacy ApiError interface (deprecated - use ApiError class from @/api/errors)
export interface ApiError {
  message: string
  status: number
}