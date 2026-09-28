export type Market = 'india' | 'us';

export type AssetType = 'stock' | 'etf' | 'mf' | 'bond';

export interface TickerInput {
  symbol: string;
  market: Market;
}

export interface AnalysisRequest {
  ticker: string;
  market: Market;
  assetType: AssetType;
  projectionYear: number;
}

export interface AnalysisResponse {
  ticker: string;
  market: Market;
  assetType: AssetType;
  projectionYear: number;
  finalMemo: string;
  keyMetrics: Record<string, unknown>;
  pdfPath?: string;
  generatedAt: string;
}

export interface PortfolioHolding {
  ticker: string;
  qty: number;
  avgCost: number;
  market: Market;
}

export interface PortfolioAnalysisRequest {
  holdings: PortfolioHolding[];
  projectionYear: number;
}

export interface PortfolioSummary {
  numHoldings: number;
  totalInvested: number;
  totalValue: number;
  totalPnl: number;
  totalGainPct: number;
}

export interface PortfolioAnalysisResponse {
  finalMemo: string;
  metrics: {
    summary: PortfolioSummary;
    holdings: PortfolioHolding[];
  };
  pdfPath?: string;
  generatedAt: string;
}

export interface WatchlistItem {
  ticker: string;
  market: Market;
  assetType?: AssetType;
  addedAt: string;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  services: {
    database: boolean;
    cache: boolean;
    llm: boolean;
    dataProviders: boolean;
  };
}

export interface ErrorResponse {
  error: string;
  code: string;
  details?: Record<string, unknown>;
  timestamp: string;
}