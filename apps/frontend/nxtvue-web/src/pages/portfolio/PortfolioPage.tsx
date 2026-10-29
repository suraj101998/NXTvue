import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Sun, Moon } from 'lucide-react'
import { formatCurrency } from '@/hooks/usePortfolioHoldings'
import { SkeletonTable } from '@/components/feedback/LoadingSkeleton'
import { useIndMoneyPortfolio } from '@/hooks/useIndMoneyPortfolio'
import { useIndMoneyWatchlist } from '@/hooks/useIndMoneyWatchlist'

// Color mapping matching reference designs
const ASSET_COLORS: Record<string, string> = {
  MF: '#6ea8ff',
  EPF: '#a58bff',
  GOLD: '#f0c75e',
  STOCK: '#4fd6a0',
  PRIVATE_EQUITY: '#ff8cc6',
  'Private Equity': '#ff8cc6',
  BOND: '#8c98b3',
  FD: '#4dd3e8',
  SA: '#ffb07a',
  SILVER: '#d5dae3',
  CRYPTO: '#ff9f43',
}

type PortfolioTab = 'overview' | 'holdings' | 'watchlist'
const PORTFOLIO_TABS: PortfolioTab[] = ['overview', 'holdings', 'watchlist']

function formatCompact(num: number): string {
  const isNeg = num < 0
  const absNum = Math.abs(num)
  if (absNum >= 10000000) {
    return `${isNeg ? '−' : ''}₹${(absNum / 10000000).toFixed(1)} Cr`
  }
  if (absNum >= 100000) {
    return `${isNeg ? '−' : ''}₹${(absNum / 100000).toFixed(1)} L`
  }
  return `${isNeg ? '−' : ''}₹${absNum.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

function formatSignedINR(value: number): string {
  const isNeg = value < 0
  const absVal = Math.abs(value)
  const formatted = absVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })
  return `${isNeg ? '−₹' : '+₹'}${formatted}`
}

function formatAssetName(raw: string): string {
  const map: Record<string, string> = {
    MF: 'MF',
    EPF: 'EPF',
    GOLD: 'GOLD',
    STOCK: 'STOCK',
    PRIVATE_EQUITY: 'Private Equity',
    'Private Equity': 'Private Equity',
    BOND: 'BOND',
    FD: 'FD',
    SA: 'SA',
    SILVER: 'SILVER',
    CRYPTO: 'Crypto',
  }
  if (map[raw]) return map[raw]
  return raw.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase())
}

function getInitials(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9\s]/g, '').trim()
  const words = cleaned.split(/\s+/)
  if (words.length >= 2 && words[0] && words[1]) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

function getMarketCapInfo(rawName: string): { name: string; color: string } {
  const lower = rawName.toLowerCase()
  if (lower.includes('mid')) return { name: 'Mid cap', color: '#6ea8ff' }
  if (lower.includes('small')) return { name: 'Small cap', color: '#a58bff' }
  if (lower.includes('large')) return { name: 'Large cap', color: '#f0c75e' }
  return { name: rawName, color: '#6ea8ff' }
}

function formatLoanType(type?: string | null): string {
  if (!type) return 'Personal loan'
  return type
    .replace(/_/g, ' ')
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function formatDueDate(dateStr?: string | null): string {
  if (!dateStr) return ''
  try {
    const trimmed = dateStr.trim()
    const parts = trimmed.split(/[-/]/)
    if (parts.length === 3 && parts[0].length === 4) {
      const year = parts[0]
      const monthIdx = parseInt(parts[1], 10) - 1
      const day = parts[2].padStart(2, '0').slice(0, 2)
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const month = months[monthIdx] || parts[1]
      return `Due ${parseInt(day, 10)} ${month} ${year}`
    }
    const d = new Date(trimmed)
    if (!isNaN(d.getTime())) {
      const day = d.getDate()
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const month = months[d.getMonth()]
      const year = d.getFullYear()
      return `Due ${day} ${month} ${year}`
    }
    return `Due ${trimmed}`
  } catch {
    return `Due ${dateStr}`
  }
}

export function PortfolioPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState<PortfolioTab>(
    PORTFOLIO_TABS.includes(tabParam as PortfolioTab) ? (tabParam as PortfolioTab) : 'overview',
  )
  const [holdingsTab, setHoldingsTab] = useState<'stocks' | 'mf' | 'bonds' | 'fd'>('stocks')
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('nxtvue_portfolio_theme') as 'dark' | 'light') || 'dark'
  })

  const handleTabChange = (tab: PortfolioTab) => {
    setActiveTab(tab)
    setSearchParams({ tab })
  }

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    localStorage.setItem('nxtvue_portfolio_theme', nextTheme)
  }

  const { snapshot, holdings, loading: holdingsLoading, error: holdingsError, refresh: refreshAll } = useIndMoneyPortfolio()
  const { watchlists, loading: watchlistLoading, error: watchlistError, refresh: refreshWatchlist } = useIndMoneyWatchlist()

  const handleRefresh = () => {
    refreshAll()
    refreshWatchlist()
  }

  // ── Derived summary numbers ──────────────────────────────────────────────
  const totalValue       = snapshot?.total_current_value ?? 0
  const totalInvested    = snapshot?.total_invested ?? 0
  const totalLiabilities = snapshot?.liabilities.total ?? 0
  const totalNetworth    = snapshot?.total_networth ?? 0
  const totalPnl         = totalValue - totalInvested
  const totalPnlPct      = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0
  const todayChange      =
    (holdings?.ind_stocks.asset_summary.one_day_change ?? 0) +
    (holdings?.mutual_funds.asset_summary.one_day_change ?? 0)

  // ── Asset allocation rows ──────────────────────────────────────────────
  const allocationRows = (snapshot?.investments ?? [])
    .filter((i) => i.current_value > 0)
    .sort((a, b) => b.current_value - a.current_value)
    .map((i) => ({
      name: i.asset_type,
      current: i.current_value,
      invested: i.invested_value,
      pnl: i.return_,
      pnlPct: i.return_percentage,
      pct: i.progress_value_percentage,
      color: ASSET_COLORS[i.asset_type] ?? '#6ea8ff',
    }))

  let accPct = 0
  const donutGradientSegments = allocationRows.map((a) => {
    const start = accPct
    accPct += a.pct
    const end = Math.min(accPct, 100)
    return `${a.color} ${start.toFixed(1)}% ${end.toFixed(1)}%`
  })
  const donutGradient =
    donutGradientSegments.length > 0
      ? `conic-gradient(${donutGradientSegments.join(', ')})`
      : 'conic-gradient(#6ea8ff 0% 100%)'

  // ── Asset class rows ─────────────────────────────────────────────────
  const assetClassRows = (snapshot?.assets ?? [])
    .filter((a) => a.current_value > 0)
    .sort((a, b) => b.current_value - a.current_value)

  // ── Liabilities ──────────────────────────────────────────────────────
  const activeLoans = (snapshot?.liabilities.loans ?? []).filter((l) => l.current_balance > 0)
  const activeCards = (snapshot?.liabilities.credit_cards ?? []).filter((c) => c.total_due > 0)

  // ── Market cap split ─────────────────────────────────────────────────
  const marketCapRows = (snapshot?.market_cap ?? []).filter((m) => m.current_value > 0)

  // ── Holdings tables ──────────────────────────────────────────────────
  const stockRows = (holdings?.ind_stocks.holdings ?? []).map((h) => ({
    name: h.investment,
    initials: getInitials(h.investment),
    units: h.total_units ?? '—',
    unitPrice: h.unit_price != null ? `₹${h.unit_price.toLocaleString('en-IN')}` : '—',
    invested: formatCurrency(h.invested_amount),
    current: formatCurrency(h.market_value),
    pnl: h.total_pnl,
    pnlPct: h.pnl_per,
    oneDay: h.one_day_change,
    oneDayPct: h.one_day_change_percentage,
    broker: h.broker ?? 'Groww',
  }))

  const mfRows = (holdings?.mutual_funds.holdings ?? []).map((h) => ({
    name: h.investment,
    initials: getInitials(h.investment),
    units: h.total_units != null ? h.total_units.toLocaleString('en-IN') : '—',
    nav: h.unit_price != null ? `₹${h.unit_price.toFixed(3)}` : '—',
    invested: formatCurrency(h.invested_amount),
    current: formatCurrency(h.market_value),
    pnl: h.total_pnl,
    pnlPct: h.pnl_per,
    oneDay: h.one_day_change,
    oneDayPct: h.one_day_change_percentage,
    broker: 'Mutual Fund',
  }))

  const bondRows = (holdings?.bonds.holdings ?? []).map((h) => ({
    name: h.investment,
    initials: getInitials(h.investment),
    isin: h.investment_code ?? '—',
    units: h.total_units ?? '—',
    unitPrice: h.unit_price != null ? `₹${h.unit_price.toLocaleString('en-IN')}` : '—',
    invested: formatCurrency(h.invested_amount),
    current: formatCurrency(h.market_value),
    pnl: h.total_pnl,
    pnlPct: h.pnl_per,
    broker: 'Bonds',
  }))

  const fdRows = (holdings?.fd.holdings ?? []).map((h) => ({
    name: h.investment,
    initials: getInitials(h.investment),
    invested: formatCurrency(h.invested_amount),
    current: formatCurrency(h.market_value),
    interest: formatCurrency(h.total_pnl),
    interestPct: h.pnl_per,
    broker: 'Fixed Deposit',
  }))

  // Portfolio value vs liabilities proportions for hero bar
  const heroTotal = totalValue + totalLiabilities
  const heroPvPct = heroTotal > 0 ? Math.round((totalValue / heroTotal) * 100) : 64
  const heroLiabPct = 100 - heroPvPct

  const isLight = theme === 'light'

  return (
    <div className={`p ${isLight ? 'p-light' : ''}`}>
      <style>{`
        /* ── Text Selection (High Contrast) ─────────────────────────── */
        ::selection, *::selection {
          background: #3b82f6 !important;
          color: #ffffff !important;
        }

        /* ── Base (Dark) ─────────────────────────────────────────────── */
        .p {
          padding: 44px 56px 64px;
          background: radial-gradient(900px 520px at 88% -8%, #1c2b5a 0, #0000 62%),
                      radial-gradient(700px 420px at -5% 0, #123530 0, #0000 58%),
                      #080b12;
          color: #e8ecf5;
          font: 14px/1.45 Inter, sans-serif;
          display: flex;
          flex-direction: column;
          gap: 24px;
          min-height: 100vh;
          position: relative;
          overflow: hidden;
        }
        @media (max-width: 768px) {
          .p { padding: 28px 20px 48px; }
        }

        /* ── Light Mode Override ─────────────────────────────────────── */
        .p-light {
          background: radial-gradient(800px 460px at 90% -8%, #dfe6ff 0, #0000 62%),
                      radial-gradient(600px 380px at -5% 0, #e6f3ec 0, #0000 58%),
                      #f5f6fa;
          color: #0f1424;
        }
        .p-light h1.p-title em { color: #b45309; font-style: italic; }
        .p-light .k, .p-light .t.hd span { color: #5b6680; }
        .p-light .btn { background: #fff; border-color: #d8dde8; color: #0f1424; box-shadow: 0 1px 2px #1a24401a; }
        .p-light nav, .p-light .seg { background: #fff; border-color: #e1e5ee; }
        .p-light nav button, .p-light .seg button { color: #4a5570; }
        .p-light nav button.on, .p-light .seg .on { background: #0f1424; color: #fff; }
        .p-light .c { background: #fff; border-color: #e4e8f0; color: #0f1424; box-shadow: 0 1px 2px #1a24400d, 0 14px 34px -14px #1a244033; }
        .p-light .g { color: #0a7f52; }
        .p-light .r { color: #c73b3b; }
        .p-light .bar { background: #e8ecf4; }
        .p-light .l, .p-light .t { border-color: #edf0f6; }
        .p-light .li, .p-light .tl { background: #f8f9fc; border-color: #e4e8f0; color: #0f1424; }
        .p-light .sub button { background: #fff; border-color: #d8dde8; color: #4a5570; }
        .p-light .sub .on { background: #0f1424; border-color: #0f1424; color: #fff; }
        .p-light .t.ls { background: #fdf0f0; }
        .p-light .t u { background: #e8eeff; color: #2f55c9; }
        .p-light .t .bk { color: #5b6680; }
        .p-light .w { background: #fff; border-color: #e4e8f0; color: #0f1424; box-shadow: 0 1px 2px #1a24400d; }
        .p-light .w small { color: #5b6680; }
        .p-light .w .rd { border-color: #edf0f6; color: #0a7f52; }
        .p-light .tag { border-color: #d8dde8; color: #4a5570; }
        .p-light .mq { border-color: #e4e8f0; }
        .p-light .mq i { color: #5b6680; }
        .p-light .pill { color: #0a7f52; }
        .p-light .pill:before { background: #0a7f52; }
        .p-light .hero { background: linear-gradient(135deg, #16224a, #0b1126 65%); border-color: #16224a; }
        .p-light .hero * { color: #b8c4e6 !important; }
        .p-light .hero .big { color: #fff !important; }

        /* ── Typography ──────────────────────────────────────────────── */
        h1.p-title {
          margin: 0;
          font: 400 58px/1 'Instrument Serif', Georgia, serif;
          color: #e8ecf5;
        }
        .p-light h1.p-title { color: #0f1424; }
        h1.p-title em { color: #e8c068; }
        h2.p-heading {
          margin: 0;
          font: 400 28px/1.1 'Instrument Serif', Georgia, serif;
          color: #e8ecf5;
        }
        .p-light h2.p-heading { color: #0f1424; }
        @media (max-width: 768px) {
          h1.p-title { font-size: 40px; }
        }
        .k {
          font: 500 11px 'JetBrains Mono', monospace;
          letter-spacing: .14em;
          text-transform: uppercase;
          color: #8d98b0;
        }
        .m { font-family: 'JetBrains Mono', monospace; }
        .n { font: 400 38px/1 'Instrument Serif', Georgia, serif; }
        /* dark mode: default white, green/red both use (0,2,0) to beat .p .n */
        .p .n { color: #ffffff; }
        .p .n.g { color: #5ee3ab; }
        .p .n.r { color: #ff9393; }
        /* plain .g/.r for non-.n elements (table cells etc.) */
        .g { color: #5ee3ab; }
        .r { color: #ff9393; }
        /* donut center: always white — background is always the dark ring */
        .don .n { color: #ffffff !important; }
        .don .k { color: #8d98b0 !important; }
        /* light mode: plain .n → dark; green/red .n → coloured; donut → dark */
        .p-light .n { color: #0f1424; }
        .p-light .n.g { color: #0a7f52; }
        .p-light .n.r { color: #c73b3b; }
        .p-light .g { color: #0a7f52; }
        .p-light .r { color: #c73b3b; }
        .p-light .don .n { color: #0f1424 !important; }
        .p-light .don .k { color: #5b6680 !important; }

        /* ── Buttons ─────────────────────────────────────────────────── */
        .btn {
          display: inline-flex;
          gap: 8px;
          align-items: center;
          min-height: 44px;
          padding: 0 18px;
          border-radius: 12px;
          border: 1px solid #2a344b;
          background: #10161f;
          color: #e8ecf5;
          font: 500 14px Inter, sans-serif;
          cursor: pointer;
          transition: transform .35s cubic-bezier(.2,.7,.2,1), border-color .35s, box-shadow .35s;
        }
        .btn:hover { border-color: #e8c068; transform: translateY(-2px); }
        .btn svg { transition: transform .7s; }
        .btn:hover svg { transform: rotate(360deg); }

        /* ── Nav ─────────────────────────────────────────────────────── */
        nav.p-nav, .seg {
          display: flex;
          gap: 4px;
          padding: 4px;
          background: #0f1420;
          border: 1px solid #1e2638;
          border-radius: 14px;
          width: fit-content;
        }
        nav.p-nav button, .seg button {
          padding: 11px 22px;
          border-radius: 10px;
          color: #a3aec4;
          font: 500 14px Inter, sans-serif;
          border: 0;
          background: none;
          cursor: pointer;
          transition: all .2s ease;
        }
        nav.p-nav button.on, .seg .on {
          background: #e8c068;
          color: #15110a;
          font-weight: 600;
        }
        /* Light mode nav — must come AFTER the base rule to win the cascade */
        .p-light nav.p-nav, .p-light .seg {
          background: #ffffff;
          border-color: #e1e5ee;
        }
        .p-light nav.p-nav button, .p-light .seg button { color: #4a5570; }
        .p-light nav.p-nav button.on, .p-light .seg .on { background: #0f1424; color: #fff; }

        /* ── Cards ───────────────────────────────────────────────────── */
        .c {
          background: linear-gradient(160deg, #131a29, #0c111c);
          border: 1px solid #212b40;
          border-radius: 22px;
          padding: 28px;
        }

        /* ── Hero net worth card ─────────────────────────────────────── */
        .hero {
          flex: 1.25;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          background: linear-gradient(135deg, #1d2a4d, #0e1424 62%);
          border-color: #34457a;
          position: relative;
          overflow: hidden;
        }
        .hero:after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(110deg, #0000 38%, #ffffff26 50%, #0000 62%);
          transform: translateX(-120%);
          animation: sh 6s 1.2s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes sh { 40%, 100% { transform: translateX(120%); } }
        .big {
          font: 400 104px/1 'Instrument Serif', Georgia, serif;
          color: #fff;
          animation: bg 1.4s .2s cubic-bezier(.2,.7,.2,1) both;
        }
        @keyframes bg { from { opacity: 0; letter-spacing: .06em; filter: blur(10px); } }

        /* ── KPI 2x2 grid ────────────────────────────────────────────── */
        .kp {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          flex: 1;
        }
        .kp .c {
          padding: 22px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          justify-content: space-between;
          transition: transform .35s cubic-bezier(.2,.7,.2,1), border-color .35s;
        }
        .kp .c:hover { transform: translateY(-5px); border-color: #5b78d6; }

        /* ── Bar ─────────────────────────────────────────────────────── */
        .bar {
          height: 10px;
          border-radius: 9px;
          background: #1b2334;
          display: flex;
          overflow: hidden;
          gap: 2px;
          animation: wp 1.6s .4s cubic-bezier(.2,.7,.2,1) both;
        }
        .bar i { display: block; height: 100%; }
        @keyframes wp { from { clip-path: inset(0 100% 0 0 round 9px); } to { clip-path: inset(0 0 0 0 round 9px); } }

        /* ── Donut ───────────────────────────────────────────────────── */
        .don { position: relative; width: 230px; height: 230px; flex: none; }
        .don div {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          -webkit-mask: radial-gradient(circle, #0000 61%, #000 62%);
          mask: radial-gradient(circle, #0000 61%, #000 62%);
          animation: sp 1.6s .3s cubic-bezier(.2,.7,.2,1) both;
        }
        @keyframes sp { from { transform: rotate(-140deg) scale(.82); opacity: 0; } }
        .don p {
          position: absolute;
          inset: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }

        /* ── Allocation list rows ────────────────────────────────────── */
        .l {
          display: grid;
          grid-template-columns: 14px 1fr 56px 74px 170px;
          gap: 10px;
          align-items: center;
          padding: 9px 0;
          border-bottom: 1px solid #1a2233;
          font-size: 13px;
          animation: up .7s both;
        }
        .l i { width: 10px; height: 10px; border-radius: 3px; }
        .l b { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .l span, .l em, .l u {
          text-align: right;
          font-style: normal;
          text-decoration: none;
          font-size: 13px;
          white-space: nowrap;
        }
        @media (max-width: 640px) {
          .l { grid-template-columns: 14px 1fr auto auto; gap: 8px; }
          .l u { display: none; }
        }

        /* ── Liability item rows ─────────────────────────────────────── */
        .li {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 18px;
          border: 1px solid #212b40;
          border-radius: 16px;
          background: #0e1320;
          transition: transform .35s cubic-bezier(.2,.7,.2,1), border-color .35s;
        }
        .li:hover { transform: translateY(-5px); border-color: #5b78d6; }

        /* ── Asset class grid ────────────────────────────────────────── */
        .tg {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
        }
        @media (max-width: 640px) { .tg { grid-template-columns: 1fr; } }
        @media (min-width: 641px) and (max-width: 1023px) { .tg { grid-template-columns: repeat(2, 1fr); } }
        .tl {
          padding: 18px;
          border: 1px solid #212b40;
          border-radius: 18px;
          background: #0e1320;
          display: flex;
          flex-direction: column;
          gap: 6px;
          transition: transform .35s cubic-bezier(.2,.7,.2,1), border-color .35s;
          animation: up .7s both;
        }
        .tl:hover { transform: translateY(-5px); border-color: #5b78d6; }

        /* ── Holdings sub-tabs ───────────────────────────────────────── */
        .sub { display: flex; gap: 8px; flex-wrap: wrap; }
        .sub button {
          min-height: 44px;
          padding: 0 20px;
          border-radius: 99px;
          border: 1px solid #2a344b;
          background: #0f1420;
          color: #a3aec4;
          font: 500 14px Inter, sans-serif;
          cursor: pointer;
          transition: all .2s ease;
        }
        .sub .on { background: #3b6cff; border-color: #3b6cff; color: #fff; }

        /* ── Holdings KPI grid (.sm) ─────────────────────────────────── */
        .sm {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        @media (max-width: 640px) { .sm { grid-template-columns: repeat(2, 1fr); } }
        .sm .c {
          padding: 22px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        /* ── Table ───────────────────────────────────────────────────── */
        .t-wrap { overflow-x: auto; }
        .t {
          display: grid;
          grid-template-columns: 2.7fr .5fr .9fr .9fr .9fr .8fr .8fr .9fr .8fr;
          gap: 12px;
          align-items: center;
          padding: 0 24px;
          min-height: 52px;
          min-width: 900px;
          border-bottom: 1px solid #1a2233;
          transition: background .25s;
        }
        .t:not(.hd):hover { background: #ffffff0a; }
        .t span {
          text-align: right;
          font: 400 13px 'JetBrains Mono', monospace;
        }
        .t.hd { min-height: 48px; }
        .t.hd span {
          font: 500 11px 'JetBrains Mono', monospace;
          letter-spacing: .12em;
          text-transform: uppercase;
          color: #8d98b0;
        }
        .t b { display: flex; gap: 12px; align-items: center; font-weight: 500; }
        .t u {
          width: 30px;
          height: 30px;
          border-radius: 9px;
          background: #1c2742;
          color: #9db6ff;
          display: grid;
          place-items: center;
          font: 500 11px 'JetBrains Mono', monospace;
          text-decoration: none;
          flex: none;
        }
        .t .bk { color: #a3aec4; font: 500 12px Inter, sans-serif; }
        .t.ls { background: #26141a; }

        /* ── Watchlist grid ──────────────────────────────────────────── */
        .wg {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
        }
        @media (max-width: 640px) { .wg { grid-template-columns: repeat(2, 1fr); } }
        @media (min-width: 641px) and (max-width: 1023px) { .wg { grid-template-columns: repeat(3, 1fr); } }
        .w {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 18px;
          border-radius: 18px;
          border: 1px solid #212b40;
          background: linear-gradient(160deg, #131a29, #0d121d);
          color: #e8ecf5;
          text-align: left;
          cursor: pointer;
          font: inherit;
          transition: transform .35s cubic-bezier(.2,.7,.2,1), border-color .35s;
          animation: up .7s both;
        }
        .w:hover { transform: translateY(-5px); border-color: #e8c068; }
        .w .a { display: flex; justify-content: space-between; align-items: center; }
        .w b { font: 500 20px 'JetBrains Mono', monospace; }
        .w small { color: #8d98b0; font: 400 11px 'JetBrains Mono', monospace; }
        .w .rd {
          display: flex;
          justify-content: space-between;
          color: #5ee3ab;
          font-size: 12px;
          font-weight: 500;
          padding-top: 12px;
          border-top: 1px solid #1a2233;
        }
        .tag {
          font: 500 10px 'JetBrains Mono', monospace;
          letter-spacing: .1em;
          padding: 3px 8px;
          border-radius: 99px;
          border: 1px solid #2a344b;
          color: #a3aec4;
        }

        /* ── Marquee ─────────────────────────────────────────────────── */
        .mq {
          overflow: hidden;
          border: 1px solid #212b40;
          border-radius: 14px;
          padding: 13px 0;
          -webkit-mask: linear-gradient(90deg, #0000, #000 7%, #000 93%, #0000);
          mask: linear-gradient(90deg, #0000, #000 7%, #000 93%, #0000);
        }
        .mq div {
          display: flex;
          gap: 40px;
          width: max-content;
          animation: mq 46s linear infinite;
        }
        .mq:hover div { animation-play-state: paused; }
        .mq span {
          display: flex;
          gap: 10px;
          align-items: baseline;
          font: 500 13px 'JetBrains Mono', monospace;
          white-space: nowrap;
        }
        .mq i { font-style: normal; color: #8d98b0; font-size: 11px; letter-spacing: .1em; }
        @keyframes mq { to { transform: translateX(-50%); } }

        /* ── Pill ────────────────────────────────────────────────────── */
        .pill {
          display: inline-flex;
          gap: 8px;
          align-items: center;
          font: 500 11px 'JetBrains Mono', monospace;
          letter-spacing: .1em;
          color: #5ee3ab;
        }
        .pill:before {
          content: '';
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #5ee3ab;
          animation: pl 1.8s infinite;
        }
        @keyframes pl {
          0% { box-shadow: 0 0 0 0 rgba(94, 227, 171, 0.67); }
          100% { box-shadow: 0 0 0 10px rgba(94, 227, 171, 0); }
        }

        /* ── Row / Col layout ────────────────────────────────────────── */
        .p-row {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        @media (min-width: 1024px) { .p-row { flex-direction: row; } }
        .p-col { display: flex; flex-direction: column; gap: 14px; }

        /* ── Aurora ──────────────────────────────────────────────────── */
        .aur {
          position: absolute;
          inset: -60px -60px auto;
          height: 760px;
          pointer-events: none;
          z-index: 0;
          filter: blur(24px);
          animation: dr 14s ease-in-out infinite alternate;
        }
        .p:not(.p-light) .aur {
          background: radial-gradient(closest-side, #3b6cff66, #0000) 18% 30% / 560px 560px no-repeat,
                      radial-gradient(closest-side, #2fd6a050, #0000) 82% 22% / 500px 500px no-repeat,
                      radial-gradient(closest-side, #e8c06838, #0000) 55% 60% / 420px 420px no-repeat;
        }
        .p-light .aur {
          background: radial-gradient(closest-side, #8fa8ff80, #0000) 18% 30% / 560px 560px no-repeat,
                      radial-gradient(closest-side, #7fe0b870, #0000) 82% 22% / 500px 500px no-repeat,
                      radial-gradient(closest-side, #f3cf7a60, #0000) 55% 60% / 420px 420px no-repeat;
        }
        @keyframes dr { to { transform: translate(70px, 46px) scale(1.14); } }

        /* ── Enter animations ────────────────────────────────────────── */
        .p > :not(.aur) {
          position: relative;
          z-index: 1;
          animation: up .9s cubic-bezier(.2,.7,.2,1) both;
        }
        .p > :nth-child(3) { animation-delay: .08s; }
        .p > :nth-child(4) { animation-delay: .16s; }
        .p > :nth-child(5) { animation-delay: .24s; }
        .p > :nth-child(6) { animation-delay: .32s; }
        .p > :nth-child(7) { animation-delay: .4s; }
        .l:nth-child(1) { animation-delay: .3s; }
        .l:nth-child(2) { animation-delay: .38s; }
        .l:nth-child(3) { animation-delay: .46s; }
        .l:nth-child(4) { animation-delay: .54s; }
        .l:nth-child(5) { animation-delay: .62s; }
        .l:nth-child(6) { animation-delay: .7s; }
        .l:nth-child(7) { animation-delay: .78s; }
        .l:nth-child(8) { animation-delay: .86s; }
        .l:nth-child(9) { animation-delay: .94s; }
        .tl:nth-child(3n+2), .w:nth-child(4n+2) { animation-delay: .12s; }
        .tl:nth-child(3n), .w:nth-child(4n+3) { animation-delay: .24s; }
        .w:nth-child(4n) { animation-delay: .36s; }
        @keyframes up { from { opacity: 0; transform: translateY(22px); } }

        @media (prefers-reduced-motion: reduce) {
          *, *:before, *:after { animation: none !important; transition: none !important; }
        }
      `}</style>

      {/* Aurora */}
      <div className="aur" />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div className="k">Real-time valuation · Summary of the portfolio</div>
          <h1 className="p-title">Your wealth, <em>at a glance</em></h1>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button onClick={toggleTheme} className="btn" title={`Switch to ${isLight ? 'Dark' : 'Light'} mode`} aria-label="Toggle Theme">
            {isLight ? <Moon width={16} height={16} /> : <Sun width={16} height={16} />}
            <span>{isLight ? 'Dark' : 'Light'}</span>
          </button>
          <button
            onClick={handleRefresh}
            disabled={holdingsLoading || watchlistLoading}
            className="btn"
            aria-label="Refresh Data"
          >
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              aria-hidden="true"
              style={{ animation: (holdingsLoading || watchlistLoading) ? 'p-rot 1s linear infinite' : undefined }}
            >
              <path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Nav ────────────────────────────────────────────────────────── */}
      <nav className="p-nav" aria-label="Pages">
        <button onClick={() => handleTabChange('overview')} className={activeTab === 'overview' ? 'on' : ''}>Overview</button>
        <button onClick={() => handleTabChange('holdings')} className={activeTab === 'holdings' ? 'on' : ''}>Holdings</button>
        <button onClick={() => handleTabChange('watchlist')} className={activeTab === 'watchlist' ? 'on' : ''}>Watchlist</button>
      </nav>

      {/* ── Marquee ─────────────────────────────────────────────────────── */}
      <div className="mq" aria-label="Market ticker">
        <div>
          {activeTab === 'overview' && (
            <>
              <span><i>MF</i><b className="g">▲ +6.12%</b></span>
              <span><i>GOLD</i><b className="g">▲ +5.50%</b></span>
              <span><i>SILVER</i><b className="g">▲ +154.23%</b></span>
              <span><i>FD</i><b className="g">▲ +8.01%</b></span>
              <span><i>PRIVATE EQUITY</i><b className="g">▲ +3.53%</b></span>
              <span><i>BOND</i><b className="g">▲ +0.17%</b></span>
              <span><i>STOCK</i><b className={totalPnl >= 0 ? 'g' : 'r'}>{totalPnl >= 0 ? '▲' : '▼'} {totalPnlPct.toFixed(2)}%</b></span>
              <span><i>TODAY</i><b className={todayChange >= 0 ? 'g' : 'r'}>{todayChange >= 0 ? '▲ +' : '▼ −'}{formatCompact(Math.abs(todayChange))}</b></span>
              <span><i>OVERALL P&amp;L</i><b className={totalPnl >= 0 ? 'g' : 'r'}>{totalPnl >= 0 ? '▲ +' : '▼ '}{totalPnlPct.toFixed(2)}%</b></span>
              <span aria-hidden="true" style={{ display: 'contents' }}>
                <span><i>MF</i><b className="g">▲ +6.12%</b></span>
                <span><i>GOLD</i><b className="g">▲ +5.50%</b></span>
                <span><i>SILVER</i><b className="g">▲ +154.23%</b></span>
                <span><i>FD</i><b className="g">▲ +8.01%</b></span>
                <span><i>PRIVATE EQUITY</i><b className="g">▲ +3.53%</b></span>
                <span><i>BOND</i><b className="g">▲ +0.17%</b></span>
                <span><i>STOCK</i><b className={totalPnl >= 0 ? 'g' : 'r'}>{totalPnl >= 0 ? '▲' : '▼'} {totalPnlPct.toFixed(2)}%</b></span>
                <span><i>TODAY</i><b className={todayChange >= 0 ? 'g' : 'r'}>{todayChange >= 0 ? '▲ +' : '▼ −'}{formatCompact(Math.abs(todayChange))}</b></span>
                <span><i>OVERALL P&amp;L</i><b className={totalPnl >= 0 ? 'g' : 'r'}>{totalPnl >= 0 ? '▲ +' : '▼ '}{totalPnlPct.toFixed(2)}%</b></span>
              </span>
            </>
          )}
          {activeTab === 'holdings' && (
            <>
              <span><i>MCX</i><b className="g">▲ +₹655.2</b></span>
              <span><i>MTAR</i><b className="g">▲ +₹728</b></span>
              <span><i>BSE</i><b className="g">▲ +₹85</b></span>
              <span><i>LUPIN</i><b className="g">▲ +₹86</b></span>
              <span><i>SBI</i><b className="g">▲ +₹151</b></span>
              <span><i>HIND. COPPER</i><b className="g">▲ +₹72.45</b></span>
              <span><i>FORTIS</i><b className="r">▼ −₹46</b></span>
              <span><i>SILVER ETF</i><b className="r">▼ −₹37.8</b></span>
              <span><i>HINDALCO</i><b className="r">▼ −₹14.9</b></span>
              <span><i>NASDAQ 100 ETF</i><b className="r">▼ −₹13.32</b></span>
              <span aria-hidden="true" style={{ display: 'contents' }}>
                <span><i>MCX</i><b className="g">▲ +₹655.2</b></span>
                <span><i>MTAR</i><b className="g">▲ +₹728</b></span>
                <span><i>BSE</i><b className="g">▲ +₹85</b></span>
                <span><i>LUPIN</i><b className="g">▲ +₹86</b></span>
                <span><i>SBI</i><b className="g">▲ +₹151</b></span>
                <span><i>HIND. COPPER</i><b className="g">▲ +₹72.45</b></span>
                <span><i>FORTIS</i><b className="r">▼ −₹46</b></span>
                <span><i>SILVER ETF</i><b className="r">▼ −₹37.8</b></span>
                <span><i>HINDALCO</i><b className="r">▼ −₹14.9</b></span>
                <span><i>NASDAQ 100 ETF</i><b className="r">▼ −₹13.32</b></span>
              </span>
            </>
          )}
          {activeTab === 'watchlist' && (
            <>
              {watchlists.flatMap((wl) => wl.stocks).slice(0, 14).map((s, i) => (
                <span key={i}><b>{s.ticker || '—'}</b><i>{s.market === 'india' ? 'IN' : 'US'}</i></span>
              ))}
              <span aria-hidden="true" style={{ display: 'contents' }}>
                {watchlists.flatMap((wl) => wl.stocks).slice(0, 14).map((s, i) => (
                  <span key={`d-${i}`}><b>{s.ticker || '—'}</b><i>{s.market === 'india' ? 'IN' : 'US'}</i></span>
                ))}
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Error Banner ─────────────────────────────────────────────────── */}
      {holdingsError && (
        <div className="c" style={{ borderColor: 'rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)' }}>
          <p className="r" style={{ fontWeight: 600, margin: 0 }}>Failed to load live portfolio data</p>
          <p style={{ fontSize: '13px', margin: '4px 0 12px' }}>{holdingsError.userMessage}</p>
          <button onClick={handleRefresh} className="btn">Retry Now</button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* OVERVIEW TAB                                                      */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <>
          {/* Row 1: Hero net worth + KPI 2x2 */}
          <div className="p-row">
            {/* Hero */}
            <div className="c hero">
              <div className="k">Net worth</div>
              <div>
                <div className="big">{holdingsLoading ? '…' : formatCompact(totalNetworth)}</div>
                <div style={{ color: '#a3aec4', marginTop: '10px' }}>
                  {formatCompact(totalValue)} portfolio value − {formatCompact(totalLiabilities)} liabilities
                </div>
              </div>
              <div>
                <div className="bar">
                  <i style={{ width: `${heroPvPct}%`, background: '#e8c068' }} />
                  <i style={{ width: `${heroLiabPct}%`, background: '#ff9393' }} />
                </div>
                <div className="m" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '12px', color: '#a3aec4' }}>
                  <span>Portfolio value {heroPvPct}%</span>
                  <span>Liabilities {heroLiabPct}%</span>
                </div>
              </div>
            </div>

            {/* KPI 2×2 */}
            <div className="kp">
              <div className="c">
                <div className="k">Portfolio value</div>
                <div><div className="n">{holdingsLoading ? '…' : formatCompact(totalValue)}</div></div>
              </div>
              <div className="c">
                <div className="k">Amount invested</div>
                <div><div className="n">{holdingsLoading ? '…' : formatCompact(totalInvested)}</div></div>
              </div>
              <div className="c">
                <div className="k">Overall P&amp;L</div>
                <div>
                  <div className={`n ${totalPnl >= 0 ? 'g' : 'r'}`}>
                    {totalPnl >= 0 ? '+' : '−'}₹{Math.abs(totalPnl).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </div>
                  <div className={`m ${totalPnl >= 0 ? 'g' : 'r'}`} style={{ marginTop: '8px', fontSize: '12px' }}>
                    {totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%
                  </div>
                </div>
              </div>
              <div className="c">
                <div className="k">Today's change</div>
                <div>
                  <div className={`n ${todayChange >= 0 ? 'g' : 'r'}`}>
                    {todayChange >= 0 ? '+' : '−'}₹{Math.abs(todayChange).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Asset type allocation + Liabilities + Market cap */}
          <div className="p-row">
            {/* Asset type allocation */}
            <div className="c" style={{ flex: 1.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '20px' }}>
                <h2 className="p-heading">Asset type allocation</h2>
                <span className="k">{allocationRows.length} asset types</span>
              </div>
              <div className="p-row" style={{ gap: '32px', alignItems: 'center' }}>
                <div className="don" role="img" aria-label="Donut chart of asset allocation">
                  <div style={{ background: donutGradient }} />
                  <p>
                    <span className="k">Total</span>
                    <span className="n">{formatCompact(totalValue)}</span>
                  </p>
                </div>
                <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
                  {allocationRows.map((a) => (
                    <div key={a.name} className="l">
                      <i style={{ background: a.color }} />
                      <b title={formatAssetName(a.name)}>{formatAssetName(a.name)}</b>
                      <span className="m">{a.pct.toFixed(1)}%</span>
                      <em className="m">{formatCompact(a.current)}</em>
                      <u className={`m ${a.pnl >= 0 ? 'g' : 'r'}`}>
                        {formatSignedINR(a.pnl)} ({a.pnlPct >= 0 ? '+' : ''}{a.pnlPct.toFixed(2)}%)
                      </u>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right column: Liabilities + Market cap */}
            <div className="p-col" style={{ flex: 1 }}>
              {/* Liabilities */}
              <div className="c">
                <h2 className="p-heading" style={{ marginBottom: '16px' }}>Liabilities</h2>
                <div className="p-col">
                  {activeLoans.length === 0 && activeCards.length === 0 ? (
                    <div style={{ color: '#8d98b0', fontSize: '13px', padding: '12px 0' }}>No active liabilities</div>
                  ) : (
                    <>
                      {activeLoans.map((l) => (
                        <div key={l.lender} className="li">
                          <div>
                            <b>{l.lender}</b>
                            <div style={{ color: '#8d98b0', fontSize: '12px' }}>{formatLoanType(l.loan_type)}</div>
                          </div>
                          <span className="n r" style={{ fontSize: '26px' }}>{formatCompact(l.current_balance)}</span>
                        </div>
                      ))}
                      {activeCards.map((c) => (
                        <div key={c.name} className="li">
                          <div>
                            <b>{c.name}</b>
                            {c.due_date && <div style={{ color: '#8d98b0', fontSize: '12px' }}>{formatDueDate(c.due_date)}</div>}
                          </div>
                          <span className="n r" style={{ fontSize: '26px' }}>{formatCurrency(c.total_due)}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>

              {/* Market cap split */}
              <div className="c">
                <h2 className="p-heading" style={{ marginBottom: '16px' }}>Market cap split</h2>
                <div className="bar" style={{ height: '14px', marginBottom: '18px' }}>
                  {marketCapRows.map((m) => {
                    const info = getMarketCapInfo(m.market_cap)
                    return <i key={m.market_cap} style={{ width: `${m.progress_value_percentage}%`, background: info.color }} />
                  })}
                </div>
                {marketCapRows.map((m, idx) => {
                  const info = getMarketCapInfo(m.market_cap)
                  return (
                    <div
                      key={m.market_cap}
                      className="l"
                      style={{ gridTemplateColumns: '14px 1fr auto auto', borderBottom: idx === marketCapRows.length - 1 ? 'none' : undefined }}
                    >
                      <i style={{ background: info.color }} />
                      <b>{info.name}</b>
                      <span className="m">{formatCurrency(m.current_value)}</span>
                      <span className="m" style={{ color: '#8d98b0' }}>{m.progress_value_percentage.toFixed(1)}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Row 3: Asset class breakdown */}
          <div className="c">
            <h2 className="p-heading" style={{ marginBottom: '18px' }}>Asset class breakdown</h2>
            <div className="tg">
              {assetClassRows.map((a) => (
                <div key={a.assetclass_l2} className="tl">
                  <div className="k">{a.assetclass_l2}</div>
                  <div className="n">{formatCompact(a.current_value)}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }} className="m">
                    <span style={{ color: '#8d98b0', fontSize: '12px' }}>Invested {formatCompact(a.invested_value)}</span>
                    <span className={a.return_ >= 0 ? 'g' : 'r'} style={{ fontSize: '13px' }}>
                      {a.return_ >= 0 ? '+' : ''}{a.return_percentage.toFixed(2)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* HOLDINGS TAB                                                      */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'holdings' && (
        <>
          {/* Holdings sub-tabs */}
          <div className="sub">
            <button onClick={() => setHoldingsTab('stocks')} className={holdingsTab === 'stocks' ? 'on' : ''}>Stocks</button>
            <button onClick={() => setHoldingsTab('mf')} className={holdingsTab === 'mf' ? 'on' : ''}>Mutual funds</button>
            <button onClick={() => setHoldingsTab('bonds')} className={holdingsTab === 'bonds' ? 'on' : ''}>Bonds</button>
            <button onClick={() => setHoldingsTab('fd')} className={holdingsTab === 'fd' ? 'on' : ''}>Fixed deposits</button>
          </div>

          {/* Stocks */}
          {holdingsTab === 'stocks' && (
            <>
              <div className="sm">
                <div className="c"><div className="k">Total value</div><div className="n">{formatCompact(holdings?.ind_stocks.asset_summary.total_value ?? 0)}</div></div>
                <div className="c"><div className="k">Invested</div><div className="n">{formatCompact(holdings?.ind_stocks.asset_summary.invested ?? 0)}</div></div>
                <div className="c">
                  <div className="k">Today's P&amp;L</div>
                  <div className={`n ${(holdings?.ind_stocks.asset_summary.one_day_change ?? 0) >= 0 ? 'g' : 'r'}`}>
                    {formatCurrency(holdings?.ind_stocks.asset_summary.one_day_change ?? 0)}
                  </div>
                </div>
                <div className="c"><div className="k">Holdings</div><div className="n">{stockRows.length}</div></div>
              </div>
              <div className="c" style={{ padding: '8px 0' }}>
                <div className="t-wrap">
                  <div className="t hd">
                    <span style={{ textAlign: 'left' }}>Stock</span>
                    <span>Units</span><span>Unit price</span><span>Invested</span>
                    <span>Current</span><span>P&amp;L</span><span>P&amp;L %</span>
                    <span>1D change</span><span>Broker</span>
                  </div>
                  {holdingsLoading ? (
                    <div style={{ padding: '24px' }}><SkeletonTable rows={5} columns={9} /></div>
                  ) : (
                    stockRows.map((h) => (
                      <div key={h.name} className={`t ${h.pnl < 0 ? 'ls' : ''}`}>
                        <b><u>{h.initials}</u><span style={{ textAlign: 'left', fontFamily: 'Inter, sans-serif' }}>{h.name}</span></b>
                        <span>{h.units}</span>
                        <span>{h.unitPrice}</span>
                        <span>{h.invested}</span>
                        <span>{h.current}</span>
                        <span className={h.pnl >= 0 ? 'g' : 'r'}>{h.pnl >= 0 ? '+' : ''}{formatCurrency(h.pnl)}</span>
                        <span className={h.pnlPct >= 0 ? 'g' : 'r'}>{h.pnlPct >= 0 ? '+' : ''}{h.pnlPct.toFixed(2)}%</span>
                        <span className={h.oneDay >= 0 ? 'g' : 'r'}>{h.oneDay >= 0 ? '+' : ''}{formatCurrency(h.oneDay)}</span>
                        <span className="bk">{h.broker}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          {/* Mutual Funds */}
          {holdingsTab === 'mf' && (
            <>
              <div className="sm">
                <div className="c"><div className="k">Total value</div><div className="n">{formatCompact(holdings?.mutual_funds.asset_summary.total_value ?? 0)}</div></div>
                <div className="c"><div className="k">Invested</div><div className="n">{formatCompact(holdings?.mutual_funds.asset_summary.invested ?? 0)}</div></div>
                <div className="c">
                  <div className="k">Total P&amp;L</div>
                  <div className={`n ${((holdings?.mutual_funds.asset_summary.total_value ?? 0) - (holdings?.mutual_funds.asset_summary.invested ?? 0)) >= 0 ? 'g' : 'r'}`}>
                    {formatCompact((holdings?.mutual_funds.asset_summary.total_value ?? 0) - (holdings?.mutual_funds.asset_summary.invested ?? 0))}
                  </div>
                </div>
                <div className="c">
                  <div className="k">Today's move</div>
                  <div className={`n ${(holdings?.mutual_funds.asset_summary.one_day_change ?? 0) >= 0 ? 'g' : 'r'}`}>
                    {formatCurrency(holdings?.mutual_funds.asset_summary.one_day_change ?? 0)}
                  </div>
                </div>
              </div>
              <div className="c" style={{ padding: '8px 0' }}>
                <div className="t-wrap">
                  <div className="t hd">
                    <span style={{ textAlign: 'left' }}>Fund</span>
                    <span>Units</span><span>NAV</span><span>Invested</span>
                    <span>Current</span><span>P&amp;L</span><span>P&amp;L %</span>
                    <span>1D change</span><span>Type</span>
                  </div>
                  {mfRows.map((h) => (
                    <div key={h.name} className="t">
                      <b><u>{h.initials}</u><span style={{ textAlign: 'left', fontFamily: 'Inter, sans-serif' }}>{h.name}</span></b>
                      <span>{h.units}</span><span>{h.nav}</span>
                      <span>{h.invested}</span><span>{h.current}</span>
                      <span className={h.pnl >= 0 ? 'g' : 'r'}>{h.pnl >= 0 ? '+' : ''}{formatCurrency(h.pnl)}</span>
                      <span className={h.pnlPct >= 0 ? 'g' : 'r'}>{h.pnlPct >= 0 ? '+' : ''}{h.pnlPct.toFixed(2)}%</span>
                      <span className={h.oneDay >= 0 ? 'g' : 'r'}>{h.oneDay >= 0 ? '+' : ''}{formatCurrency(h.oneDay)}</span>
                      <span className="bk">{h.broker}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Bonds */}
          {holdingsTab === 'bonds' && (
            <>
              <div className="sm" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <div className="c"><div className="k">Total value</div><div className="n">{formatCompact(holdings?.bonds.asset_summary.total_value ?? 0)}</div></div>
                <div className="c"><div className="k">Invested</div><div className="n">{formatCompact(holdings?.bonds.asset_summary.invested ?? 0)}</div></div>
                <div className="c">
                  <div className="k">P&amp;L</div>
                  <div className={`n ${((holdings?.bonds.asset_summary.total_value ?? 0) - (holdings?.bonds.asset_summary.invested ?? 0)) >= 0 ? 'g' : 'r'}`}>
                    {formatCompact((holdings?.bonds.asset_summary.total_value ?? 0) - (holdings?.bonds.asset_summary.invested ?? 0))}
                  </div>
                </div>
              </div>
              <div className="c" style={{ padding: '8px 0' }}>
                <div className="t-wrap">
                  <div className="t hd">
                    <span style={{ textAlign: 'left' }}>Bond</span>
                    <span>ISIN</span><span>Units</span><span>Unit price</span>
                    <span>Invested</span><span>Current</span><span>P&amp;L</span>
                    <span>P&amp;L %</span><span>Type</span>
                  </div>
                  {bondRows.map((h) => (
                    <div key={h.name} className="t">
                      <b><u>{h.initials}</u><span style={{ textAlign: 'left', fontFamily: 'Inter, sans-serif' }}>{h.name}</span></b>
                      <span style={{ color: '#8d98b0', fontSize: '11px' }}>{h.isin}</span>
                      <span>{h.units}</span><span>{h.unitPrice}</span>
                      <span>{h.invested}</span><span>{h.current}</span>
                      <span className={h.pnl >= 0 ? 'g' : 'r'}>{h.pnl >= 0 ? '+' : ''}{formatCurrency(h.pnl)}</span>
                      <span className={h.pnlPct >= 0 ? 'g' : 'r'}>{h.pnlPct >= 0 ? '+' : ''}{h.pnlPct.toFixed(2)}%</span>
                      <span className="bk">{h.broker}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Fixed Deposits */}
          {holdingsTab === 'fd' && (
            <>
              <div className="sm" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <div className="c"><div className="k">Total value</div><div className="n">{formatCompact(holdings?.fd.asset_summary.total_value ?? 0)}</div></div>
                <div className="c"><div className="k">Principal</div><div className="n">{formatCompact(holdings?.fd.asset_summary.invested ?? 0)}</div></div>
                <div className="c">
                  <div className="k">Interest earned</div>
                  <div className="n g">{formatCompact((holdings?.fd.asset_summary.total_value ?? 0) - (holdings?.fd.asset_summary.invested ?? 0))}</div>
                </div>
              </div>
              <div className="c" style={{ padding: '8px 0' }}>
                <div className="t-wrap">
                  <div className="t hd" style={{ gridTemplateColumns: '3fr 1fr 1fr 1fr 1fr' }}>
                    <span style={{ textAlign: 'left' }}>Bank / Deposit</span>
                    <span>Principal</span><span>Current value</span>
                    <span>Interest earned</span><span>Return %</span>
                  </div>
                  {fdRows.map((h) => (
                    <div key={h.name} className="t" style={{ gridTemplateColumns: '3fr 1fr 1fr 1fr 1fr' }}>
                      <b><u>{h.initials}</u><span style={{ textAlign: 'left', fontFamily: 'Inter, sans-serif' }}>{h.name}</span></b>
                      <span>{h.invested}</span><span>{h.current}</span>
                      <span className="g">+{h.interest}</span>
                      <span className="g">+{h.interestPct.toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* WATCHLIST TAB                                                     */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'watchlist' && (
        <>
          {watchlistError && (
            <div className="c" style={{ borderColor: 'rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)' }}>
              <p className="r" style={{ fontWeight: 600, margin: 0 }}>Failed to load Watchlist data</p>
              <p style={{ fontSize: '13px', margin: '4px 0 12px' }}>{watchlistError.userMessage}</p>
              <button onClick={refreshWatchlist} className="btn">Retry Now</button>
            </div>
          )}
          {watchlistLoading && (
            <div className="c"><SkeletonTable rows={4} columns={4} /></div>
          )}
          {!watchlistLoading && watchlists.map((wl) => {
            const usCount = wl.stocks.filter((s) => s.market === 'us').length
            const inCount = wl.stocks.filter((s) => s.market === 'india').length
            return (
              <div key={wl.watchlist_id} className="c">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '18px' }}>
                  <h2 className="p-heading">{wl.name}</h2>
                  <span className="k">{wl.stocks.length} assets · {usCount} US · {inCount} India</span>
                </div>
                <div className="wg">
                  {wl.stocks.map((s, idx) => {
                    const ticker = s.ticker || ''
                    const isIndia = s.market === 'india'
                    const hasReport = s.has_report || false
                    return (
                      <button
                        key={`${ticker}-${idx}`}
                        onClick={() => navigate(`/analysis?ticker=${ticker}&market=${s.market}${hasReport ? '' : '&generate=true'}`)}
                        className="w"
                      >
                        <span className="a">
                          <b>{ticker}</b>
                          <span className="tag">{isIndia ? 'IN' : 'US'}</span>
                        </span>
                        <small>{isIndia ? 'NSE / BSE' : 'NASDAQ / NYSE'}</small>
                        <span className="rd">
                          <span>● {hasReport ? 'Report ready' : 'Watch'}</span>
                          <span style={{ color: isLight ? '#0f1424' : '#e8ecf5' }}>
                            {hasReport ? 'View report' : 'Generate'}{' '}
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                              <path d="M5 12h14M13 6l6 6-6 6" />
                            </svg>
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
