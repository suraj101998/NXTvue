export function formatCurrency(value: number, currency = 'INR', locale = 'en-IN'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercentage(value: number, decimals = 2): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function parseTickerInput(input: string, defaultMarket: 'india' | 'us' = 'india'): { symbol: string; market: 'india' | 'us' } {
  if (input.includes(':')) {
    const [symbol, market] = input.split(':');
    return { symbol: symbol.trim().toUpperCase(), market: market.trim().toLowerCase() as 'india' | 'us' };
  }
  return { symbol: input.trim().toUpperCase(), market: defaultMarket };
}

export function calculatePnL(invested: number, current: number): { pnl: number; pnlPct: number } {
  const pnl = current - invested;
  const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
  return { pnl, pnlPct };
}

export function calculateCAGR(startValue: number, endValue: number, years: number): number {
  if (startValue <= 0 || years <= 0) return 0;
  return (Math.pow(endValue / startValue, 1 / years) - 1) * 100;
}

export function calculateSharpe(returns: number[], riskFreeRate = 0.065): number {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return 0;
  return (mean - riskFreeRate / 252) / (stdDev * Math.sqrt(252));
}

export function calculateMaxDrawdown(values: number[]): number {
  if (values.length < 2) return 0;
  let peak = values[0];
  let maxDD = 0;
  for (const value of values) {
    if (value > peak) peak = value;
    const dd = (peak - value) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD * 100;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function isValidTicker(symbol: string): boolean {
  return /^[A-Z0-9.]{1,10}$/.test(symbol);
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}