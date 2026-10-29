import { describe, expect, it } from 'vitest'
import { chartPath, normalizeMarket, resolveSymbol } from './resolveSymbol'

describe('resolveSymbol: India', () => {
  it('routes a bare ticker on the India tab to the native engine', () => {
    const r = resolveSymbol('reliance', 'india')
    expect(r).toMatchObject({ engine: 'native', symbol: 'RELIANCE', market: 'india', needsExchange: false })
    expect(r.history).toEqual({ symbol: 'RELIANCE', market: 'india' })
  })

  it('keeps special characters (GVT&D, M&M)', () => {
    expect(resolveSymbol('GVT&D', 'india').symbol).toBe('GVT&D')
    expect(resolveSymbol('m&m').symbol).toBe('M&M')
  })

  it('strips .NS / .BO suffixes and treats them as India even on the US tab', () => {
    expect(resolveSymbol('TCS.NS', 'us')).toMatchObject({ engine: 'native', symbol: 'TCS' })
    expect(resolveSymbol('TCS.BO', 'us')).toMatchObject({ engine: 'native', symbol: 'TCS' })
  })

  it('maps NSE: and BSE: prefixes to native', () => {
    expect(resolveSymbol('NSE:INFY', 'us')).toMatchObject({ engine: 'native', symbol: 'INFY' })
    expect(resolveSymbol('BSE:INFY', 'us')).toMatchObject({ engine: 'native', symbol: 'INFY' })
  })

  it('defaults to India when the market is missing or unknown', () => {
    expect(resolveSymbol('ITC', undefined).engine).toBe('native')
    expect(resolveSymbol('ITC', null).engine).toBe('native')
    expect(resolveSymbol('ITC', 'mars').engine).toBe('native')
  })
})

describe('resolveSymbol: US / TradingView', () => {
  it('flags a bare US ticker as needing an exchange instead of guessing NASDAQ', () => {
    const r = resolveSymbol('JPM', 'us')
    expect(r).toMatchObject({ engine: 'tv', symbol: 'JPM', market: 'us', needsExchange: true })
    expect(r.tvSymbol).toBeUndefined()
  })

  it('uses an explicit exchange as given', () => {
    const r = resolveSymbol('NYSE:JPM', 'india')
    expect(r).toMatchObject({ engine: 'tv', symbol: 'JPM', market: 'us', tvSymbol: 'NYSE:JPM', needsExchange: false })
    expect(resolveSymbol('nasdaq:nvda').tvSymbol).toBe('NASDAQ:NVDA')
  })
})

describe('resolveSymbol: FX / global', () => {
  it('handles USDINR and USD/INR', () => {
    for (const t of ['USDINR', 'usd/inr']) {
      expect(resolveSymbol(t, 'india')).toMatchObject({
        engine: 'tv',
        tvSymbol: 'FX_IDC:USDINR',
        market: 'global',
        needsExchange: false,
      })
    }
  })

  it('parses EXCHANGE:SYMBOL emitted by tv-link-open', () => {
    const r = resolveSymbol('FX_IDC:USDINR', 'us')
    expect(r).toMatchObject({ engine: 'tv', tvSymbol: 'FX_IDC:USDINR', market: 'global', symbol: 'USDINR' })
    expect(r.history).toEqual({ symbol: 'INR=X', market: 'us' })
  })

  it('treats crypto and commodities as tv with no candle source', () => {
    const r = resolveSymbol('BITSTAMP:BTCUSD')
    expect(r).toMatchObject({ engine: 'tv', tvSymbol: 'BITSTAMP:BTCUSD', market: 'global' })
    expect(r.history).toBeUndefined()
  })
})

describe('resolveSymbol: junk input', () => {
  it('does not throw and never invents an exchange', () => {
    expect(() => resolveSymbol('', 'us')).not.toThrow()
    expect(resolveSymbol('  ', 'us').needsExchange).toBe(true)
    expect(resolveSymbol('A B C', 'india').symbol).toBe('ABC')
  })
})

describe('helpers', () => {
  it('normalizeMarket', () => {
    expect(normalizeMarket('US')).toBe('us')
    expect(normalizeMarket('india')).toBe('india')
    expect(normalizeMarket('anything')).toBe('india')
    expect(normalizeMarket(null)).toBe('india')
  })

  it('chartPath encodes the symbol and keeps the market', () => {
    expect(chartPath('GVT&D', 'india')).toBe('/chart/GVT%26D?market=india')
    expect(chartPath('FX_IDC:USDINR')).toBe('/chart/FX_IDC%3AUSDINR')
  })
})
