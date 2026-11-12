import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { ChartData, ParsedTable } from './reportParser'
import { fmtCell } from './reportParser'

/** Adds the `in` class (scroll-reveal) once the element is on screen. */
function useReveal(ref: React.RefObject<HTMLElement | null>, enabled = true) {
  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.classList.add('in'); io.disconnect() }
    }, { threshold: 0.12 })
    io.observe(el)
    return () => io.disconnect()
  }, [ref, enabled])
}


/* ─── Glass card with pointer spotlight (+ optional reveal) ─────────────────── */
export const GlassCard = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { reveal?: boolean }>(
  function GlassCard({ className = '', reveal = false, children, ...rest }, fwd) {
    const ref = useRef<HTMLDivElement>(null)
    useReveal(ref, reveal)
    const onMove = useCallback((e: React.PointerEvent) => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      el.style.setProperty('--mx', `${e.clientX - r.left}px`)
      el.style.setProperty('--my', `${e.clientY - r.top}px`)
    }, [])
    return (
      <div
        ref={(el) => {
          ref.current = el
          if (typeof fwd === 'function') fwd(el)
          else if (fwd) fwd.current = el
        }}
        onPointerMove={onMove}
        className={`glass ${reveal ? 'rev ' : ''}${className}`}
        {...rest}
      >
        {children}
      </div>
    )
  },
)

/* ─── Scroll-reveal wrapper for non-glass blocks ────────────────────────────── */
export function Rev({ className = '', children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useReveal(ref)
  return <div ref={ref} className={`rev ${className}`}>{children}</div>
}

/* ─── KPI card with count-up on reveal ──────────────────────────────────────── */
const NUM = /^([+\-−$]*)(\d[\d,]*(?:\.\d+)?)(.*)$/

export function KpiCard({ label, value, cls }: { label: string; value: string; cls?: 'g' | 'r' | 'w' }) {
  const numRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = numRef.current
    const m = value.match(NUM)
    if (!el || !m) return
    const [, prefix, digits, suffix] = m
    const target = parseFloat(digits.replace(/,/g, ''))
    const dec = digits.split('.')[1]?.length ?? 0
    const group = digits.includes(',')
    const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: group })
    let raf = 0
    el.textContent = `${prefix}${fmt(0)}${suffix}`
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      const st = performance.now()
      const step = (now: number) => {
        const p = Math.min((now - st) / 1400, 1)
        el.textContent = `${prefix}${fmt(target * (1 - Math.pow(1 - p, 3)))}${suffix}`
        if (p < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }, { threshold: 0.3 })
    io.observe(el)
    return () => { io.disconnect(); cancelAnimationFrame(raf) }
  }, [value])

  return (
    <GlassCard reveal className={`kpi${cls ? ` ${cls}` : ''}`}>
      <b ref={numRef}>{value}</b>
      <span>{label}</span>
    </GlassCard>
  )
}

/* ─── Bar chart (grows when it scrolls into view) ───────────────────────────── */
export function BarChart({ chart, small = false }: { chart: ChartData; small?: boolean }) {
  const host = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = host.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect() } }, { threshold: 0.15 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const max = Math.max(...chart.bars.map((b) => Math.abs(b.value))) || 1
  return (
    <GlassCard reveal className="chartwrap">
      <span className="lab">{chart.title}</span>
      <div ref={host} className={`bars${small ? ' sm' : ''}`}>
        {chart.bars.map((b) => {
          const neg = b.value < 0
          return (
            <div className="bar" key={b.label}>
              <em className={neg ? 'neg' : undefined}>{b.display}</em>
              <div className={`fill${neg ? ' ng' : ''}`} style={{ height: shown ? `${(Math.abs(b.value) / max) * 125}px` : 0 }} />
              <span>{b.label}</span>
            </div>
          )
        })}
      </div>
    </GlassCard>
  )
}

/* ─── Data table ────────────────────────────────────────────────────────────── */
export function DataTable({ table, head = 'Metric' }: { table: ParsedTable; head?: string }) {
  return (
    <GlassCard reveal className="tbl" style={{ marginTop: 14 }}>
      <table>
        <thead>
          <tr><th>{head}</th>{table.cols.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {table.rows.map((r) => (
            <tr key={r.label}>
              <td>{r.label}</td>
              {r.cells.map((c, i) => {
                const f = fmtCell(c)
                const cls = [i === r.cells.length - 1 ? 'hl' : '', f.startsWith('−') ? 'neg' : f.startsWith('+') ? 'pos' : ''].filter(Boolean).join(' ')
                return <td key={i} className={cls || undefined}>{f}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </GlassCard>
  )
}

/* ─── Italic accent note ────────────────────────────────────────────────────── */
export function Note({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const ref = useRef<HTMLParagraphElement>(null)
  useReveal(ref)
  return <p ref={ref} className="note rev" style={style}>{children}</p>
}
