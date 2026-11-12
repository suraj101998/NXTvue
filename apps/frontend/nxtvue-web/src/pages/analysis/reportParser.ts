/**
 * Pure helpers that turn the flattened PDF text returned by `/api/v1/analysis/:ticker`
 * into structured view-models (tables, bar series, gauges, scenario cards, …).
 *
 * Nothing here knows about a specific company: every value is read out of the report
 * text. When a piece cannot be parsed the helper returns an empty / null result and
 * the UI falls back to plain prose.
 */

/* ─── Shared primitives ─────────────────────────────────────────────────────── */
export interface Para { label?: string; text: string }
export interface ParsedTable { cols: string[]; rows: { label: string; cells: string[] }[] }
export interface ChartData {
  title: string
  pct: boolean
  bars: { label: string; value: number; display: string }[]
}

const BULLET = /^[•·]+$/

/** Trimmed, non-empty lines with the stray PDF bullet glyphs removed. */
export function cleanLines(content: string): string[] {
  return content.split('\n').map((l) => l.trim()).filter((l) => l && !BULLET.test(l))
}

/** Join two wrapped lines, re-gluing words hyphenated across the wrap. */
export function joinWrapped(a: string, b: string): string {
  if (!a) return b
  return /[-/]$/.test(a) && /^[a-z]/.test(b) ? a + b : `${a} ${b}`
}

/** `Label: rest` at the start of a line (balanced parens, short, ≤ 8 words). */
export function matchLabel(line: string): { label: string; rest: string } | null {
  const m = line.match(/^([A-Z][^:]{1,68}?):(?:\s+(.*)|$)/)
  if (!m) return null
  const label = m[1]
  if ((label.match(/\(/g) ?? []).length !== (label.match(/\)/g) ?? []).length) return null
  if (label.split(/\s+/).length > 8 || /[.!?]$/.test(label)) return null
  return { label, rest: (m[2] ?? '').trim() }
}

/**
 * Rebuild paragraphs out of hard-wrapped lines.
 *  - `label`    mode: a new paragraph starts at a `Label:` line that follows a finished sentence.
 *  - `sentence` mode: a new paragraph starts at any capitalised line that follows a finished sentence.
 */
export function toParagraphs(lines: string[], mode: 'label' | 'sentence' = 'label'): Para[] {
  const out: Para[] = []
  let prev = ''
  for (const raw of lines) {
    // A leading "- " is a list marker: it always opens a new paragraph.
    const bullet = /^[-–]\s+(?=\S)/.test(raw)
    const line = bullet ? raw.replace(/^[-–]\s+/, '') : raw
    const lab = matchLabel(line)
    const ended = !prev || /[.!?:]["')\]]?$/.test(prev)
    const startNew = out.length === 0 || bullet || (mode === 'label' ? ended && !!lab : ended && /^[A-Z0-9(]/.test(line))
    if (startNew) {
      out.push(lab && mode === 'label' ? { label: lab.label, text: lab.rest } : mode === 'sentence' && lab ? { label: lab.label, text: lab.rest } : { text: line })
    } else {
      const p = out[out.length - 1]
      p.text = joinWrapped(p.text, line)
    }
    prev = line
  }
  return out
}

/* ─── Tables flattened by pypdf ─────────────────────────────────────────────── */
const VAL = /^(?:[-+−–]?[₹$]?[-+−–]?\d[\d,]*(?:\.\d+)?[%xXMBKCr]?|—|n\/a)$/i
const MONTH_NAMES = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec'

function isYearOrPeriod(t: string): boolean {
  if (/^(?:19|20)\d\d$/.test(t)) return true
  if (/^(?:FY|CY)(?:19|20)?\d\d[A-Za-z]?$/i.test(t)) return true
  if (new RegExp(`^(?:${MONTH_NAMES})[- '.]*(?:19|20)?\\d\\d$`, 'i').test(t)) return true
  if (/^(?:TTM|LTM|FY\d\dE?)$/i.test(t)) return true
  return false
}

function headerCols(line: string): string[] | null {
  // Check for month-year combinations like "Mar 2021"
  const rawToks = line.split(/\s+/)
  const tokens: string[] = []
  for (let k = 0; k < rawToks.length; k++) {
    const t = rawToks[k]
    const next = rawToks[k + 1]
    if (new RegExp(`^(?:${MONTH_NAMES})$`, 'i').test(t) && next && /^(?:19|20)?\d\d$/.test(next)) {
      tokens.push(`${t} ${next}`)
      k++
    } else {
      tokens.push(t)
    }
  }

  const i = tokens.findIndex(isYearOrPeriod)
  if (i < 0) return null
  let j = i
  while (j < tokens.length && isYearOrPeriod(tokens[j])) j++
  if (j - i < 2) return null
  if (tokens.slice(0, i).some((x) => VAL.test(x))) return null
  const cols = tokens.slice(i, j)
  if (tokens.slice(j).some((x) => /^TTM$/i.test(x)) && !cols.includes('TTM')) cols.push('TTM')
  return cols
}

/** Numeric value of a table cell (NaN for "—"). */
export const cellNum = (c: string): number => {
  const v = parseFloat(c.replace(/[−–]/g, '-').replace(/[^0-9.+-]/g, ''))
  return Number.isFinite(v) ? v : NaN
}

/** Display form of a cell: drop the `$`, use a true minus sign. */
export const fmtCell = (c: string): string => c.replace(/^([+\-−–]?)\$/, '$1').replace(/^[-–](?=\d)/, '−')

/* ─── Transposed tables: one period per row, one metric per column ───────────── */
const ROW_PERIOD = new RegExp(`^((?:${MONTH_NAMES})[- ]*(?:19|20)?\\d\\d|(?:FY|CY)\\s?(?:19|20)?\\d\\d[A-Za-z]?|(?:19|20)\\d\\d|TTM|LTM)\\s+(.+)$`, 'i')
const TRANSPOSED_HEAD = /^(?:Year|Period|Fiscal(?:\s+year)?|FY|Quarter(?:\s+end(?:ed)?)?|Date|Particulars)\b\s*/i
const MODIFIER = /^(?:op\.?|operating|net|gross|free|total|diluted|basic|cash|pre-tax|other|adj\.?|tax|interest|return|cost|book|dividend|profit)$/i

/** Group header words into exactly `n` column names: units stick to the word before, then merge adjacent words only until the count fits. */
function groupHeader(words: string[], n: number): string[] | null {
  const cols: string[] = []
  for (const w of words) {
    if (cols.length && (/^\(.*\)?$/.test(w) || w === '%' || w === ')')) cols[cols.length - 1] += ` ${w}`
    else cols.push(w)
  }
  const last = (c: string) => c.split(/\s+/).filter((x) => !/^\(.*\)$/.test(x)).pop() ?? ''
  const passes: ((a: string, b: string) => boolean)[] = [
    (a) => last(a).endsWith('.'),
    (a, b) => MODIFIER.test(last(a)) && /^(?:profit|income|margin|flow|growth|capital|equity|assets|expense|expenses|eps)\b/i.test(b),
    (a) => MODIFIER.test(last(a)),
    (_a, b) => /^(?:profit|income|margin|flow|growth)\b/i.test(b),
  ]
  for (const ok of passes) {
    for (let i = 0; i < cols.length - 1 && cols.length > n; ) {
      if (ok(cols[i], cols[i + 1])) { cols.splice(i, 2, `${cols[i]} ${cols[i + 1]}`) } else i++
    }
  }
  return cols.length === n ? cols.map((c) => c.replace(/(\w)(margin|income|profit|cashflow)\b/i, '$1 $2').replace(/Diluted\s*EPS/i, 'Diluted EPS')) : null
}

function parseTransposed(lines: string[]): { tables: ParsedTable[]; used: Set<number> } {
  const used = new Set<number>()
  const groups = new Map<string, { metrics: string[]; periods: string[]; matrix: string[][] }>()
  let metrics: string[] | null = null
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (TRANSPOSED_HEAD.test(l) && !ROW_PERIOD.test(l)) {
      const words = [l.replace(TRANSPOSED_HEAD, '')]
      const idx = [i]
      let j = i + 1
      for (; j < lines.length && j < i + 9 && !(ROW_PERIOD.test(lines[j]) && lines[j].split(/\s+/).slice(1).every((t) => VAL.test(t) || /^\(.*\)$/.test(t))); j++) { words.push(lines[j]); idx.push(j) }
      const row = lines[j]?.match(ROW_PERIOD)
      if (row) {
        const n = row[2].split(/\s+/).length
        const cols = groupHeader(words.join(' ').split(/\s+/).filter(Boolean), n)
        if (cols) { metrics = cols; idx.forEach((k) => used.add(k)); i = j - 1; continue }
      }
      metrics = null
      continue
    }
    const m = l.match(ROW_PERIOD)
    if (!m || !metrics) continue
    const cells = m[2].split(/\s+/)
    if (cells.length !== metrics.length || !cells.every((c) => VAL.test(c))) continue
    const key = metrics.join('|')
    const g = groups.get(key) ?? { metrics, periods: [], matrix: [] }
    g.periods.push(m[1].replace(/\s+/g, ' ').replace(/^(\w{3})-?(\d{2})$/, '$1 $2'))
    g.matrix.push(cells)
    groups.set(key, g)
    used.add(i)
  }
  const tables = [...groups.values()]
    .filter((g) => g.periods.length >= 2)
    .map((g) => ({ cols: g.periods, rows: g.metrics.map((label, c) => ({ label, cells: g.matrix.map((r) => r[c]) })) }))
  return { tables, used: tables.length ? used : new Set<number>() }
}

/**
 * Finds every `Metric 2022 2023 …` table in `lines`, merges tables sharing the same
 * columns, and returns the lines that were not part of a table.
 */
/**
 * PDF extraction quirks: markdown pipe rows (`| Sales | 1 | 2 |`) and period headers wrapped one token per
 * line (`Mar` / `2019` / `Mar` / `2020`). Both are rewritten into the single-line form the table scanner expects.
 */
export function normalizeTableLines(lines: string[]): string[] {
  const out: string[] = []
  const periodWord = new RegExp(`^(?:${MONTH_NAMES})[-.]?$`, 'i')
  for (let i = 0; i < lines.length; i++) {
    let l = lines[i].replace(/\s*\(\d{1,2}m\)/gi, '')
    if (l.startsWith('|')) {
      if (/^\|[\s:|-]+\|?$/.test(l)) continue
      l = l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim()).join(' ').replace(/\s+/g, ' ')
    }
    // Month on its own line followed by a year on the next: glue into "Mar 2019".
    if (periodWord.test(l) && lines[i + 1] && /^(?:19|20)?\d\d$/.test(lines[i + 1])) {
      l = `${l} ${lines[i + 1]}`
      i++
    }
    const prev = out[out.length - 1]
    // Consecutive period tokens collapse into one header line.
    if (prev !== undefined && isYearOrPeriod(l.split(/\s+/).slice(-2).join(' ')) && /^(?:[A-Za-z]{3}\s\d{2,4}|TTM|(?:FY|CY)\d+|(?:19|20)\d\d)$/.test(l) && prev.split(/\s+/).length <= 40 && /(?:^|\s)(?:[A-Za-z]{3}\s\d{2,4}|TTM|(?:FY|CY)\d+|(?:19|20)\d\d)$/.test(prev) && (isYearOrPeriod(prev.split(/\s+/).slice(-2).join(' ')) || isYearOrPeriod(prev.split(/\s+/).pop()!))) {
      out[out.length - 1] = `${prev} ${l}`
    } else out.push(l)
  }
  return out
}

export function parseTables(input: string[]): { tables: ParsedTable[]; prose: string[] } {
  const lines = normalizeTableLines(input)
  const used = new Set<number>()
  const raw: ParsedTable[] = []

  for (let i = 0; i < lines.length; i++) {
    const cols = headerCols(lines[i])
    if (!cols) continue
    used.add(i)
    for (let k = i - 1, n = 0; k >= 0 && n < 3 && !used.has(k) && lines[k].length < 40 && !/[.!?]$/.test(lines[k]); k--, n++) used.add(k)

    const rows: ParsedTable['rows'] = []
    let pending: number[] = []
    let j = i + 1
    for (; j < lines.length; j++) {
      const line = lines[j]
      if (headerCols(line) || matchLabel(line)) break
      const toks = line.split(/\s+/)
      let n = 0
      while (n < toks.length && VAL.test(toks[toks.length - 1 - n])) n++
      if (n >= cols.length) {
        const lead = toks.slice(0, toks.length - cols.length)
        const label = [...pending.map((p) => lines[p]), lead.join(' ')].join(' ').trim()
        if (!label) break
        rows.push({ label, cells: toks.slice(-cols.length) })
        pending.forEach((p) => used.add(p))
        used.add(j)
        pending = []
      } else {
        pending.push(j)
        if (pending.length > 3) break
      }
    }
    i = j - 1
    if (rows.length) raw.push({ cols, rows })
  }

  const merged: ParsedTable[] = []
  for (const t of raw) {
    const hit = merged.find((m) => m.cols.join('|') === t.cols.join('|'))
    if (hit) hit.rows.push(...t.rows)
    else merged.push({ cols: t.cols, rows: [...t.rows] })
  }
  const tr = parseTransposed(lines)
  tr.used.forEach((i) => used.add(i))
  return { tables: [...merged, ...tr.tables], prose: lines.filter((_, i) => !used.has(i)) }
}

/** One bar series out of a table row. The TTM column is dropped when it repeats the last year. */
export function buildChart(table: ParsedTable | undefined, test: (label: string) => boolean): ChartData | null {
  const row = table?.rows.find((r) => test(r.label))
  if (!table || !row) return null
  const pct = row.cells.some((c) => c.includes('%'))
  let items = table.cols
    .map((label, i) => ({ label, value: cellNum(row.cells[i] ?? '') }))
    .filter((x) => Number.isFinite(x.value))
  const last = items[items.length - 1]
  const prev = items[items.length - 2]
  if (items.length > 2 && last.label === 'TTM' && prev.value === last.value) items = items.slice(0, -1)
  if (items.length < 2) return null
  const display = (v: number) => (pct ? `${v}%` : `${v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 2 })}`)
  return { title: row.label, pct, bars: items.map((x) => ({ ...x, display: display(x.value) })) }
}

/** Convenience: tables + prose paragraphs of a "table + commentary" section. */
export function parseTableSection(content: string) {
  const { tables, prose } = parseTables(cleanLines(content))
  return { tables, paras: toParagraphs(prose, 'label') }
}

/** ROIC / ROE / cash-conversion highlights quoted in the financial commentary. */
export function parseReturnKpis(content: string): { label: string; value: string; cls?: 'g' }[] {
  const t = content.replace(/\s+/g, ' ')
  const out: { label: string; value: string; cls?: 'g' }[] = []
  const add = (label: string, rx: RegExp, suffix: string, cls?: 'g') => {
    const m = t.match(rx)
    if (m) out.push({ label, value: `${m[1]}${suffix}`, cls })
  }
  add('ROIC', /\(ROIC\)[^%\d]{0,40}([\d.]+)%/, '%', 'g')
  add('ROE', /\(ROE\)[^%\d]{0,40}([\d.]+)%/, '%')
  add('FCF / net income', /free cash flow conversion[^\d]{0,40}([\d.]+)x/i, 'x')
  add('OCF / net income', /OCF-to-Net Income is ([\d.]+)x/i, 'x')
  return out
}

/* ─── Order book / visibility ───────────────────────────────────────────────── */
const compactMoney = (s: string): string => {
  const m = s.match(/^\$([\d,]+(?:\.\d+)?)([MBK])?$/)
  if (!m) return s
  const n = parseFloat(m[1].replace(/,/g, ''))
  return m[2] === 'M' && n >= 1000 ? `$${(n / 1000).toFixed(2)}B` : s
}

export function parseVisibility(content: string): { paras: Para[]; kpis: { value: string; label: string }[] } {
  const paras = toParagraphs(cleanLines(content), 'label')
  const kpis: { value: string; label: string }[] = []
  const AMT = String.raw`(?:US\$|Rs\.?\s?|[₹$])\s?[\d,]+(?:\.\d+)?\s?(?:[MBK]|Cr(?:ore)?s?|crore|lakh crore)?`
  for (const p of paras) {
    if (!p.label || !/\d/.test(p.text) || /^(what|available|reported source|data|investor|inferred)/i.test(p.label)) continue
    if (/not\s+(?:directly\s+)?(?:disclosed|reported|provided|available)|unavailable/i.test(p.text.slice(0, 90))) continue
    const pct = p.text.match(/\(([+\-−]\d[\d.]*%)[^)]*\)/)
    const to = p.text.match(new RegExp(String.raw`\bto\s+(${AMT})`, 'i'))
    const any = [...p.text.matchAll(new RegExp(AMT, 'g'))].pop()
    const x = p.text.match(/(\d+(?:\.\d+)?)\s*(?:to\s*\d+(?:\.\d+)?\s*)?years? of revenue visibility/i)
    const raw = pct?.[1] ?? to?.[1] ?? any?.[0]
    if (raw) kpis.push({ value: compactMoney(raw.trim()), label: p.label })
    else if (x) kpis.push({ value: `${x[1]} yrs`, label: p.label })
  }
  return { paras, kpis: kpis.slice(0, 4) }
}

/* ─── Shareholding ──────────────────────────────────────────────────────────── */
export interface Holder { name: string; pct: number; shares: number; change: number | null; pp?: boolean }
export interface HolderStat { label: string; value: string }

const compactCount = (s: string): string => {
  const n = parseFloat(s.replace(/,/g, ''))
  return /^[\d,]+$/.test(s) && n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : s
}

export function parseHolders(content: string) {
  const lines = cleanLines(content)
  const fullText = lines.join(' ')
  const stats: HolderStat[] = []
  const used = new Set<number>()

  // 1. Extract tabular stats if present
  const hi = lines.findIndex((l) => /^Holder Group\b/i.test(l))
  if (hi >= 0) {
    used.add(hi)
    for (let j = hi + 1; j < lines.length; j++) {
      const l = lines[j]
      if (/^\d+\.\s/.test(l) || /^Top\b.*:$/i.test(l) || matchLabel(l)) break
      const toks = l.split(/\s+/)
      const idx = toks.findIndex((t) => /^\d/.test(t))
      if (idx < 1) break
      const sub = toks.slice(idx + 1).join(' ')
      stats.push({
        label: sub.startsWith('(') ? `${toks.slice(0, idx).join(' ')} ${sub}` : toks.slice(0, idx).join(' '),
        value: compactCount(toks[idx]),
      })
      used.add(j)
    }
  }

  // 2. Extract prose stats if tabular was not found
  if (stats.length === 0) {
    const inst = fullText.match(/institutions?\s+(?:hold\s+)?([\d.]+%)/i) ?? fullText.match(/institutional\s+(?:ownership|holding)[^%0-9]*([\d.]+%)/i)
    if (inst) stats.push({ label: 'Institutional Ownership', value: inst[1] })

    const ins = fullText.match(/insiders?\s+(?:hold\s+)?([\d.]+%)/i) ?? fullText.match(/promoters?\s+(?:hold\s+)?([\d.]+%)/i)
    if (ins) stats.push({ label: 'Insider / Promoter', value: ins[1] })

    const count = fullText.match(/([\d,]+)\s+institutional\s+holders/i) ?? fullText.match(/across\s+([\d,]+)\s+institutions/i) ?? fullText.match(/\(([\d,]+)\s+holders\)/i)
    if (count) stats.push({ label: 'Total Institutions', value: count[1] })

    const si = fullText.match(/short\s+interest\s+(?:is\s+)?([\d.]+%[^.]*?(?:days to cover|days)?)/i)
    if (si) stats.push({ label: 'Short Interest', value: si[1].trim() })
  }

  // 3. Extract ranked holders or category shares
  const holders: Holder[] = []
  let cur: string | null = null
  const flush = () => {
    if (!cur) return
    // Style A: 1. BlackRock Inc.: 35,921,459 shares (9.33% held, -3.46%)
    const mA = cur.match(/^\d+\.\s+(.+?):\s*([\d,]+)\s+shares\s*\((.*)\)\.?$/)
    if (mA) {
      const pct = mA[3].match(/([\d.]+)%\s*held/)
      const ch = mA[3].match(/([+\-−])\s?(\d[\d.]*)%/)
      if (pct) {
        holders.push({
          name: mA[1].trim(),
          pct: parseFloat(pct[1]),
          shares: parseFloat(mA[2].replace(/,/g, '')),
          change: ch ? (ch[1] === '+' ? 1 : -1) * parseFloat(ch[2]) : null,
        })
      }
    } else {
      // Style B: BlackRock 8.18% +2.4%  or  Promoters 51.14%
      const mB = cur.match(/^([A-Za-z0-9&.,\s()/-]+?)\s+([\d.]+)%(?:\s+([+\-−]?[\d.]+%))?$/)
      if (mB && !/^(Holder|Percentage|Category|Total)/i.test(mB[1])) {
        const ch = mB[3] ? parseFloat(mB[3].replace(/[+%]/g, '')) : null
        holders.push({
          name: mB[1].replace(/^\d+\.\s*/, '').trim(),
          pct: parseFloat(mB[2]),
          shares: 0,
          change: Number.isFinite(ch) ? ch : null,
        })
      }
    }
    cur = null
  }

  lines.forEach((l, i) => {
    if (/^\d+\.\s+/.test(l) || /^(?:BlackRock|Vanguard|State Street|Geode|FMR|Promoters|FIIs|DIIs|Public|Institutions|Insiders)\b/i.test(l)) {
      flush(); cur = l; used.add(i)
    } else if (cur && !matchLabel(l) && !/^(Holder|Metric|Risk|Section)/i.test(l)) {
      cur = joinWrapped(cur, l); used.add(i)
    } else {
      flush()
    }
  })
  flush()

  const heading = lines.find((l) => /^Top\b.*:$/i.test(l) || /^Holder\b/i.test(l))
  if (heading) used.add(lines.indexOf(heading))

  // 4. Category-by-period tables (India: Promoters / FIIs / DIIs / Public over Mar-23 … Sep-26).
  if (!holders.length) {
    const { tables, prose } = parseTables(lines)
    const t = tables.find((x) => x.rows.some((r) => r.cells.every((c) => /%$/.test(c) || /^[—-]$/.test(c))))
    if (t) {
      const lastIdx = t.cols.length - 1
      const firstOf = (cells: string[]) => cells.findIndex((c) => Number.isFinite(cellNum(c)))
      for (const r of t.rows) {
        if (!r.cells.every((c) => /%$/.test(c) || /^[—-]$/.test(c))) continue
        const pct = cellNum(r.cells[lastIdx])
        const f = firstOf(r.cells)
        if (!Number.isFinite(pct)) continue
        holders.push({ name: r.label.replace(/\s+/g, ' '), pct, shares: 0, change: f >= 0 && f < lastIdx ? Math.round((pct - cellNum(r.cells[f])) * 100) / 100 : null, pp: true })
      }
      for (const r of t.rows) {
        if (r.cells.every((c) => /%$/.test(c) || /^[—-]$/.test(c))) continue
        const v = r.cells[lastIdx]
        if (/^[\d,]+$/.test(v)) stats.push({ label: `${r.label.replace(/^No\.?\s+of\s+/i, '')} (${t.cols[lastIdx]})`, value: compactCount(v.replace(/(\d)(?=(\d{2})+\d,)/g, '$1')) })
      }
      if (holders.length) {
        const cols = `${t.cols[0]} → ${t.cols[lastIdx]}`
        return { stats: stats.slice(0, 4), holders, paras: toParagraphs(prose.filter((l) => !/^(?:Shareholding|Holder|Category|Observations?|Judgement)\b.*$/i.test(l) || l.length > 60), 'label'), range: cols }
      }
    }
  }
  return { stats, holders, paras: toParagraphs(lines.filter((_, i) => !used.has(i)), 'label'), range: undefined as string | undefined }
}

/* ─── Valuation ─────────────────────────────────────────────────────────────── */
export interface ValRow { label: string; value: string; context: string }
export interface Targets { avg?: number; median?: number; low?: number; high?: number; count?: number; rating?: string }


function splitValRow(line: string): ValRow | null {
  const toks = line.split(/\s+/)
  const isNum = (t?: string) => !!t && /^[-+~]?(?:US\$|Rs\.?|[₹$€£])?(?:USD\s*)?\d/i.test(t) && !/^\d+-(?:week|day|month|year)/i.test(t)
  const idx = toks.findIndex((t, i) => i > 0 && isNum(t) && !/[<>~≈(]$/.test(toks[i - 1]))
  if (idx < 1 || idx > 8) return null
  let end = idx + 1
  while (toks[end] === '/' && isNum(toks[end + 1])) end += 2
  if (/^(days|shares|Cr|B|M|K)$/i.test(toks[end] ?? '')) end++
  return { label: toks.slice(0, idx).join(' '), value: toks.slice(idx, end).join(' '), context: toks.slice(end).join(' ') }
}

const VAL_CUR = String.raw`(?:US\$|USD\s?|Rs\.?\s?|₹\s?|\$)`
const money = (s?: string) => (s ? parseFloat(s.replace(/,/g, '')) : undefined)

/** `| A | B |` pipe rows and `- Label: value` bullets → plain `Label value` rows; separator rows dropped. */
export function normalizeKeyValueLines(lines: string[]): string[] {
  const out: string[] = []
  for (const l of lines) {
    if (l.startsWith('|')) {
      if (/^\|[\s:|-]+\|?$/.test(l)) continue
      out.push(l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim()).join(' ').replace(/\s+/g, ' '))
      continue
    }
    const b = l.match(/^[-•–]\s*([A-Z][^:]{2,48}):\s+(.*\d.*)$/)
    out.push(b ? `${b[1]} ${b[2]}` : l)
  }
  return out
}

/** 52-week low/high from any of the phrasings used across reports. */
export function extractWeekRange(text: string): { low: number; high: number } | undefined {
  const C = VAL_CUR
  const n = String.raw`([\d,]+(?:\.\d+)?)`
  const range = text.match(new RegExp(String.raw`52[- ]?week\s+range[^\d]{0,24}${C}?${n}\s*(?:–|—|-|to)\s*${C}?${n}`, 'i'))
  if (range) return { low: money(range[1])!, high: money(range[2])! }
  const hl = text.match(new RegExp(String.raw`52[- ]?week\s+high[^\d]{0,12}${C}?${n}.{0,40}?52[- ]?week\s+low[^\d]{0,12}${C}?${n}`, 'i'))
  if (hl) return { low: money(hl[2])!, high: money(hl[1])! }
  const lh = text.match(new RegExp(String.raw`52[- ]?week\s+low[^\d]{0,12}${C}?${n}.{0,40}?52[- ]?week\s+high[^\d]{0,12}${C}?${n}`, 'i'))
  if (lh) return { low: money(lh[1])!, high: money(lh[2])! }
  const high = text.match(new RegExp(String.raw`(?:below|under|from)\s+the\s+52[- ]?week\s+high\s+of\s+${C}?${n}`, 'i')) ?? text.match(new RegExp(String.raw`52[- ]?week\s+high\s+of\s+${C}?${n}`, 'i'))
  const low = text.match(new RegExp(String.raw`52[- ]?week\s+low\s+(?:of\s+)?(?:\()?${C}?${n}`, 'i'))
  if (high && low) return { low: money(low[1])!, high: money(high[1])! }
  return undefined
}

export function parseValuation(content: string) {
  const lines = normalizeKeyValueLines(cleanLines(content))
  const fullText = lines.join(' ')
  const hi = lines.findIndex((l) => /^Metric\b/i.test(l))
  let ci = lines.findIndex((l, i) => i > (hi >= 0 ? hi : 0) && /^(?:Analyst\s+Consensus|Consensus|Analyst\s+Targets?)\b/i.test(l))
  const rows: ValRow[] = []

  if (hi >= 0) {
    const end = ci >= 0 ? ci : lines.length
    for (let i = hi + 1; i < end; i++) {
      const l = lines[i]
      if (/^(?:Analyst|Metric|Section|Valuation\s+Assessment|Judgement)/i.test(l)) break
      // A line of several sentences is prose that follows the table, not a table row.
      if (/[.!?]\s+[A-Z]/.test(l) && l.split(/\s+/).length > 10) { if (ci < 0) ci = i; break }
      const r = splitValRow(l)
      if (r) rows.push(r)
      else if (rows.length) rows[rows.length - 1].context = joinWrapped(rows[rows.length - 1].context, l)
    }
  } else {
    // "Price $228.51", "Market Cap ₹11,588 Cr", "Trailing P/E 75.2x" …
    const KEY = /^(?:Current\s+(?:Market\s+)?Price|CMP|Price|Market\s+cap(?:italisation|italization)?|Enterprise value|EV\b|Trailing P\/E|P\/E|Forward P\/E|PEG|Price[\/-](?:to-)?(?:book|earnings|sales)|P\/B|Book value|Dividend|Short interest|ROE|ROCE|52[- ]week|Reported P\/E|Face value|EPS)/i
    for (const l of lines) {
      if (KEY.test(l) && !/^[A-Z][a-z]+(?:\s[a-z]+){6,}/.test(l)) {
        const r = splitValRow(l)
        if (r && r.label.length <= 44) rows.push(r)
      }
    }
  }

  const intro = toParagraphs(hi >= 0 ? lines.slice(0, hi) : lines, 'label')
  const consensus = ci >= 0 ? toParagraphs(lines.slice(ci), 'label') : []

  // Price
  const priceRow = rows.find((r) => /(?:current.*price|^price\b|^cmp\b)/i.test(r.label))
  const rawPriceStr = priceRow?.value ?? fullText.match(new RegExp(String.raw`(?:current\s+(?:stock\s+)?price|price\s+is|trading\s+at)\s+${VAL_CUR}?([\d,.]+)`, 'i'))?.[1]
  const price = rawPriceStr ? money(rawPriceStr.match(/[\d,.]+/)?.[0]) : undefined

  let week = extractWeekRange(fullText)
  if (!week && price) {
    // Only the high is quoted ("27.8% below the 52-week high of $316.28"): anchor the low at half the price, as before.
    const h = fullText.match(new RegExp(String.raw`52[- ]?week\s+high\s+of\s+${VAL_CUR}?([\d,]+(?:\.\d+)?)`, 'i'))
    if (h && money(h[1])! > price) week = { low: price * 0.5, high: money(h[1])! }
  }
  if (week && !(week.high > week.low)) week = undefined

  // Analyst targets
  const ct = consensus.length ? consensus.map((p) => `${p.label ? `${p.label}: ` : ''}${p.text}`).join(' ') : fullText
  const C = VAL_CUR
  const pick = (...rx: RegExp[]) => { for (const r of rx) { const m = ct.match(r); if (m) return money(m[1]) } return undefined }
  const targets: Targets = {
    avg: pick(new RegExp(String.raw`(?:average|mean)\s+(?:price\s+)?target\s+(?:is\s+|of\s+)?${C}?([\d,.]+)`, 'i'), new RegExp(String.raw`mean\s*(?:target)?\s*(?:is\s*)?${C}([\d,.]+)`, 'i')),
    median: pick(new RegExp(String.raw`median(?:\s+target)?(?:\s+is)?:?\s*${C}?([\d,.]+)`, 'i')),
    low: pick(new RegExp(String.raw`\blow(?:est)?(?:\s+target)?(?:\s+is)?:?\s*${C}?([\d,.]+)`, 'i')),
    high: pick(new RegExp(String.raw`\bhigh(?:est)?(?:\s+target)?(?:\s+is)?:?\s*${C}?([\d,.]+)`, 'i')),
    count: ct.match(/(\d+)\s+(?:target-price\s+)?analysts/i) ? parseInt(ct.match(/(\d+)\s+(?:target-price\s+)?analysts/i)![1], 10) : undefined,
    rating: ct.match(/with an?\s+(.+?)\s+consensus/i)?.[1] ?? ct.match(/Consensus\s*·\s*([A-Za-z\s]+)/i)?.[1] ?? (ct.match(/Strong Buy/i) ? 'Strong Buy' : ct.match(/Moderate Buy/i) ? 'Moderate Buy' : ct.match(/\bHold\b/) ? 'Hold' : undefined),
  }
  // Targets are only meaningful when they bracket sensible values around the price.
  if (price && targets.low !== undefined && targets.high !== undefined && (targets.high < targets.low || targets.high > price * 20 || targets.low < price / 20)) { targets.low = undefined; targets.high = undefined }
  const cur = /₹|\bRs\.?\s?\d/.test(fullText) ? '₹' : '$'
  return { intro, rows, price, week, targets, consensus, cur }
}


/** `Item  Value  Comment` rows with no period columns (single-date balance sheets). */
export function parseKeyValueRows(content: string): { rows: ValRow[]; paras: Para[] } {
  const lines = normalizeKeyValueLines(cleanLines(content))
  const start = lines.findIndex((l) => /^(?:Item|Balance Sheet Item|Metric|Line Item)\b.*\b(?:Value|USD|Amount)\b/i.test(l) || /^(?:At|As of)\b.*\d{4}/i.test(l))
  const rows: ValRow[] = []
  const used = new Set<number>()
  if (start >= 0) {
    used.add(start)
    for (let i = start + 1; i < lines.length; i++) {
      const l = lines[i]
      if (/^(?:Reported|Forensic|Liquidity|Leverage|Judgement|Capital|What|Key|Calculated|Solvency)\b/i.test(l) || /^[-•–]/.test(l) || /[.!?]$/.test(l) && l.split(/\s+/).length > 9) break
      const r = splitValRow(l)
      if (r && r.label.length <= 60) { rows.push(r); used.add(i) }
      else if (rows.length && l.split(/\s+/).length <= 8) { rows[rows.length - 1].label = joinWrapped(rows[rows.length - 1].label, l); used.add(i) }
      else break
    }
  }
  return { rows: rows.length >= 4 ? rows : [], paras: toParagraphs(lines.filter((_, i) => !used.has(i)), 'label') }
}

/* ─── Scenarios (bear / base / bull) ────────────────────────────────────────── */
export interface Scenario {
  kind: 'bear' | 'base' | 'bull'
  price?: [number, number]
  cur?: string
  ret?: string
  eps?: string
  mult?: string
  desc: string
}

const RANGE = String.raw`\s*[–—-]\s*`
const CUR = String.raw`(?:US\$|USD|Rs\.?|₹|\$)`
const KINDS = ['bear', 'base', 'bull'] as const
const toNum = (s: string) => parseFloat(s.replace(/,/g, ''))
const signed = (s: string) => s.replace(/[–-]/g, '−').replace(/\s+/g, '')

const PRICE_TOK = String.raw`(?:about\s+|~\s*)?(?:(${CUR})\s*)?([\d,]+(?:\.\d+)?)(?:\s*(?:–|—|-|to)\s*(?:${CUR}\s*)?([\d,]+(?:\.\d+)?))?`
const RET_TOK = String.raw`(?:about\s+|~\s*)?([+\-−–]?\d+(?:\.\d+)?%)(?:\s*(?:to|–|-)\s*([+\-−–]?\d+(?:\.\d+)?%))?(?:\s*\([^)]*\))?`
const fmtRet = (a: string, b?: string) => (b ? `${signed(a)} to ${signed(b)}` : signed(a))

/** Three consecutive values after a (possibly wrapped) row label in flattened table text. */
function threeAfter(flat: string, label: string, tok: string, gap = 45): RegExpMatchArray | null {
  const t = String.raw`\s+`
  return flat.match(new RegExp(String.raw`(?:${label})[^%\d~$₹]{0,${gap}}?(?:${tok})${t}(?:${tok})${t}(?:${tok})`, 'i'))
}

/** `Bear Case ₹13.65 45x ₹614 – ₹751 -52% to -42%` — one table row per case (markdown pipes allowed, several rows per case merged). */
function rowPerCase(lines: string[]): { prices: { range: [number, number]; cur: string }[]; rets: string[] } | null {
  const num = String.raw`[\d,]+(?:\.\d+)?`
  const inr = lines.some((l) => /₹|\bRs\.?\s?\d/.test(l))
  const prices: { range: [number, number]; cur: string }[] = []
  const rets: string[] = []
  for (const k of KINDS) {
    const rows: { lo: number; hi: number; cur: string; r1?: string; r2?: string }[] = []
    lines.forEach((raw, i) => {
      let l = raw.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim()
      if (!new RegExp(`^${k}(?:\\s+case)?\\b(?!\\s+(?:Scenario|case\\s+assum))`, 'i').test(l) || /:\s/.test(l.slice(0, 20))) return
      if (!/%/.test(l) && lines[i + 1]) l = `${l} ${lines[i + 1].replace(/\|/g, ' ')}`
      const rg = [...l.matchAll(new RegExp(String.raw`(${CUR})?\s*(${num})\s*(?:–|—|-|to)\s*(?:${CUR})?\s*(${num})(?!\d*x|\d*%)`, 'gi'))].filter((m) => !/[x%]/i.test(l.slice(m.index! + m[0].length, m.index! + m[0].length + 1)))
      const single = [...l.matchAll(new RegExp(String.raw`(?:^|\s)(${CUR})?\s*(${num})(?=\s+[+\-−–]\d+(?:\.\d+)?%\s*$|\s+[+\-−–]\d+(?:\.\d+)?%\s+to)`, 'gi'))].pop()
      const rt = l.match(new RegExp(String.raw`([+\-−–]\d+(?:\.\d+)?%)(?:\s*to\s*([+\-−–]\d+(?:\.\d+)?%))?\s*$`))
      const pick = rg.length ? rg[rg.length - 1] : undefined
      if (pick) rows.push({ lo: toNum(pick[2]), hi: toNum(pick[3]), cur: /₹|Rs/i.test(pick[1] ?? '') || (!pick[1] && inr) ? '₹' : '$', r1: rt?.[1], r2: rt?.[2] })
      else if (single && rt) rows.push({ lo: toNum(single[2]), hi: toNum(single[2]), cur: /₹|Rs/i.test(single[1] ?? '') || (!single[1] && inr) ? '₹' : '$', r1: rt[1], r2: rt[2] })
    })
    if (!rows.length) return null
    const lo = Math.min(...rows.map((r) => r.lo))
    const hi = Math.max(...rows.map((r) => r.hi))
    prices.push({ range: [lo, hi], cur: rows[0].cur })
    const first = rows[0]
    const last = rows[rows.length - 1]
    rets.push(first.r1 ? (rows.length > 1 ? fmtRet(first.r1, last.r2 ?? last.r1) : fmtRet(first.r1, first.r2)) : '')
  }
  return { prices, rets: rets.map((r) => r || '') }
}

/** `Bear / Base / Bull` laid out as table columns or one row per case, instead of "Bear Case …" blocks. */
function parseScenarioTable(lines: string[]): Scenario[] {
  const flat = lines.join(' ')
  const rs = flat.search(/₹|\bRs\.?\s?\d/) >= 0
  let prices: { range: [number, number]; cur: string }[] = []

  const fromMatch = (m: RegExpMatchArray | null) => {
    if (!m) return false
    prices = [0, 1, 2].map((k) => {
      const cur = m[1 + k * 3]
      const a = toNum(m[2 + k * 3])
      const b = m[3 + k * 3]
      return { range: [a, b ? toNum(b) : a] as [number, number], cur: /₹|Rs/i.test(cur ?? '') || (!cur && rs) ? '₹' : '$' }
    })
    return true
  }

  if (!fromMatch(threeAfter(flat, String.raw`Estimated\s+Price\s+Range|Implied\s+Price\s+Range|Implied\s+Range|Price\s+Range|Range\s*\((?:USD|US\$|₹|Rs\.?)\)`, PRICE_TOK))) {
    fromMatch(threeAfter(flat, String.raw`Implied\s+(?:Target\s+|Share\s+|Stock\s+)?Price(?:\s+Target)?(?:\s+per\s+Share)?(?:\s*\([^)]{0,18}\))?`, PRICE_TOK))
  }
  let rowRets: string[] = []
  if (prices.length !== 3) {
    const rows = rowPerCase(lines)
    if (rows) { prices = rows.prices; rowRets = rows.rets }
  }
  if (prices.length !== 3) {
    // One row per case: "Bear $9.5B 16% … ~$140"
    prices = []
    for (const k of KINDS) {
      const row = lines.find((l) => new RegExp(`^${k}\\s+(?!case\\b)\\S*[$₹].*~\\s*[$₹]`, 'i').test(l))
      const last = row ? [...row.matchAll(/~\s*[$₹]\s*([\d,]+(?:\.\d+)?)/g)].pop() : undefined
      if (!last) return []
      const v = toNum(last[1])
      prices.push({ range: [v, v], cur: /₹/.test(row!) ? '₹' : '$' })
    }
  }

  const r = flat.match(new RegExp(String.raw`(?:Change\s+vs|Expected\s+Total\s+Return\s+vs|Implied\s+Return\s+from|Return\s+vs|\bvs\.?\s*(?:${CUR})\s*[\d,.]+)[^%]{0,45}?(?:${RET_TOK})\s+(?:${RET_TOK})\s+(?:${RET_TOK})`, 'i'))
  const rets = r ? [fmtRet(r[1], r[2]), fmtRet(r[3], r[4]), fmtRet(r[5], r[6])] : rowRets

  const desc = (k: string) => {
    const i = lines.findIndex((l) => new RegExp(`^[-•–]?\\s*${k}\\b[^:]{0,30}:`, 'i').test(l))
    if (i < 0) return ''
    let out = lines[i].replace(/^[-•–]?\s*\w+\b[^:]{0,30}:\s*/, '')
    for (let j = i + 1; j < lines.length && j < i + 4; j++) {
      if (/^[-•–]|^(Bear|Base|Bull)\b|^[A-Z][^:]{1,40}:/.test(lines[j])) break
      out = joinWrapped(out, lines[j])
    }
    return out
  }

  return KINDS.map((kind, i) => ({ kind, price: prices[i].range, cur: prices[i].cur, ret: rets[i], desc: desc(kind) }))
}

/** Price range / return pulled out of a free-text scenario block ("Implied price range ₹120–140 … Downside from ₹250 ~44–52%"). */
function blockFallback(block: string): Pick<Scenario, 'price' | 'cur' | 'ret'> {
  const pr = block.match(new RegExp(String.raw`(?:Implied|Target)\s+(?:[\w-]+\s+){0,2}?(?:price|value)(?:\s+range)?[^\d₹$]{0,12}(${CUR})?\s*([\d,]+(?:\.\d+)?)(?:\s*(?:–|—|-|to)\s*(?:${CUR})?\s*([\d,]+(?:\.\d+)?))?`, 'i'))
  const rt = block.match(/\b(Downside|Upside|Return)\b[^~%]{0,30}?~?\s*([+\-−–]?\d+(?:\.\d+)?)\s*(?:–|—|-|to)\s*([+\-−–]?\d+(?:\.\d+)?)%/i)
  const paren = !rt && pr ? block.slice((pr.index ?? 0) + pr[0].length).match(/^\s*\(\s*([+\-−–]\d+(?:\.\d+)?)%[^)]*\)/) : null
  const sign = rt ? (/down/i.test(rt[1]) ? '−' : '+') : ''
  return {
    price: pr ? [toNum(pr[2]), pr[3] ? toNum(pr[3]) : toNum(pr[2])] : undefined,
    cur: pr && /₹|Rs/i.test(pr[1] ?? block) ? '₹' : '$',
    ret: rt ? `${sign}${rt[2].replace(/^[+\-−–]/, '')}% to ${sign}${rt[3].replace(/^[+\-−–]/, '')}%` : paren ? signed(`${paren[1]}%`) : undefined,
  }
}

/** Re-join markdown pipe rows that the PDF wrapped across lines (a row is complete once it has as many pipes as the header). */
function mergePipeRows(lines: string[]): string[] {
  const pipes = (l: string) => (l.match(/\|/g) ?? []).length
  const out: string[] = []
  let want = 0
  for (const l of lines) {
    if (l.startsWith('|') && /\|\s*:?-{2,}/.test(l)) want = pipes(l)
    const prev = out[out.length - 1]
    if (prev && want && prev.startsWith('|') && pipes(prev) < want && !l.startsWith('|')) out[out.length - 1] = `${prev} ${l}`
    else out.push(l)
  }
  return out
}

export function parseScenarios(content: string): { intro: Para[]; scenarios: Scenario[] } {
  const lines = mergePipeRows(cleanLines(content))
  const tableAt = lines.findIndex((l) => /^(?:(?:Item|Scenario|Metric|Case|Parameter)\s+)?Bear\s+Base\s+Bull\s*$/i.test(l) || /^(?:Scenario|Metric\s*\/\s*Parameter|Parameter)$/i.test(l))
  const table = parseScenarioTable(lines)
  const starts = lines.map((l, i) => (/^(Bear|Base|Bull)\s+Case\b/i.test(l) ? i : -1)).filter((i) => i >= 0)
  // VRT-style blocks carry EPS × multiple → price inline; prefer them when every case resolved a price.
  const blocks = parseScenarioBlocks(lines, starts)
  const blocksOk = blocks.scenarios.length === 3 && blocks.scenarios.every((s) => s.price)
  if (blocksOk) return blocks
  if (table.length) {
    const first = lines.findIndex((l, i) => (i === tableAt && tableAt >= 0) || /^(?:Scenario|Metric|Item|Parameter)\b/i.test(l) || /^Bear\s+Base\s+Bull/i.test(l))
    return { intro: toParagraphs(first > 0 ? lines.slice(0, first) : lines.slice(0, 4), 'label'), scenarios: table }
  }
  return blocks.scenarios.length ? blocks : { intro: toParagraphs(lines, 'label'), scenarios: [] }
}

function parseScenarioBlocks(lines: string[], allStarts: number[]): { intro: Para[]; scenarios: Scenario[] } {
  // Keep one header per case: the first occurrence of each kind that is not a "Bear Case: logic…" bullet.
  const seen = new Set<string>()
  const starts = allStarts.filter((i) => {
    const k = lines[i].match(/^(Bear|Base|Bull)/i)![1].toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  if (!starts.length) return { intro: toParagraphs(lines, 'label'), scenarios: [] }
  const hdr = lines.findIndex((l) => /^Scenario\b/i.test(l))
  const introEnd = hdr >= 0 && hdr < starts[0] ? hdr : starts[0]
  const scenarios = starts.map((s, k): Scenario => {
    const rawLines = lines.slice(s, starts[k + 1] ?? lines.length)
    const block = rawLines.reduce((a, l) => joinWrapped(a, l), '')
    const kind = block.match(/^(Bear|Base|Bull)/i)![1].toLowerCase() as Scenario['kind']
    const text = block.replace(/^(Bear|Base|Bull)\s+Case\s*/i, '')
    const eps = text.match(new RegExp(String.raw`^(\$[\d.,]+${RANGE}\$[\d.,]+)`))
    const mult = text.match(new RegExp(String.raw`([\d.]+x${RANGE}[\d.]+x)`))
    const after = mult ? text.slice((mult.index ?? 0) + mult[0].length) : ''
    const price = after.match(new RegExp(String.raw`\$([\d,.]+)${RANGE}\$([\d,.]+)`))
    const ret = after.match(/([+\-−]\d[\d.]*%\s*to\s*[+\-−]\d[\d.]*%)/)
    const desc = text.slice(eps ? eps[0].length : 0, mult ? mult.index : undefined).trim()
    const fb = price ? undefined : blockFallback(text)
    return {
      kind,
      eps: eps?.[1].replace(/\s+/g, ''),
      mult: mult?.[1].replace(/\s+/g, ''),
      price: price ? [parseFloat(price[1].replace(/,/g, '')), parseFloat(price[2].replace(/,/g, ''))] : fb?.price,
      cur: fb?.price ? fb.cur : undefined,
      ret: ret?.[1] ?? fb?.ret,
      desc: fb?.price ? (rawLines.find((l) => /^(Trigger|Assumes)\b/i.test(l)) ?? rawLines.slice(1).find((l) => l.length > 30 && !/^(FY|Target|Implied|Assumption)/i.test(l)) ?? '').replace(/^(Trigger|Assumes)[^:]*:\s*/, '') : desc,
    }
  })
  return { intro: toParagraphs(lines.slice(0, introEnd), 'label'), scenarios }
}

/* ─── Technical signals ─────────────────────────────────────────────────────── */
export interface Level { price: number; text: string; desc: string; kind: 'res' | 'sup' | 'now' | 'target' }
export interface TechKpi { value: string; sub: string; cls: 'g' | 'r' | 'w' }

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)
const tone = (v: string): 'g' | 'r' | 'w' => (/bear|distribut|death|down|oversold|sell/i.test(v) ? 'r' : /bull|accumul|golden|up|buy/i.test(v) ? 'g' : 'w')
const fmtPrice = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`

function extractLevels(text: string, kind: 'res' | 'sup'): Level[] {
  const out: Level[] = []
  const re = /\$([\d,]+(?:\.\d+)?)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const seg = text
      .slice(last, m.index)
      .replace(/^[\s,;.)]*/, '')
      .replace(/^\([^)]*\)[\s,;.]*/, '')
      .replace(/^(and|followed by)\s+/i, '')
      .replace(/^the\s+/i, '')
      .replace(/\s*\(\s*$/, '')
      .replace(/\s+(at|of|near|around)\s*$/i, '')
      .trim()
    const price = parseFloat(m[1].replace(/,/g, ''))
    if (Number.isFinite(price)) out.push({ price, text: fmtPrice(price), desc: cap(seg), kind })
    last = m.index + m[0].length
  }
  return out
}

const withLabel = (paras: Para[], rx: RegExp) => paras.find((p) => p.label && rx.test(p.label))

export function parseTechnicals(content: string) {
  const paras = toParagraphs(cleanLines(content), 'label')
  const consumed = new Set<Para>()
  const take = (rx: RegExp) => { const p = withLabel(paras, rx); if (p) consumed.add(p); return p }

  const trend = take(/overall trend/i)
  const kpis: TechKpi[] = []

  const rsiP = withLabel(paras, /RSI State/i)
  const rsiM = rsiP?.text.match(/^(.*?)\s*\(([\d.]+)\)/) ?? paras.map((p) => `${p.label ?? ''} ${p.text}`.match(/RSI[^()]*\(([\d.]+)\)/)).find(Boolean)
  const rsi = rsiM ? (rsiP ? { state: rsiM[1].trim(), value: parseFloat(rsiM[2]) } : { state: '', value: parseFloat(rsiM[1]) }) : undefined
  if (rsiP) consumed.add(rsiP)

  const macd = take(/MACD/i)
  if (macd) {
    const [head, ...rest] = macd.text.split(/\.\s+/)
    kpis.push({ value: head.replace(/\.$/, ''), sub: rest.join('. ') || 'MACD', cls: tone(head) })
  }
  const obv = take(/On-Balance|OBV/i)
  if (obv) {
    const head = obv.text.split(/\s+trend|,/)[0]
    kpis.push({ value: cap(head.trim()), sub: `On-balance volume · ${obv.text.replace(/^[^,]*,\s*/, '')}`, cls: tone(head) })
  }
  const bb = take(/Bollinger/i)
  if (bb) {
    const pos = bb.text.match(/band position ([\d.]+)/i)?.[1]
    const band = (n: string) => bb.text.match(new RegExp(`${n} Band:\\s*(\\$[\\d,.]+)`, 'i'))?.[1]
    if (pos) kpis.push({ value: pos, sub: `Bollinger position · lower ${band('Lower')}, mid ${band('Middle')}, upper ${band('Upper')}`, cls: 'w' })
  }
  const ma = take(/Moving Average/i)
  if (ma) {
    const head = ma.text.match(/^(.*?)\s+(?:active|state|confirmed|signal)\b/i)?.[1] ?? ma.text.split(/\.\s/)[0]
    const x = ma.text.match(/(\d+)-day SMA \((\$[\d,.]+)\) has crossed\s+(below|above) the (\d+)-day SMA \((\$[\d,.]+)\)/i)
    kpis.push({ value: head, sub: x ? `${x[1]}-day ${x[2]} ${x[3].toLowerCase() === 'below' ? 'under' : 'over'} ${x[4]}-day ${x[5]}` : ma.text.split(/\.\s/).slice(1, 2).join(''), cls: tone(head) })
  }

  const sup = withLabel(paras, /key support/i)
  const res = withLabel(paras, /key resistance/i)
  if (sup) consumed.add(sup)
  if (res) consumed.add(res)
  const levels = [...(res ? extractLevels(res.text, 'res') : []), ...(sup ? extractLevels(sup.text, 'sup') : [])]

  return { trend, rsi, kpis, levels, rest: paras.filter((p) => !consumed.has(p)) }
}

/* ─── Final judgement ───────────────────────────────────────────────────────── */
export interface Stance { who: string; headline: string; action?: string; body: string }

const STANCE_TYPES = [
  { label: 'Existing Holders', rx: /existing\s*holders?/i },
  { label: 'Fresh Investors', rx: /fresh\s*(?:investors?|capital)|new\s*capital/i },
  { label: 'Aggressive / Traders', rx: /aggressive\s*(?:investors?|traders?)|\baggressive\b/i },
  { label: 'Conservative Investors', rx: /conservative\s*investors?|\bconservative\b/i },
]

export function parseVerdict(content: string) {
  const lines = cleanLines(content)
  const bi = lines.findIndex((l) => /^Best\s+Overall\s+Judgement\b/i.test(l))
  const stanceEnd = bi >= 0 ? bi : lines.length

  const firstStanceIdx = lines.findIndex((l) =>
    /^\s*[*•-]\s*(?:Existing|Fresh|Aggressive|Conservative)/i.test(l) ||
    /^(?:Existing\s*holders?|Fresh\s*investors?|Aggressive\s*investors?|Conservative\s*investors?)\b/i.test(l) ||
    /^Investor\s+(?:type|profile)\b/i.test(l),
  )

  const intro = lines
    .slice(0, firstStanceIdx >= 0 ? firstStanceIdx : stanceEnd)
    .filter((l) => !/^(?:Practical|Stance|Investor|Summary)\b/i.test(l))
    .reduce((a, l) => joinWrapped(a, l), '')

  const stances: Stance[] = []

  const processStance = (r: string) => {
    const c = r.indexOf(':')
    const rawWho = c > 0 ? r.slice(0, c).trim() : ''
    const matched = STANCE_TYPES.find((st) => st.rx.test(rawWho))
    const who = matched ? matched.label : (rawWho || 'Investor')
    const bodyText = (c > 0 ? r.slice(c + 1).trim() : r).trim()
    const parts = bodyText.split(/(?<=[.!?])\s+(?=[A-Z0-9₹$])/)
    const strip = (s: string) => s.replace(/\.$/, '').trim()
    const headline = strip(parts[0] || 'Hold')
    const short = parts[1] && parts[1].length <= 40 && !/^(The|This|We|In|If|Our)\b/i.test(parts[1])
    const action = short ? strip(parts[1]) : undefined
    const body = parts.slice(short ? 2 : 1).join(' ') || bodyText
    stances.push({ who, headline, action, body })
  }

  const hasBullets = lines.some((l, i) => i < stanceEnd && /^\s*[*•-]\s*(?:Existing|Fresh|Aggressive|Conservative)[^:]*:/i.test(l))

  if (hasBullets) {
    let curText = ''
    for (const l of lines.slice(firstStanceIdx >= 0 ? firstStanceIdx : 0, stanceEnd)) {
      if (/^\s*[*•-]\s*[A-Za-z]/.test(l)) {
        if (curText) processStance(curText)
        curText = l.replace(/^\s*[*•-]\s*/, '')
      } else if (curText && !/^Best/i.test(l)) {
        curText = joinWrapped(curText, l)
      }
    }
    if (curText) processStance(curText)
  } else {
    // Tabular / Sectioned format
    let curWho = ''
    let curBody = ''
    const flushTabular = () => {
      if (curWho && curBody) {
        processStance(`${curWho}: ${curBody}`)
        curWho = ''
        curBody = ''
      }
    }

    for (const l of lines.slice(firstStanceIdx >= 0 ? firstStanceIdx : 0, stanceEnd)) {
      if (/^(?:Investor\s+type|Investor\s+profile|Practical\s+stance|Stance\s+by)/i.test(l)) {
        flushTabular()
        continue
      }
      const matchedCat = STANCE_TYPES.find((st) => st.rx.test(l.split(/[:\n]/)[0]))
      if (matchedCat && (l.length < 60 || /^(?:Existing|Fresh|Aggressive|Conservative)/i.test(l))) {
        flushTabular()
        curWho = matchedCat.label
        const rem = l.replace(new RegExp(`^(?:${matchedCat.label}|existing\\s*holders?|fresh\\s*investors?|aggressive\\s*investors?|conservative\\s*investors?)\\s*[:\\-]?\\s*`, 'i'), '').trim()
        if (rem) curBody = rem
      } else if (curWho) {
        curBody = joinWrapped(curBody, l)
      }
    }
    flushTabular()
  }

  let best: { title: string; sub?: string } | undefined
  let targetZone: string | undefined
  if (bi >= 0) {
    let b = lines[bi].replace(/^Best\s+Overall\s+Judgement\s*[:\s]*/i, '')
    for (let k = bi + 1; k < lines.length && k <= bi + 4 && (b.match(/\(/g) ?? []).length > (b.match(/\)/g) ?? []).length; k++) {
      b = joinWrapped(b, lines[k])
    }
    const m = b.match(/^(.*?)\s*\((.*)\)\.?$/)
    if (m) {
      best = { title: m[1].trim(), sub: `${cap(m[2].trim())}.` }
    } else {
      const parts = b.split(/(?<=[.!?])\s+(?=[A-Z0-9₹$])/)
      best = { title: parts[0]?.replace(/\.$/, '').trim() || b, sub: parts.slice(1).join(' ') || undefined }
    }
    targetZone = b.match(new RegExp(String.raw`Targeting\s+([₹$][\d,.]+${RANGE}[₹$][\d,.]+)`, 'i'))?.[1]?.replace(/\s*[–—-]\s*/, ' – ')
  }
  return { intro, stances, best, targetZone }
}

/* ─── Price ladder ──────────────────────────────────────────────────────────── */
export function buildLadder(levels: Level[], price: number | undefined, targetZone: string | undefined): Level[] {
  const all = [...levels]
  if (price !== undefined) all.push({ price, text: fmtPrice(price), desc: 'Current price', kind: 'now' })
  if (targetZone) {
    const hi = Math.max(...(targetZone.match(/[\d,.]+/g) ?? ['0']).map((n) => parseFloat(n.replace(/,/g, ''))))
    all.push({ price: hi, text: targetZone, desc: 'Best-case target zone', kind: 'target' })
  }
  return all.sort((a, b) => b.price - a.price)
}

/* ─── Section kinds + hero derivations ──────────────────────────────────────── */
export type SectionKind =
  | 'business' | 'financials' | 'balance' | 'orders' | 'holders' | 'valuation' | 'targets'
  | 'growth' | 'risks' | 'bullish' | 'bearish' | 'levels' | 'verdict' | 'other'

const KIND_RULES: [SectionKind, RegExp][] = [
  ['business', /business quality|sector positioning/i],
  ['financials', /financial performance/i],
  ['balance', /balance[- ]sheet/i],
  ['orders', /order book|revenue visibility/i],
  ['holders', /shareholding/i],
  ['valuation', /^\W*(?:\d+\.\s*)?valuation/i],
  ['targets', /target projection|projection/i],
  ['growth', /growth potential|potential to grow/i],
  ['risks', /key risks/i],
  ['bullish', /bullish/i],
  ['bearish', /bearish/i],
  ['levels', /technical/i],
  ['verdict', /final investment judg/i],
]

export function sectionKind(title: string): SectionKind {
  return KIND_RULES.find(([, rx]) => rx.test(title))?.[0] ?? 'other'
}

export const KIND_LABEL: Record<SectionKind, string> = {
  business: 'Business', financials: 'Financials', balance: 'Balance', orders: 'Orders', holders: 'Holders',
  valuation: 'Valuation', targets: 'Targets', growth: 'Growth', risks: 'Risks', bullish: 'Bullish',
  bearish: 'Bearish', levels: 'Technicals', verdict: 'Verdict', other: 'Section',
}

interface Sec { title: string; content: string }
const findSec = (secs: Sec[], kind: SectionKind) => secs.find((s) => sectionKind(s.title) === kind)

export interface HeroKpi { label: string; value: string; cls?: 'g' | 'r' | 'w' }

export function deriveHeroKpis(secs: Sec[], fallbackText: string): HeroKpi[] {
  const out: HeroKpi[] = []
  const val = findSec(secs, 'valuation')
  const v = val ? parseValuation(val.content) : undefined
  const row = (rx: RegExp) => v?.rows.find((r) => rx.test(r.label))?.value
  const all = secs.map((s) => s.content).join(' ').replace(/\s+/g, ' ')
  const src = `${fallbackText} ${all}`

  const peg = row(/PEG/i) ?? src.match(/PEG(?:\s+ratio)?(?:\s+of)?\s+([\d.]+)/i)?.[1]
  if (peg) out.push({ label: 'PEG ratio', value: peg, cls: 'g' })
  const fpe = row(/forward P\/E/i) ?? src.match(/forward\s+P\/E\s+(?:of\s+)?([\d.]+x?)/i)?.[1]
  if (fpe) out.push({ label: 'Forward P/E', value: /x$/.test(fpe) ? fpe : `${fpe}x` })
  if (v?.price !== undefined && v.week) out.push({ label: 'Drawdown from 52-week high', value: `${Math.round((v.price / v.week.high - 1) * 100)}%`, cls: 'r' })
  else {
    const dd = src.match(/(\d+)%\s+drawdown/i)?.[1]
    if (dd) out.push({ label: 'Drawdown from 52-week high', value: `−${dd}%`, cls: 'r' })
  }
  const beta = src.match(/Beta(?:\s+of)?\s+([\d.]+)/i)?.[1]
  if (beta) out.push({ label: 'Beta · volatility', value: beta, cls: 'w' })
  return out.slice(0, 4)
}

export interface HeroChip { label: string; value: string; color: 'good' | 'bad' | 'ink' }

export function deriveChips(secs: Sec[]): HeroChip[] {
  const out: HeroChip[] = []
  const fin = findSec(secs, 'financials')
  const val = findSec(secs, 'valuation')
  const tech = findSec(secs, 'levels')
  const allText = secs.map((s) => s.content).join(' ')

  // Chip 1: ROIC / ROE / Margin
  const roic = fin ? parseReturnKpis(fin.content).find((k) => k.label === 'ROIC') : undefined
  if (roic) {
    out.push({ label: 'ROIC', value: roic.value, color: 'good' })
  } else {
    const roe = allText.match(/ROE[^%\d]{0,20}([\d.]+)%/i)?.[1]
    const gm = allText.match(/(?:Gross\s+Margin|gross\s+margin)[^%\d]{0,20}([\d.]+)%/i)?.[1]
    if (roe) out.push({ label: 'ROE', value: `${roe}%`, color: 'good' })
    else if (gm) out.push({ label: 'Gross Margin', value: `${gm}%`, color: 'good' })
  }

  // Chip 2: RSI / Beta
  const rsi = tech ? parseTechnicals(tech.content).rsi : undefined
  if (rsi) {
    out.push({ label: 'RSI · 14', value: String(rsi.value), color: rsi.value < 30 ? 'bad' : rsi.value > 70 ? 'good' : 'ink' })
  } else {
    const beta = allText.match(/Beta(?:\s+of)?\s+([\d.]+)/i)?.[1]
    if (beta) out.push({ label: 'Beta', value: beta, color: parseFloat(beta) > 1.5 ? 'bad' : 'ink' })
  }

  // Chip 3: Forward P/E / Trailing P/E / PEG
  const v = val ? parseValuation(val.content) : undefined
  const fpe = v?.rows.find((r) => /forward P\/E/i.test(r.label))
  const tpe = v?.rows.find((r) => /(?:trailing\s+P\/E|^P\/E\b)/i.test(r.label))
  const peg = v?.rows.find((r) => /PEG/i.test(r.label))
  if (fpe) out.push({ label: 'Forward P/E', value: fpe.value, color: 'ink' })
  else if (tpe) out.push({ label: 'Trailing P/E', value: tpe.value, color: 'ink' })
  else if (peg) out.push({ label: 'PEG', value: peg.value, color: 'good' })

  return out.slice(0, 3)
}
