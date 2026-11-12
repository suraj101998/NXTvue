import { describe, expect, it } from 'vitest'
import fixture from './__fixtures__/sample-report.json'
import {
  buildChart, buildLadder, cleanLines, parseHolders, parseReturnKpis, parseScenarios,
  parseTableSection, parseTechnicals, parseValuation, parseVerdict, parseVisibility, toParagraphs,
} from './reportParser'

const sec = (n: number): string => (fixture.sections as { title: string; content: string }[])[n - 1].content

describe('financial / balance-sheet tables', () => {
  it('merges the split financial tables into one with the TTM column', () => {
    const { tables } = parseTableSection(sec(2))
    expect(tables).toHaveLength(1)
    expect(tables[0].cols).toEqual(['2022', '2023', '2024', '2025', 'TTM'])
    expect(tables[0].rows.map((r) => r.label)).toContain('Free Cash Flow ($M)')
    const rev = tables[0].rows.find((r) => /Total Revenue/.test(r.label))!
    expect(rev.cells).toEqual(['$5,691.5', '$6,863.2', '$8,011.8', '$10,229.9', '$10,229.9'])
    expect(tables[0].rows.find((r) => /Operating Margin/.test(r.label))?.cells[4]).toBe('20.36%')
  })

  it('leaves commentary as labelled paragraphs', () => {
    const { paras } = parseTableSection(sec(2))
    expect(paras.map((p) => p.label)).toEqual(expect.arrayContaining(['Earnings Trajectory', 'Cash Flow Quality', 'Return Metrics']))
  })

  it('builds bar charts and drops a TTM bar that repeats the last year', () => {
    const { tables } = parseTableSection(sec(2))
    const revenue = buildChart(tables[0], (l) => /Total Revenue/i.test(l))!
    expect(revenue.bars.map((b) => b.label)).toEqual(['2022', '2023', '2024', '2025'])
    const fcf = buildChart(tables[0], (l) => /Free Cash Flow/i.test(l))!
    expect(fcf.bars[0].value).toBeCloseTo(-263.8)
    expect(fcf.bars[0].display).toBe('−263.8')
    expect(fcf.bars.at(-1)?.label).toBe('TTM')
  })

  it('parses the balance sheet and its debt-to-equity row', () => {
    const { tables, paras } = parseTableSection(sec(3))
    expect(tables).toHaveLength(1)
    expect(tables[0].cols).toEqual(['2022', '2023', '2024', '2025'])
    expect(buildChart(tables[0], (l) => /Net Debt/i.test(l))?.bars.map((b) => b.value)).toEqual([2930.3, 2160.5, 1700.6, 1184.6])
    expect(buildChart(tables[0], (l) => /Debt to Equity/i.test(l))?.pct).toBe(true)
    expect(paras.length).toBeGreaterThanOrEqual(3)
  })

  it('reads return KPIs from the commentary', () => {
    expect(parseReturnKpis(sec(2)).map((k) => [k.label, k.value])).toEqual([
      ['ROIC', '44.74%'], ['ROE', '43.94%'], ['FCF / net income', '1.42x'], ['OCF / net income', '1.59x'],
    ])
  })

  it('returns nothing for text without a table', () => {
    expect(parseTableSection('Just prose.\nMore prose.').tables).toEqual([])
  })
})

describe('order book', () => {
  it('derives KPIs only from the labelled indicators', () => {
    const { kpis, paras } = parseVisibility(sec(4))
    expect(kpis.map((k) => k.value)).toEqual(['+70.7%', '$3.27B', '$3.11B'])
    expect(paras.length).toBeGreaterThan(3)
  })
})

describe('shareholding', () => {
  it('parses the stat table and ranked holders', () => {
    const { stats, holders, paras } = parseHolders(sec(5))
    expect(stats.map((s) => s.value)).toEqual(['84.59%', '0.24%', '2,691', '385.0M', '383.8M'])
    expect(stats[0].label).toMatch(/Institutional Ownership/)
    expect(holders).toHaveLength(10)
    expect(holders[0]).toEqual({ name: 'BlackRock Inc.', pct: 9.33, shares: 35921459, change: -3.46 })
    expect(holders[4].change).toBeCloseTo(65.87)
    expect(paras.some((p) => p.label === 'Key Observation')).toBe(true)
  })
})

describe('valuation', () => {
  it('parses table rows, the 52-week range and analyst targets', () => {
    const v = parseValuation(sec(6))
    expect(v.rows.find((r) => /Current/.test(r.label))?.value).toBe('$194.32')
    expect(v.rows.find((r) => /Forward P\/E/.test(r.label))).toMatchObject({ value: '21.13x' })
    expect(v.rows.find((r) => /Trailing/.test(r.label))?.value).toBe('43.19x / 43.96x')
    expect(v.rows.find((r) => /Dividend/.test(r.label))?.value).toBe('0.13% / 5.09%')
    expect(v.rows.find((r) => /Short/.test(r.label))?.value).toBe('3.74% / 2.75 Days')
    expect(v.price).toBeCloseTo(194.32)
    expect(v.week).toEqual({ low: 149.73, high: 376.06 })
    expect(v.targets).toMatchObject({ avg: 333, median: 330, low: 236, high: 427, count: 28, rating: 'Strong Buy' })
  })

  it('keeps prose after a pipe table out of the table rows', () => {
    const v = parseValuation(
      [
        '| Metric | Value | Comment |',
        '|---|---|---|',
        '| Trailing P/E | 38.5x | Above sector median |',
        '| PEG | 1.6 | Fair for growth |',
        'Current price is $97.20. The 52-week range is $61.50 to $112.40. Analyst targets: low $80, mean $110, high $135.',
      ].join('\n'),
    )
    expect(v.rows.map((r) => r.label)).toEqual(['Trailing P/E', 'PEG'])
    expect(v.price).toBeCloseTo(97.2)
    expect(v.week).toEqual({ low: 61.5, high: 112.4 })
    expect(v.targets).toMatchObject({ low: 80, avg: 110, high: 135 })
  })
})

describe('scenarios', () => {
  it('extracts three scenarios with price range, return, EPS and multiple', () => {
    const { scenarios, intro } = parseScenarios(sec(7))
    expect(scenarios.map((s) => s.kind)).toEqual(['bear', 'base', 'bull'])
    expect(scenarios[0]).toMatchObject({ price: [117, 165], ret: '-39.8% to -15.1%', eps: '$6.50–$7.50', mult: '18.0x–22.0x' })
    expect(scenarios[2].price).toEqual([375, 493])
    expect(scenarios[1].desc).toMatch(/liquid cooling/)
    expect(intro.length).toBeGreaterThan(0)
  })
})

describe('technical signals', () => {
  it('extracts RSI, indicators and levels', () => {
    const t = parseTechnicals(sec(12))
    expect(t.rsi?.value).toBeCloseTo(11.23)
    expect(t.kpis.length).toBeGreaterThanOrEqual(4)
    expect(t.kpis.find((k) => /Bearish/.test(k.value))?.cls).toBe('r')
    expect(t.kpis.find((k) => /Death Cross/i.test(k.value))).toBeTruthy()
    expect(t.levels.some((l) => l.kind === 'sup' && l.price === 149.73)).toBe(true)
    expect(t.levels.some((l) => l.kind === 'res' && l.price === 253.62)).toBe(true)
    expect(t.trend?.text).toMatch(/^Downtrend/)
  })

  it('builds a price-ordered ladder including the current price', () => {
    const t = parseTechnicals(sec(12))
    const ladder = buildLadder(t.levels, 194.32, '$265 – $300')
    const prices = ladder.map((l) => l.price)
    expect([...prices].sort((a, b) => b - a)).toEqual(prices)
    expect(ladder.some((l) => l.kind === 'now')).toBe(true)
    expect(ladder[0].kind).toBe('target')
  })
})

describe('final judgement', () => {
  it('parses stances and the best overall judgement', () => {
    const v = parseVerdict(sec(13))
    expect(v.stances).toHaveLength(4)
    expect(v.stances[0]).toMatchObject({ who: 'Existing Holders', headline: 'Hold / Accumulate', action: 'Maintain exposure' })
    expect(v.best?.title).toBe('Accumulate on Technical Dislocation')
    expect(v.best?.sub).toMatch(/^Targeting \$265/)
    expect(v.targetZone).toBe('$265 – $300')
    expect(v.intro).toMatch(/exceptional business franchise/)
  })
})

describe('helpers', () => {
  it('drops PDF bullet glyph lines', () => {
    expect(cleanLines('a\n• \n•\nb')).toEqual(['a', 'b'])
  })
  it('re-glues hyphen-wrapped words and groups labelled paragraphs', () => {
    const p = toParagraphs(['Moat: high switching costs, co-', 'design relationships.', 'Sector: Industrials.'])
    expect(p).toEqual([{ label: 'Moat', text: 'high switching costs, co-design relationships.' }, { label: 'Sector', text: 'Industrials.' }])
  })
})

describe('section kinds and hero derivations', () => {
  const secs = fixture.sections as { title: string; content: string }[]
  it('classifies all 13 canonical sections', async () => {
    const { sectionKind } = await import('./reportParser')
    expect(secs.map((s) => sectionKind(s.title))).toEqual([
      'business', 'financials', 'balance', 'orders', 'holders', 'valuation', 'targets',
      'growth', 'risks', 'bullish', 'bearish', 'levels', 'verdict',
    ])
  })
  it('derives hero KPIs and chips from the sections', async () => {
    const { deriveHeroKpis, deriveChips } = await import('./reportParser')
    const k = deriveHeroKpis(secs, '')
    expect(k.map((x) => [x.label, x.value])).toEqual([
      ['PEG ratio', '0.65'], ['Forward P/E', '21.13x'], ['Drawdown from 52-week high', '-48%'], ['Beta · volatility', '2.05'],
    ])
    expect(deriveChips(secs).map((c) => [c.label, c.value])).toEqual([['ROIC', '44.74%'], ['RSI · 14', '11.23'], ['Forward P/E', '21.13x']])
  })
})

describe('bullet lists', () => {
  it('splits trigger sections into one item per sentence and re-joins wrapped lines', () => {
    const items = toParagraphs(cleanLines(sec(10)), 'sentence')
    expect(items).toHaveLength(4)
    expect(items[0].text).toMatch(/\(\$247\.67\)\.$/)
  })
  it('keeps bearish bullets intact despite stray bullet glyph lines', () => {
    const items = toParagraphs(cleanLines(sec(11)), 'sentence')
    expect(items).toHaveLength(4)
    expect(items[2].text).toMatch(/^Inventory turnover.*product delays\.$/)
  })
  it('splits risks into labelled items', () => {
    const items = toParagraphs(cleanLines(sec(9)), 'label')
    expect(items.map((i) => i.label)).toEqual([
      'Customer Concentration & CapEx Cyclicality', 'High Market Beta & Volatility', 'Supply Chain and Working Capital Volatility',
      'Technological Obsolescence / Competition', 'Intangibles & Goodwill',
    ])
  })
  it('splits growth potential into labelled items', () => {
    expect(toParagraphs(cleanLines(sec(8)), 'label').map((i) => i.label)).toHaveLength(4)
  })
})

describe('multi-report generalization (MRVL, NVDA, AMD, BDL, BEL, MSFT)', () => {
  it('parses MRVL financial table and 4 investor stances', async () => {
    const mrvl = await import('./__fixtures__/mrvl-report.json')
    const { parseTableSection, parseVerdict, parseValuation } = await import('./reportParser')
    const s2 = parseTableSection(mrvl.sections[1].content)
    expect(s2.tables.length).toBeGreaterThanOrEqual(1)
    expect(s2.tables[0].cols).toEqual(['FY2023', 'FY2024', 'FY2025', 'FY2026'])

    const v = parseVerdict(mrvl.sections[12].content)
    expect(v.stances.length).toBe(4)
    expect(v.stances.map((s) => s.who)).toEqual([
      'Existing Holders', 'Fresh Investors', 'Aggressive / Traders', 'Conservative Investors',
    ])
    expect(v.best?.title).toBeTruthy()

    const val = parseValuation(mrvl.sections[5].content)
    expect(val.price).toBeCloseTo(228.51)
    expect(val.week?.high).toBeCloseTo(316.28)
  })

  it('parses NVDA, AMD, BDL, BEL, and MSFT stances and metrics', async () => {
    const nvda = await import('./__fixtures__/nvda-report.json')
    const amd = await import('./__fixtures__/amd-report.json')
    const bdl = await import('./__fixtures__/bdl-report.json')
    const bel = await import('./__fixtures__/bel-report.json')
    const msft = await import('./__fixtures__/msft-report.json')
    const { parseVerdict, parseValuation } = await import('./reportParser')

    const nvdaVerdict = parseVerdict(nvda.sections[12].content)
    expect(nvdaVerdict.stances.length).toBe(4)

    const amdVerdict = parseVerdict(amd.sections[12].content)
    expect(amdVerdict.stances.length).toBe(4)

    const bdlVerdict = parseVerdict(bdl.sections[12].content)
    expect(bdlVerdict.stances.length).toBe(4)

    const belVerdict = parseVerdict(bel.sections[12].content)
    expect(belVerdict.stances.length).toBe(4)

    const msftVerdict = parseVerdict(msft.sections[12].content)
    expect(msftVerdict.stances.length).toBe(4)

    expect(parseValuation(nvda.sections[5].content).price).toBeCloseTo(210.96)
    expect(parseValuation(amd.sections[5].content).price).toBeCloseTo(516.79)
    expect(parseValuation(bdl.sections[5].content).price).toBeCloseTo(1005.0)
    expect(parseValuation(bel.sections[5].content).price).toBeCloseTo(368)
    expect(parseValuation(msft.sections[5].content).price).toBeCloseTo(524.51)
  })
})
