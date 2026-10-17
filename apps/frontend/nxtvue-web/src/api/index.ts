export {
  openStockStream,
  openCompareStream,
  openPortfolioDefaultStream,
  openPortfolioUploadStream,
  getReportUrl,
  stockStreamUrl,
  compareStreamUrl,
  portfolioDefaultStreamUrl,
  fetchAnalysis,
  fetchCompare,
  fetchPortfolioAnalysis,
} from './analysis'

export {
  openSseStream,
  openSsePost,
  apiGet,
  apiPost,
  apiPostForm,
  checkHealth,
  fetchIndices,
  getReportUrl as getReportDownloadUrl,
} from './client'

export {
  validateSseEvent,
  validateAnalysisResult,
  validateCompareResult,
  validatePortfolioResult,
  validateIndicesData,
  validateHealthResponse,
  validatePortfolioIntelligence,
  safeValidate,
  type KeyMetrics,
  type SseEvent,
  type SseStatus,
  type AnalysisResult,
  type CompareResult,
  type PortfolioHolding,
  type PortfolioSummary,
  type PortfolioMetrics,
  type PortfolioResult,
  type IndexQuote,
  type IndicesData,
  type HealthResponse,
  type PortfolioHoldingResponse,
  type PortfolioSummaryResponse,
  type PortfolioResponse,
  type WatchlistItem,
  type WatchlistResponse,
  type AnalysisHistoryItem,
  type AnalysisHistoryResponse,
  type PortfolioIntelligenceResponse,
  type SearchResultItem,
  type SearchResponse,
} from './validators'

export {
  ApiError,
  handleApiError,
  withRetry,
  type ApiErrorCode,
  type ApiErrorDetails,
  type RetryOptions,
} from './errors'

export {
  fetchPortfolioHoldings,
  fetchPortfolioIntelligence,
  syncPortfolio,
  fetchWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  fetchAnalysisHistory,
  searchTickers,
} from './client'

export {
  fetchIndMoneySnapshot,
  fetchIndMoneyAllHoldings,
  fetchIndMoneyHoldingsByType,
  fetchIndMoneyWatchlist,
  type IndMoneySnapshot,
  type IndMoneyAllHoldings,
  type IndMoneyHoldingsGroup,
  type IndMoneyWatchlistResponse,
} from './client'

export {
  type IndMoneyHolding,
  type IndMoneyAssetSummary,
  type IndMoneyInvestmentItem,
  type IndMoneyAssetClassItem,
  type IndMoneyMarketCapItem,
  type IndMoneyLiabilities,
  type IndMoneyWatchlistGroup,
  type IndMoneyWatchlistStock,
} from './validators'

export {
  buildApiUrl,
  buildWsUrl,
  envConfig,
  logger,
  features,
} from './config'