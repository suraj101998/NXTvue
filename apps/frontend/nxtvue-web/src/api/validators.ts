import { z } from 'zod'

// ─── Shared Schemas ─────────────────────────────────────────────────────────────

export const KeyMetricsSchema = z.object({
  current_price: z.number().nullable().optional(),
  market_cap: z.number().nullable().optional(),
  sector: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  pe_ratio: z.number().nullable().optional(),
  ttm_pe: z.number().nullable().optional(),
  forward_pe: z.number().nullable().optional(),
  peg_ratio: z.number().nullable().optional(),
  price_to_book: z.number().nullable().optional(),
  debt_to_equity: z.number().nullable().optional(),
  current_ratio: z.number().nullable().optional(),
  return_on_equity: z.number().nullable().optional(),
  return_on_assets: z.number().nullable().optional(),
  profit_margins: z.number().nullable().optional(),
  operating_margins: z.number().nullable().optional(),
  revenue_growth: z.number().nullable().optional(),
  earnings_growth: z.number().nullable().optional(),
  free_cashflow: z.number().nullable().optional(),
  operating_cashflow: z.number().nullable().optional(),
  short_percent_of_float: z.number().nullable().optional(),
  short_ratio: z.number().nullable().optional(),
  beta: z.number().nullable().optional(),
  dividend_yield: z.number().nullable().optional(),
  full_time_employees: z.number().nullable().optional(),
  long_business_summary: z.string().nullable().optional(),
}).passthrough()

// ─── SSE Event Schemas ──────────────────────────────────────────────────────────

export const SseStatusSchema = z.enum(['fetching', 'analyzing', 'complete', 'error'])

export const SseEventSchema = z.object({
  status: SseStatusSchema,
  message: z.string(),
  progress: z.number().int().min(0).max(100),
  result: z.unknown().optional(),
})

// ─── Stock Analysis ─────────────────────────────────────────────────────────────

export const AnalysisResultSchema = z.object({
  ticker: z.string(),
  market: z.string(),
  asset_type: z.string().optional(),
  projection_year: z.number().int(),
  final_memo: z.string(),
  key_metrics: KeyMetricsSchema,
  pdf_path: z.string().nullable().optional(),
})

// ─── Comparison ─────────────────────────────────────────────────────────────────

export const CompareResultSchema = z.object({
  ticker_a: z.string(),
  ticker_b: z.string(),
  market_a: z.string(),
  market_b: z.string(),
  projection_year: z.number().int(),
  final_memo: z.string(),
  pdf_path: z.string().nullable().optional(),
})

// ─── Portfolio ──────────────────────────────────────────────────────────────────

export const PortfolioHoldingSchema = z.object({
  ticker: z.string(),
  company_name: z.string(),
  market: z.string(),
  qty: z.number(),
  avg_cost: z.number(),
  current_price: z.number().nullable().optional(),
  invested: z.number(),
  current_value: z.number(),
  unrealised_pnl: z.number(),
  gain_pct: z.number().nullable().optional(),
  weight_pct: z.number(),
})

export const PortfolioSummarySchema = z.object({
  total_invested: z.number(),
  total_value: z.number(),
  total_pnl: z.number(),
  total_gain_pct: z.number(),
  num_holdings: z.number().int(),
})

export const PortfolioMetricsSchema = z.object({
  summary: PortfolioSummarySchema,
  holdings: z.array(PortfolioHoldingSchema),
  market_allocation: z.record(z.string(), z.number()),
  top_gainers: z.array(z.object({ ticker: z.string(), gain_pct: z.number() })),
  top_losers: z.array(z.object({ ticker: z.string(), gain_pct: z.number() })),
  concentration_flags: z.array(z.string()),
  rebalancing_signals: z.array(z.string()),
})

export const PortfolioResultSchema = z.object({
  type: z.literal('portfolio'),
  projection_year: z.number().int(),
  metrics: PortfolioMetricsSchema,
  final_memo: z.string(),
  pdf_path: z.string().nullable().optional(),
})

// ─── Market Indices ─────────────────────────────────────────────────────────────

export const IndexQuoteSchema = z.object({
  name: z.string(),
  value: z.number(),
  change: z.number(),
  changePct: z.number(),
  positive: z.boolean(),
  source: z.string(),
})

export const IndicesDataSchema = z.object({
  india: z.array(IndexQuoteSchema),
  us: z.array(IndexQuoteSchema),
  updated_at: z.number().int(),
  cache_ttl: z.number().int(),
})

// ─── Health ─────────────────────────────────────────────────────────────────────

export const HealthResponseSchema = z.object({
  status: z.string(),
  version: z.string(),
  services: z.object({
    database: z.boolean(),
    cache: z.boolean(),
    llm: z.boolean(),
    data_providers: z.boolean(),
  }),
})

// ─── Portfolio Holdings ──────────────────────────────────────────────────────────

export const PortfolioHoldingResponseSchema = z.object({
  ticker: z.string(),
  company_name: z.string(),
  market: z.string(),
  qty: z.number(),
  avg_cost: z.number(),
  current_price: z.number().nullable().optional(),
  invested: z.number(),
  current_value: z.number(),
  unrealised_pnl: z.number(),
  gain_pct: z.number().nullable().optional(),
  weight_pct: z.number(),
})

export const PortfolioSummaryResponseSchema = z.object({
  total_invested: z.number(),
  total_value: z.number(),
  total_pnl: z.number(),
  total_gain_pct: z.number(),
  num_holdings: z.number().int(),
  best_performer: z.string().nullable().optional(),
  worst_performer: z.string().nullable().optional(),
})

export const PortfolioResponseSchema = z.object({
  user_id: z.string(),
  holdings: z.array(PortfolioHoldingResponseSchema),
  summary: PortfolioSummaryResponseSchema,
  market_allocation: z.record(z.string(), z.number()),
  sector_allocation: z.record(z.string(), z.number()),
  last_synced: z.string().nullable().optional(),
  data_source: z.string(),
})

// ─── Watchlist ────────────────────────────────────────────────────────────────────

export const WatchlistItemSchema = z.object({
  ticker: z.string(),
  name: z.string(),
  market: z.string(),
  added_at: z.string().optional(),
})

export const WatchlistResponseSchema = z.object({
  items: z.array(WatchlistItemSchema),
})

// ─── Analysis History ─────────────────────────────────────────────────────────────

export const AnalysisHistoryItemSchema = z.object({
  id: z.string(),
  ticker: z.string(),
  market: z.string(),
  analysis_type: z.string(),
  created_at: z.string(),
  projection_year: z.number().int(),
  status: z.string(),
  pdf_path: z.string().nullable().optional(),
})

export const AnalysisHistoryResponseSchema = z.object({
  items: z.array(AnalysisHistoryItemSchema),
  total: z.number().int(),
  page: z.number().int(),
  page_size: z.number().int(),
})

// ─── Portfolio Intelligence ─────────────────────────────────────────────────────

export const PortfolioIntelligenceSchema = z.object({
  health_score: z.number(),
  health_label: z.string(),
  diversification: z.object({
    score: z.number(),
    assets: z.number(),
    asset_classes: z.number(),
    sectors: z.number(),
    geographies: z.number(),
  }),
  risk: z.record(z.string(), z.string()),
  concentration: z.object({
    top5: z.string(),
    top10: z.string(),
    hhi: z.number(),
    largest_position: z.object({
      symbol: z.string(),
      weight: z.string(),
    }),
  }),
  sector_concentration: z.array(z.object({
    sector: z.string(),
    weight: z.string(),
    benchmark: z.string(),
    deviation: z.string(),
  })),
  currency_exposure: z.array(z.object({
    currency: z.string(),
    weight: z.string(),
    hedged: z.string(),
  })),
  etf_overlap: z.array(z.object({
    fund1: z.string(),
    fund2: z.string(),
    overlap: z.string(),
    shared_holdings: z.number(),
  })),
  correlation_matrix: z.object({
    assets: z.array(z.string()),
    matrix: z.array(z.array(z.number())),
  }),
  rebalancing: z.array(z.object({
    action: z.string(),
    asset: z.string(),
    current: z.string(),
    target: z.string(),
    reason: z.string(),
  })),
  drawdown_periods: z.array(z.object({
    period: z.string(),
    peak: z.string(),
    trough: z.string(),
    drawdown: z.string(),
    recovery_days: z.union([z.number(), z.string()]),
  })),
  data_gaps: z.array(z.string()),
  note: z.string(),
})

// ─── Search ──────────────────────────────────────────────────────────────────────

export const SearchResultItemSchema = z.object({
  ticker: z.string(),
  name: z.string(),
  market: z.string(),
  type: z.string(),
  price: z.number().optional(),
  change_pct: z.number().optional(),
})

export const SearchResponseSchema = z.object({
  results: z.array(SearchResultItemSchema),
})

// ─── INDmoney ────────────────────────────────────────────────────────────────────

export const IndMoneyAssetSummarySchema = z.object({
  total_value: z.number(),
  invested: z.number(),
  one_day_change: z.number(),
  one_day_change_percentage: z.number(),
  total_value_usd: z.number().nullable().optional(),
  invested_usd: z.number().nullable().optional(),
  one_day_change_usd: z.number().nullable().optional(),
})

export const IndMoneyHoldingSchema = z.object({
  investment_code: z.string().nullable().optional(),
  investment: z.string(),
  asset_type: z.string(),
  assetclass_l2: z.string().nullable().optional(),
  invested_amount: z.number(),
  market_value: z.number(),
  holding_percent: z.number(),
  total_pnl: z.number(),
  pnl_per: z.number(),
  total_units: z.number().nullable().optional(),
  unit_price: z.number().nullable().optional(),
  broker: z.string().nullable().optional(),
  market_cap: z.string().nullable().optional(),
  one_day_change: z.number(),
  one_day_change_percentage: z.number(),
})

export const IndMoneyHoldingsGroupSchema = z.object({
  holdings: z.array(IndMoneyHoldingSchema),
  asset_summary: IndMoneyAssetSummarySchema,
  fetch_error: z.string().nullable().optional(),
})

export const IndMoneyAllHoldingsSchema = z.object({
  ind_stocks: IndMoneyHoldingsGroupSchema,
  mutual_funds: IndMoneyHoldingsGroupSchema,
  bonds: IndMoneyHoldingsGroupSchema,
  fd: IndMoneyHoldingsGroupSchema,
})

export const IndMoneyInvestmentItemSchema = z.object({
  asset_type: z.string(),
  invested_value: z.number(),
  current_value: z.number(),
  return_: z.number(),
  return_percentage: z.number(),
  progress_value_percentage: z.number(),
})

export const IndMoneyAssetClassItemSchema = z.object({
  assetclass_l2: z.string(),
  invested_value: z.number(),
  current_value: z.number(),
  return_: z.number(),
  return_percentage: z.number(),
  progress_value_percentage: z.number(),
})

export const IndMoneyMarketCapItemSchema = z.object({
  market_cap: z.string(),
  invested_value: z.number(),
  current_value: z.number(),
  return_: z.number(),
  return_percentage: z.number(),
  progress_value_percentage: z.number(),
})

export const IndMoneyLoanSchema = z.object({
  lender: z.string(),
  loan_type: z.string(),
  current_balance: z.number(),
})

export const IndMoneyCreditCardSchema = z.object({
  name: z.string(),
  card_variant: z.string(),
  total_due: z.number(),
  due_date: z.string().nullable().optional(),
})

export const IndMoneyLiabilitiesSchema = z.object({
  total_loan_balance: z.number(),
  total_credit_card_due: z.number(),
  total: z.number(),
  loans: z.array(IndMoneyLoanSchema),
  credit_cards: z.array(IndMoneyCreditCardSchema),
})

export const IndMoneySnapshotSchema = z.object({
  total_invested: z.number(),
  total_current_value: z.number(),
  total_networth: z.number(),
  investments: z.array(IndMoneyInvestmentItemSchema),
  assets: z.array(IndMoneyAssetClassItemSchema),
  market_cap: z.array(IndMoneyMarketCapItemSchema),
  liabilities: IndMoneyLiabilitiesSchema,
})

export const IndMoneyWatchlistStockSchema = z.object({
  ind_key: z.string().nullable().optional(),
  ticker: z.string().nullable().optional(),
})

export const IndMoneyWatchlistGroupSchema = z.object({
  name: z.string(),
  watchlist_id: z.number(),
  stocks: z.array(IndMoneyWatchlistStockSchema),
})

export const IndMoneyWatchlistResponseSchema = z.object({
  type: z.string(),
  watchlists: z.array(IndMoneyWatchlistGroupSchema),
})

export type IndMoneyAssetSummary = z.infer<typeof IndMoneyAssetSummarySchema>
export type IndMoneyHolding = z.infer<typeof IndMoneyHoldingSchema>
export type IndMoneyHoldingsGroup = z.infer<typeof IndMoneyHoldingsGroupSchema>
export type IndMoneyAllHoldings = z.infer<typeof IndMoneyAllHoldingsSchema>
export type IndMoneySnapshot = z.infer<typeof IndMoneySnapshotSchema>
export type IndMoneyInvestmentItem = z.infer<typeof IndMoneyInvestmentItemSchema>
export type IndMoneyAssetClassItem = z.infer<typeof IndMoneyAssetClassItemSchema>
export type IndMoneyMarketCapItem = z.infer<typeof IndMoneyMarketCapItemSchema>
export type IndMoneyLiabilities = z.infer<typeof IndMoneyLiabilitiesSchema>
export type IndMoneyWatchlistStock = z.infer<typeof IndMoneyWatchlistStockSchema>
export type IndMoneyWatchlistGroup = z.infer<typeof IndMoneyWatchlistGroupSchema>
export type IndMoneyWatchlistResponse = z.infer<typeof IndMoneyWatchlistResponseSchema>

// ─── Error ──────────────────────────────────────────────────────────────────────

export const ApiErrorResponseSchema = z.object({
  detail: z.union([z.string(), z.array(z.object({
    loc: z.array(z.union([z.string(), z.number()])),
    msg: z.string(),
    type: z.string(),
  }))]),
})

// ─── Type Exports ───────────────────────────────────────────────────────────────

export type KeyMetrics = z.infer<typeof KeyMetricsSchema>
export type SseEvent = z.infer<typeof SseEventSchema>
export type SseStatus = z.infer<typeof SseStatusSchema>
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>
export type CompareResult = z.infer<typeof CompareResultSchema>
export type PortfolioHolding = z.infer<typeof PortfolioHoldingSchema>
export type PortfolioSummary = z.infer<typeof PortfolioSummarySchema>
export type PortfolioMetrics = z.infer<typeof PortfolioMetricsSchema>
export type PortfolioResult = z.infer<typeof PortfolioResultSchema>
export type IndexQuote = z.infer<typeof IndexQuoteSchema>
export type IndicesData = z.infer<typeof IndicesDataSchema>
export type HealthResponse = z.infer<typeof HealthResponseSchema>

export type PortfolioHoldingResponse = z.infer<typeof PortfolioHoldingResponseSchema>
export type PortfolioSummaryResponse = z.infer<typeof PortfolioSummaryResponseSchema>
export type PortfolioResponse = z.infer<typeof PortfolioResponseSchema>

export type WatchlistItem = z.infer<typeof WatchlistItemSchema>
export type WatchlistResponse = z.infer<typeof WatchlistResponseSchema>

export type AnalysisHistoryItem = z.infer<typeof AnalysisHistoryItemSchema>
export type AnalysisHistoryResponse = z.infer<typeof AnalysisHistoryResponseSchema>

export type PortfolioIntelligenceResponse = z.infer<typeof PortfolioIntelligenceSchema>

export type SearchResultItem = z.infer<typeof SearchResultItemSchema>
export type SearchResponse = z.infer<typeof SearchResponseSchema>

// ─── Validation Helpers ─────────────────────────────────────────────────────────

export function validateSseEvent(data: unknown): SseEvent {
  return SseEventSchema.parse(data)
}

export function validateAnalysisResult(data: unknown): AnalysisResult {
  return AnalysisResultSchema.parse(data)
}

export function validateCompareResult(data: unknown): CompareResult {
  return CompareResultSchema.parse(data)
}

export function validatePortfolioResult(data: unknown): PortfolioResult {
  return PortfolioResultSchema.parse(data)
}

export function validateIndicesData(data: unknown): IndicesData {
  return IndicesDataSchema.parse(data)
}

export function validateHealthResponse(data: unknown): HealthResponse {
  return HealthResponseSchema.parse(data)
}

export function validatePortfolioIntelligence(data: unknown): PortfolioIntelligenceResponse {
  return PortfolioIntelligenceSchema.parse(data)
}

// Safe validation that returns null instead of throwing
export function safeValidate<T>(schema: z.ZodSchema<T>, data: unknown): T | null {
  const result = schema.safeParse(data)
  if (result.success) return result.data
  console.warn('Validation failed:', result.error.flatten())
  return null
}