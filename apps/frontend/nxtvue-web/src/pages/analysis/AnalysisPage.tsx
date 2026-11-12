/**
 * AnalysisPage — dark-theme institutional report page.
 *
 * Visual design: port of the NXTvue reference HTML (aurora bg, glassmorphism,
 * mascot with eye-tracking, scroll-reveal, section jump-bar, footer CTA).
 * All wiring kept identical to the original (fetch → /api/v1/analysis/:ticker,
 * SSE via useAnalysis hook, A.R.I.A chat via /api/v1/chat).
 * Nothing hard-coded — everything comes from the DynamicReport API response.
 */

import './analysis.css'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useSearchParams, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAnalysis } from '@/hooks/useAnalysis'
import { GlassCard, KpiCard, Note, Rev } from './reportUi'
import { Bullets, SectionBody } from './reportSections'
import { KIND_LABEL, deriveChips, deriveHeroKpis, parseValuation, parseVerdict, sectionKind } from './reportParser'
import type { SectionKind } from './reportParser'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import {
  LayoutDashboard, CandlestickChart, LineChart, BarChart2, Info,
  Menu, X, Sun, Moon, RefreshCw, AlertCircle, ChevronRight,
} from 'lucide-react'

/* ─── Public types (kept for importers) ─────────────────────────────────────── */
export interface AnalysisSection {
  title: string
  content: string
}
export interface DynamicReport {
  symbol: string
  name: string
  subtitle: string
  analysisDoc: string
  pdfUrl?: string
  judgementTag: string
  judgementText: string
  executiveSummary: { label: string; text: string }[]
  summaryNote: string
  sections: AnalysisSection[]
  full_text?: string
}

/** Callback ref: reveals the element (adds `in`) the first time it scrolls into view. */
const revealOnce = (el: HTMLElement | null) => {
  if (!el) return
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) { el.classList.add('in'); io.disconnect() }
  }, { threshold: 0.12 })
  io.observe(el)
}

/* ─── Aurora canvas ──────────────────────────────────────────────────────────── */
function AuroraCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const x = c.getContext('2d')!
    let t = 0, rafId = 0
    type Blob = [number, number, string, number]
    const blobs: Blob[] = [
      [0.2, 0.25, '124,156,255', 0.55], [0.8, 0.2, '180,140,255', 0.5],
      [0.6, 0.8, '255,158,196', 0.4], [0.15, 0.85, '74,222,154', 0.3],
    ]
    const resize = () => { c.width = innerWidth; c.height = innerHeight }
    resize()
    window.addEventListener('resize', resize)
    const draw = () => {
      t += 0.0035
      x.clearRect(0, 0, c.width, c.height)
      blobs.forEach(([bx, by, col, sr], i) => {
        const px = (bx + Math.sin(t * 1.3 + i * 2) * 0.14) * c.width
        const py = (by + Math.cos(t + i * 1.7) * 0.14) * c.height
        const r = Math.max(c.width, c.height) * sr
        const g = x.createRadialGradient(px, py, 0, px, py, r)
        g.addColorStop(0, `rgba(${col},.3)`)
        g.addColorStop(1, `rgba(${col},0)`)
        x.fillStyle = g; x.fillRect(0, 0, c.width, c.height)
      })
      rafId = requestAnimationFrame(draw)
    }
    draw()
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(rafId) }
  }, [])
  return <canvas ref={ref} id="aurora" />
}

/* ─── Eye-tracking mascot ────────────────────────────────────────────────────── */
const EYE_DEFS = [
  { id: 'eyeL', src: '/analysis/eye-left.png', left: '38.08%', top: '41.51%', w: '9.684%', h: '8.864%', cw: 73.6, cx: 36.8, cy: 36.3, rx: 27, ry: 24, x0: 58.6, y0: 39.5, iw: '57.1%', il: '79.6%', it: '54.4%' },
  { id: 'eyeR', src: '/analysis/eye-right.png', left: '53.55%', top: '41.76%', w: '6.711%', h: '8.669%', cw: 51, cx: 25.5, cy: 35.5, rx: 18, ry: 24, x0: 37, y0: 38, iw: '66.7%', il: '72.5%', it: '53.5%' },
]

function MascotEyes() {
  const irisRefs = useRef<Record<string, HTMLImageElement | null>>({})
  const pos = useRef<Record<string, { x: number; y: number }>>({ eyeL: { x: 0, y: 0 }, eyeR: { x: 0, y: 0 } })
  const mouse = useRef<{ x: number | null; y: number | null }>({ x: null, y: null })

  useEffect(() => {
    const onMove = (e: PointerEvent) => { mouse.current = { x: e.clientX, y: e.clientY } }
    const onLeave = () => { mouse.current = { x: null, y: null } }
    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerleave', onLeave)
    let rafId = 0
    const tick = () => {
      EYE_DEFS.forEach((d) => {
        const ir = irisRefs.current[d.id]
        if (!ir) return
        const el = ir.closest('.eye') as HTMLElement | null
        if (!el) return
        const { x: px, y: py } = mouse.current
        let tx = 0, ty = 0
        const sc = el.offsetWidth / d.cw
        if (px !== null && py !== null && sc > 0) {
          const rect = el.getBoundingClientRect()
          const dx = px - (rect.left + rect.width / 2)
          const dy = py - (rect.top + rect.height / 2)
          const dist = Math.hypot(dx, dy) || 1
          const am = Math.pow(Math.min(1, dist / 170), 0.7)
          tx = (d.cx + (dx / dist) * am * d.rx - d.x0) * sc
          ty = (d.cy + (dy / dist) * am * d.ry - d.y0) * sc
        }
        const p = pos.current[d.id]
        p.x += (tx - p.x) * 0.2
        p.y += (ty - p.y) * 0.2
        ir.style.transform = `translate(-50%,-50%) translate(${p.x.toFixed(2)}px,${p.y.toFixed(2)}px)`
      })
      rafId = requestAnimationFrame(tick)
    }
    tick()
    return () => { window.removeEventListener('pointermove', onMove); document.removeEventListener('pointerleave', onLeave); cancelAnimationFrame(rafId) }
  }, [])

  return (
    <>
      {EYE_DEFS.map((d) => (
        <div key={d.id} id={d.id} className="eye" style={{ left: d.left, top: d.top, width: d.w, height: d.h }}>
          <img className="ir" alt="" ref={(el) => { irisRefs.current[d.id] = el }} src={d.src} style={{ left: d.il, top: d.it, width: d.iw }} />
        </div>
      ))}
    </>
  )
}

/* ─── Nav items (mirrors Navigation.tsx — kept local to avoid coupling) ──────── */
const NAV = [
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  { label: 'Charts',    href: '/chart',     icon: <CandlestickChart  className="w-4 h-4" /> },
  { label: 'Analyze',   href: '/analysis',  icon: <LineChart         className="w-4 h-4" /> },
  { label: 'My Portfolio', href: '/portfolio', icon: <BarChart2      className="w-4 h-4" /> },
  { label: 'About',     href: '/about',     icon: <Info              className="w-4 h-4" /> },
]

/** Jump-bar entries. Bullish / bearish triggers render inside "Key risks", as in the design. */
interface JumpItem { slug: string; label: string; num: string }
const NESTED: SectionKind[] = ['bullish', 'bearish']

function buildJumpItems(sections: AnalysisSection[]): JumpItem[] {
  return sections.flatMap((sec, idx) => {
    const kind = sectionKind(sec.title)
    if (NESTED.includes(kind)) return []
    const num = sec.title.match(/^\s*(\d+)\./)?.[1] ?? String(idx + 1)
    const label = kind === 'other' ? sec.title.replace(/^\d+\.\s*/, '') : KIND_LABEL[kind]
    return [{ slug: kind === 'other' ? `sec-${idx}` : kind, label, num: num.padStart(2, '0') }]
  })
}

/* ─── Top navigation bar ─────────────────────────────────────────────────────── */
function ReportTopbar({ symbol, items }: { symbol?: string; items: JumpItem[] }) {
  const navigate    = useNavigate()
  const { pathname } = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [secShow, setSecShow] = useState(false)
  const [secActive, setSecActive] = useState('top')

  // Section spy + secbar visibility
  useEffect(() => {
    const ids = ['top', ...items.map((i) => i.slug)]
    const onScroll = () => {
      setSecShow(window.scrollY > window.innerHeight * 0.6)
      let cur = 'top'
      ids.forEach((id) => {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top < window.innerHeight * 0.4) cur = id
      })
      setSecActive(cur)
      const prog = document.getElementById('nxr-prog')
      if (prog) {
        const h = document.documentElement.scrollHeight
        prog.style.width = `${(window.scrollY / (h - window.innerHeight)) * 100}%`
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [items])

  // Scroll active secbar link into view
  useEffect(() => {
    const sb = document.getElementById('nxr-secbar')
    if (!sb || !secShow) return
    const active = sb.querySelector<HTMLAnchorElement>('a.on')
    if (active) sb.scrollTo({ left: active.offsetLeft - sb.clientWidth / 2 + active.offsetWidth / 2, behavior: 'smooth' })
  }, [secActive, secShow])

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <div className="topbar">
      <div className="tb">
        {/* Main nav bar */}
        <div className="nbar">
          {/* Logo */}
          <Link to="/dashboard" className="logo">
            <span className="mk">
              <svg viewBox="0 0 28 22" fill="none" stroke="url(#nxr-lg)" strokeWidth="3.2" strokeLinecap="round">
                <defs>
                  <linearGradient id="nxr-lg" x1="0" y1="0" x2="1" y2="1">
                    <stop stopColor="#7c9cff"/><stop offset="1" stopColor="#b48cff"/>
                  </linearGradient>
                </defs>
                <path d="M10 2 4 20M18 2l-6 18M26 2l-6 18"/>
              </svg>
            </span>
            NXTvue
          </Link>

          {/* Centre links */}
          <div className="links">
            {NAV.map((n) => (
              <Link key={n.href} to={n.href} className={isActive(n.href) ? 'cur' : ''}>{n.label}</Link>
            ))}
          </div>

          {/* Right actions */}
          <div className="nact">
            <NotificationBell triggerClassName="ib" />
            {symbol && (
              <a className="btn p" href="#verdict">See Verdict</a>
            )}
            <button className="btn lo" onClick={() => navigate('/login')}>Logout</button>
            <button className="ib" id="nxr-burger" aria-label="Menu" onClick={() => setMobileOpen((v) => !v)}>
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile sheet */}
        <div className={`sheet${mobileOpen ? ' open' : ''}`} onClick={() => setMobileOpen(false)}>
          {NAV.map((n) => <Link key={n.href} to={n.href}>{n.label}</Link>)}
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/login') }}>Logout</a>
        </div>

        {/* Section jump-bar */}
        {symbol && (
          <div id="nxr-secbar" className={`secbar${secShow ? ' show' : ''}`}>
            <span className="tag">{symbol} Report</span>
            <a href="#top" data-s="top" className={secActive === 'top' ? 'on' : ''}>
              <i>00</i>Overview
            </a>
            {items.map((it) => (
              <a key={it.slug} href={`#${it.slug}`} data-s={it.slug} className={secActive === it.slug ? 'on' : ''}>
                <i>{it.num}</i>{it.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Mascot chips ───────────────────────────────────────────────────────────── */
function MascotChip({ label, value, color, cls }: { label: string; value: string; color: 'good' | 'bad' | 'ink'; cls: 'a' | 'b' | 'c' }) {
  return (
    <div className={`chip ${cls}`}>
      <small>{label}</small>
      <b style={color === 'ink' ? undefined : { color: `var(--${color})` }}>{value}</b>
    </div>
  )
}

/* ─── Mascot 3D Card (with interactive 3D tilt & translation + eye tracking) ── */
function MascotCard({ name, chips }: { name: string; chips: { label: string; value: string; color: 'good' | 'bad' | 'ink' }[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tiltRef = useRef<HTMLDivElement>(null)
  const mouse = useRef<{ x: number | null; y: number | null }>({ x: null, y: null })
  const cur = useRef({ rx: 0, ry: 0, tx: 0, ty: 0 })

  useEffect(() => {
    const cont = containerRef.current
    if (!cont) return

    const onPointerMove = (e: PointerEvent) => {
      const rect = cont.getBoundingClientRect()
      // Normalized coordinates from -0.5 to +0.5 relative to the card container
      const px = (e.clientX - rect.left) / rect.width - 0.5
      const py = (e.clientY - rect.top) / rect.height - 0.5
      mouse.current = { x: px, y: py }
    }

    const onPointerLeave = () => {
      mouse.current = { x: null, y: null }
    }

    cont.addEventListener('pointermove', onPointerMove, { passive: true })
    cont.addEventListener('pointerleave', onPointerLeave)

    let rafId = 0
    const tick = () => {
      const { x: px, y: py } = mouse.current
      const targetRx = py !== null ? -py * 24 : 0
      const targetRy = px !== null ? px * 24 : 0
      const targetTx = px !== null ? px * 36 : 0
      const targetTy = py !== null ? py * 36 : 0

      const c = cur.current
      c.rx += (targetRx - c.rx) * 0.12
      c.ry += (targetRy - c.ry) * 0.12
      c.tx += (targetTx - c.tx) * 0.12
      c.ty += (targetTy - c.ty) * 0.12

      if (tiltRef.current) {
        tiltRef.current.style.transform = `perspective(900px) rotateY(${c.ry.toFixed(2)}deg) rotateX(${c.rx.toFixed(2)}deg) translate3d(${c.tx.toFixed(2)}px, ${c.ty.toFixed(2)}px, 0px)`
      }
      rafId = requestAnimationFrame(tick)
    }
    tick()

    return () => {
      cont.removeEventListener('pointermove', onPointerMove)
      cont.removeEventListener('pointerleave', onPointerLeave)
      cancelAnimationFrame(rafId)
    }
  }, [])

  return (
    <div
      className="mascot rev"
      ref={(el) => {
        containerRef.current = el
        revealOnce(el)
      }}
    >
      <div className="halo" />
      <div className="frame" id="tilt" ref={tiltRef}>
        <div className="pic">
          <img src="/analysis/mascot.jpg" alt={`${name} mascot illustration`} />
          <MascotEyes />
        </div>
        {chips[0] && <MascotChip cls="a" label={chips[0].label} value={chips[0].value} color={chips[0].color} />}
        {chips[1] && <MascotChip cls="b" label={chips[1].label} value={chips[1].value} color={chips[1].color} />}
        {chips[2] && <MascotChip cls="c" label={chips[2].label} value={chips[2].value} color={chips[2].color} />}
      </div>
    </div>
  )
}

/* ─── Main Page ──────────────────────────────────────────────────────────────── */
export function AnalysisPage() {
  const { ticker: tickerParam } = useParams<{ ticker?: string }>()
  const [searchParams, setSearchParams] = useSearchParams()

  const rawTicker     = (searchParams.get('ticker') || tickerParam || 'VRT').trim()
  const currentTicker = (rawTicker.includes(':') ? rawTicker.split(':')[0] : rawTicker).toUpperCase()
  const currentMarket = (searchParams.get('market') || (rawTicker.includes(':') ? rawTicker.split(':')[1] : 'india')).toLowerCase()
  const shouldGenerateOnLoad = searchParams.get('generate') === 'true'

  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    localStorage.getItem('nxtvue_analysis_theme') === 'light' ? 'light' : 'dark',
  )
  const isLight = theme === 'light'
  const toggleTheme = () => {
    const next = isLight ? 'dark' : 'light'
    setTheme(next)
    localStorage.setItem('nxtvue_analysis_theme', next)
  }

  const [report, setReport]       = useState<DynamicReport | null>(null)
  const [loading, setLoading]     = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const { status, message, progress, error: sseError, run: runGenerator, reset: resetGenerator } = useAnalysis()

  const [isChatOpen, setIsChatOpen]     = useState(false)
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([])
  const [chatInput, setChatInput]       = useState('')
  const [isTyping, setIsTyping]         = useState(false)
  const chatScrollRef = useRef<HTMLDivElement>(null)

  const isGenerating = status === 'fetching' || status === 'analyzing'

  // ── Load / generate ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (shouldGenerateOnLoad) { setLoading(false); runGenerator(currentTicker, currentMarket, 2027); return }
      setLoading(true); setFetchError(null)
      try {
        const res = await fetch(`/api/v1/analysis/${encodeURIComponent(currentTicker)}`)
        if (cancelled) return
        if (res.ok) {
          const data: DynamicReport = await res.json()
          setReport(data); setLoading(false)
          setChatMessages([{ role: 'model', text: `Hello. I'm A.R.I.A. I've analysed the 2027 institutional report for ${data.name} (${data.symbol}). How can I help?` }])
        } else if (res.status === 404) {
          setReport(null); setLoading(false)
        } else {
          const err = await res.json().catch(() => ({}))
          setFetchError(err.detail || `Failed to retrieve report for ${currentTicker}`); setLoading(false)
        }
      } catch (err: unknown) {
        if (!cancelled) { setFetchError(err instanceof Error ? err.message : 'Network error'); setLoading(false) }
      }
    }
    load()
    return () => { cancelled = true }
  }, [currentTicker, currentMarket, shouldGenerateOnLoad, runGenerator])

  // ── SSE complete ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'complete') return
    const p = new URLSearchParams(searchParams); p.delete('generate')
    setSearchParams(p, { replace: true })
    fetch(`/api/v1/analysis/${encodeURIComponent(currentTicker)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: DynamicReport | null) => {
        if (data) {
          setReport(data)
          setChatMessages([{ role: 'model', text: `Analysis for ${data.name} (${data.symbol}) is ready. How can I help?` }])
        }
      }).catch(console.error)
  }, [status, currentTicker, searchParams, setSearchParams])

  const handleStartGeneration = useCallback(() => {
    setFetchError(null); resetGenerator(); runGenerator(currentTicker, currentMarket, 2027)
  }, [currentTicker, currentMarket, resetGenerator, runGenerator])

  // ── Chat ──────────────────────────────────────────────────────────────────────
  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!chatInput.trim() || isTyping) return
    const userMsg = chatInput.trim(); setChatInput('')
    const hist = [...chatMessages, { role: 'user' as const, text: userMsg }]
    setChatMessages(hist); setIsTyping(true)
    try {
      const res = await fetch('/api/v1/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: hist.map((m) => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text })),
          context: { symbol: report?.symbol || currentTicker, name: report?.name || currentTicker, judgement: report?.judgementTag, judgement_text: report?.judgementText, summary: report?.summaryNote },
        }),
      })
      if (res.ok) { const d = await res.json(); if (d.reply) { setChatMessages((p) => [...p, { role: 'model', text: d.reply }]); setIsTyping(false); return } }
    } catch (err) { console.warn('chat error', err) }
    await new Promise((r) => setTimeout(r, 500))
    setChatMessages((p) => [...p, { role: 'model', text: report ? `${report.name} (${report.symbol}): "${report.judgementTag}". ${report.judgementText}` : `Analysing ${currentTicker}…` }])
    setIsTyping(false)
  }
  useEffect(() => { if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight }, [chatMessages, isTyping])

  // ── Derived view data (all read from the report text) ───────────────────────
  const heroKpis = report ? deriveHeroKpis(report.sections, `${report.judgementText} ${report.executiveSummary.map((e) => e.text).join(' ')}`) : []
  const chips = report ? deriveChips(report.sections) : []
  const jumpItems = report ? buildJumpItems(report.sections) : []
  const currentPrice = (() => {
    const val = report?.sections.find((x) => sectionKind(x.title) === 'valuation')
    return val ? parseValuation(val.content).price : undefined
  })()
  const targetZone = (() => {
    const v = report?.sections.find((x) => sectionKind(x.title) === 'verdict')
    return v ? parseVerdict(v.content).targetZone : undefined
  })()

  /* ── Render ──────────────────────────────────────────────────────────────── */
  return (
    <div className="nxr" id="nxr-root" data-theme={theme}>
      <AuroraCanvas />
      <div className="grain" />
      <div className="prog" id="nxr-prog" />

      {/* ── Topbar ─────────────────────────────────────────────────── */}
      <ReportTopbar symbol={report?.symbol} items={jumpItems} />

      {/* ── Main ───────────────────────────────────────────────────── */}
      <main className="mainw" id="top">
        {/* ── Hero ───────────────────────────────────────────────── */}
        <header className="hero">
          {/* Breadcrumb */}
          <div className="crumb">
            <Link to="/portfolio?tab=watchlist" className="pill">← Back to watchlist</Link>
            {report && (
              <>
                <span className="pill"><i />{report.analysisDoc}</span>
                <a className="pill" href={report.pdfUrl || `/api/v1/reports/${report.symbol}.pdf`} target="_blank" rel="noreferrer">View official PDF</a>
                <button className="pill btnlike" disabled={isGenerating} onClick={handleStartGeneration}>Regenerate</button>
              </>
            )}
            <button
              className="tbtn"
              onClick={toggleTheme}
              title={`Switch to ${isLight ? 'Dark' : 'Light'} mode`}
              aria-label="Toggle Theme"
            >
              {isLight ? <Moon width={16} height={16} /> : <Sun width={16} height={16} />}
              <span>{isLight ? 'Dark' : 'Light'}</span>
            </button>
          </div>

          {/* Title */}
          <h1>
            {report ? `${report.name} (${report.symbol})` : currentTicker}
            {report && <em>{report.subtitle}</em>}
          </h1>

          {/* Mascot */}
          {report && (
            <MascotCard name={report.name} chips={chips} />
          )}

          {/* Judgement */}
          {report && (
            <GlassCard reveal className="judge">
              <span className="lab">◆ My judgement</span>
              <p>{report.judgementText}</p>
            </GlassCard>
          )}

          {/* Hero KPIs */}
          {heroKpis.length > 0 && (
            <div className="kpis">
              {heroKpis.map((kpi) => (
                <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} cls={kpi.cls} />
              ))}
            </div>
          )}

          {/* Executive summary */}
          {report && report.executiveSummary.length > 0 && (
            <div className="grid3 rev" style={{ marginTop: 34 }} ref={revealOnce}>
              {report.executiveSummary.map((item, i) => (
                <GlassCard key={i} className="card">
                  <h3>{item.label}</h3>
                  <p>{item.text}</p>
                </GlassCard>
              ))}
            </div>
          )}

          {report?.summaryNote && <Note>{report.summaryNote}</Note>}

          <div className="scroll">SCROLL ↓</div>
        </header>

        {/* ── Generation banner ──────────────────────────────────── */}
        {isGenerating && (
          <Rev>
            <GlassCard className="state">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                <div className="kpi" style={{ width: 48, height: 48, padding: 0, display: 'grid', placeItems: 'center', borderRadius: 14, flexShrink: 0 }}>
                  <RefreshCw className="w-5 h-5 spin" style={{ color: 'var(--acc)' }} />
                </div>
                <div>
                  <h3 style={{ marginBottom: 4 }}>Generating AI Institutional Report</h3>
                  <span className="lab">{currentTicker} · {currentMarket.toUpperCase()}</span>
                </div>
              </div>
              <div className="gen-row">
                <span>{message || 'Processing financial metrics…'}</span>
                <b>{progress}%</b>
              </div>
              <div className="gen-bar">
                <i style={{ width: `${Math.max(progress, 8)}%` }} />
              </div>
            </GlassCard>
          </Rev>
        )}

        {/* ── Error ──────────────────────────────────────────────── */}
        {!isGenerating && (fetchError || sseError) && (
          <Rev>
            <GlassCard className="state err">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <AlertCircle className="w-5 h-5" style={{ color: 'var(--bad)', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <h3>Analysis request encountered an issue</h3>
                  <p>{fetchError || sseError?.userMessage}</p>
                  <button className="btn" style={{ marginTop: 14 }} onClick={handleStartGeneration}>Try Again</button>
                </div>
              </div>
            </GlassCard>
          </Rev>
        )}

        {/* ── Not found ──────────────────────────────────────────── */}
        {!loading && !report && !isGenerating && (
          <Rev>
            <GlassCard className="state" style={{ textAlign: 'center' }}>
              <h3>No report found for {currentTicker}</h3>
              <p>The institutional deep-dive for {currentTicker} hasn't been generated yet. Click below to generate the full 13-section analysis.</p>
              <button className="btn p" style={{ marginTop: 20 }} onClick={handleStartGeneration}>
                Generate AI Report for {currentTicker}
              </button>
            </GlassCard>
          </Rev>
        )}

        {/* ── Skeleton ───────────────────────────────────────────── */}
        {loading && !report && (
          <div className="skel">
            <i style={{ height: 48, width: 180 }} />
            <i style={{ height: 100 }} />
            <i style={{ height: 180 }} />
          </div>
        )}

        {/* ── Report sections ────────────────────────────────────── */}
        {report && (() => {
          const secs = report.sections.map((sec, idx) => ({ sec, idx, kind: sectionKind(sec.title) }))
          const bullish = secs.find((x) => x.kind === 'bullish')
          const bearish = secs.find((x) => x.kind === 'bearish')
          const header = (num: string, title: string) => (
            <Rev><div className="sh"><small>{num}</small><h2>{title}</h2></div></Rev>
          )
          const numOf = (sec: AnalysisSection, idx: number) => (sec.title.match(/^\s*(\d+)\./)?.[1] ?? String(idx + 1)).padStart(2, '0')
          const titleOf = (sec: AnalysisSection) => sec.title.replace(/^\d+\.\s*/, '')
          const jump = (kind: SectionKind, idx: number) => (kind === 'other' ? `sec-${idx}` : kind)

          return secs.map(({ sec, idx, kind }) => {
            if (kind === 'bullish' || kind === 'bearish') return null
            return (
              <section key={idx} id={jump(kind, idx)}>
                {header(numOf(sec, idx), titleOf(sec))}
                <SectionBody kind={kind} content={sec.content} price={currentPrice} targetZone={targetZone} />
                {kind === 'risks' && (bullish || bearish) && (
                  <div className="two" style={{ marginTop: 14 }}>
                    {bullish && (
                      <GlassCard reveal className="card">
                        <div className="sh" style={{ margin: '0 0 14px' }}><small>{numOf(bullish.sec, bullish.idx)}</small><h3 style={{ margin: 0 }}>{titleOf(bullish.sec)}</h3></div>
                        <Bullets content={bullish.sec.content} bad={false} bare />
                      </GlassCard>
                    )}
                    {bearish && (
                      <GlassCard reveal className="card">
                        <div className="sh" style={{ margin: '0 0 14px' }}><small>{numOf(bearish.sec, bearish.idx)}</small><h3 style={{ margin: 0 }}>{titleOf(bearish.sec)}</h3></div>
                        <Bullets content={bearish.sec.content} bad bare />
                      </GlassCard>
                    )}
                  </div>
                )}
              </section>
            )
          })
        })()}

        {/* ── Disclaimer ─────────────────────────────────────────── */}
        {report && (
          <Rev>
            <p className="disc" id="disc">
              <strong>Disclaimer:</strong> This analysis is for educational and institutional research purposes based on
              historical and market data. It does not constitute investment advice. Investors must conduct their own
              independent due diligence. Generated dynamically by NXTvue Institutional Engine for {report.symbol}.
            </p>
          </Rev>
        )}
      </main>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      {report && (
        <footer className="foot">
          <div className="w">
            {/* CTA banner */}
            <Rev>
              <div className="glass fcta">
                <h3>Turn the dislocation into a plan.</h3>
                <div>
                  <Link to="/analysis/history" className="btn p">All Reports</Link>
                  <a className="btn" href={report.pdfUrl || `/api/v1/reports/${report.symbol}.pdf`} target="_blank" rel="noreferrer">View Official PDF</a>
                </div>
              </div>
            </Rev>

            {/* Footer grid */}
            <div className="fgrid">
              <div>
                <Link to="/dashboard" className="logo" style={{ marginBottom: 14 }}>
                  <svg viewBox="0 0 28 22" fill="none" stroke="url(#nxr-lg2)" strokeWidth="3" strokeLinecap="round" width="26" height="22">
                    <defs><linearGradient id="nxr-lg2" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#7c9cff"/><stop offset="1" stopColor="#b48cff"/></linearGradient></defs>
                    <path d="M10 2 4 20M18 2l-6 18M26 2l-6 18"/>
                  </svg>
                  NXTvue
                </Link>
                <p>Institutional-grade equity research, generated from historical and market data and built for patient capital.</p>
              </div>
              <div>
                <h5>Product</h5>
                {[['Dashboard','/dashboard'],['Charts','/chart'],['Analyze','/analysis'],['My Portfolio','/portfolio']].map(([l,h])=>(
                  <Link key={l} to={h}>{l}</Link>
                ))}
              </div>
              <div>
                <h5>Company</h5>
                {[['About','/about'],['See Plans','/pricing'],['Contact','#']].map(([l,h])=>(
                  <Link key={l} to={h}>{l}</Link>
                ))}
              </div>
              <div>
                <h5>Legal</h5>
                {[['Privacy','#'],['Terms','#'],['Disclaimer','#disc']].map(([l,h])=>(
                  <a key={l} href={h}>{l}</a>
                ))}
              </div>
            </div>

            {/* Footer bottom */}
            <div className="fbot">
              <span>© 2026 NXTvue. All rights reserved.</span>
              <span className="st"><i/>Engine online</span>
              <a href="#top" className="btn">Back to top ↑</a>
            </div>

            {/* Watermark */}
            <div className="wm" aria-hidden="true">NXTvue</div>
          </div>
        </footer>
      )}

      {/* ── A.R.I.A Chat ─────────────────────────────────────────────── */}
      {/* FAB */}
      <button className={`chatfab${isChatOpen ? ' hide' : ''}`} onClick={() => setIsChatOpen(true)} aria-label="Open A.R.I.A chat">
        ✳︎
      </button>

      {/* Chat window */}
      <div className={`chatwin${isChatOpen ? '' : ' closed'}`} role="dialog" aria-label="A.R.I.A Financial Analyst">
        <div className="chathd">
          <div className="who">
            <div className="av">
              <span>✳︎</span>
              {isTyping && <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1px solid var(--acc)', animation: 'nxr-pulse 1.5s infinite', opacity: .4 }} />}
            </div>
            <div>
              <h4>A.R.I.A</h4>
              <small>{report ? `${report.symbol} Analyst` : 'Financial Analyst'}</small>
            </div>
          </div>
          <button onClick={() => setIsChatOpen(false)} aria-label="Close">✕</button>
        </div>

        <div className="chatmsgs" ref={chatScrollRef}>
          {chatMessages.map((msg, idx) => (
            <div key={idx} className={`msg${msg.role === 'user' ? ' user' : ''}`}>{msg.text}</div>
          ))}
          {isTyping && (
            <div className="typing">
              <i/><i/><i/>
            </div>
          )}
        </div>

        <form className="chatform" onSubmit={handleSend}>
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder={`Ask A.R.I.A about ${report?.symbol || currentTicker}…`}
            disabled={isTyping}
          />
          <button type="submit" disabled={!chatInput.trim() || isTyping} aria-label="Send">
            <ChevronRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  )
}
