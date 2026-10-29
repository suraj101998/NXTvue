const CURRENCY_LOCALE: Record<string, string> = { INR: 'en-IN', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB' }

/** Format a price in its own currency (₹ for INR, $ for USD). Unknown currency -> plain number. */
export function formatMoney(value: number, currency?: string | null): string {
  if (!currency) return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
  try {
    return new Intl.NumberFormat(CURRENCY_LOCALE[currency] ?? 'en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return `${currency} ${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  }
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value)
}
