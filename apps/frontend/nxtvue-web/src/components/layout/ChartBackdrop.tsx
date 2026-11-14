import { useEffect } from 'react'
import { useParallax } from '@/hooks/useParallax'
import './chartFx.css'

// A hand-placed price line for the backdrop: one long trend with pullbacks, drawn once, never animated.
const LINE = '0,430 60,418 120,436 190,396 250,410 320,360 380,378 450,330 520,352 590,300 650,322 720,268 790,296 860,240 930,262 1000,214 1070,244 1140,196 1210,222 1280,170 1350,198 1420,150 1500,176 1600,118'

/**
 * The chart page's atmosphere: "Lavender & Cream" (a warm plum-charcoal dark mode, a cream light mode).
 * Lavender, peach, rose and orange light pools drift slowly behind a faint chart grid and a ghosted price line,
 * under a plum vignette and fine grain. It also feeds the pointer position to every panel,
 * so a panel's spotlight follows the cursor.
 */
export function ChartBackdrop() {
  const a = useParallax<HTMLDivElement>(-0.05)
  const b = useParallax<HTMLDivElement>(-0.09)
  const c = useParallax<HTMLDivElement>(-0.03)
  const d = useParallax<HTMLDivElement>(-0.07)
  const e = useParallax<HTMLDivElement>(-0.02)
  const line = useParallax<HTMLDivElement>(-0.04)

  useEffect(() => {
    let raf = 0
    const onMove = (e: PointerEvent) => {
      const card = (e.target as Element | null)?.closest<HTMLElement>('.nxc .pn')
      if (!card) return
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const r = card.getBoundingClientRect()
        card.style.setProperty('--mx', `${e.clientX - r.left}px`)
        card.style.setProperty('--my', `${e.clientY - r.top}px`)
      })
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div className="cxb" aria-hidden="true">
      <div ref={a} className="cxb-l cxb-a"><i /></div>
      <div ref={b} className="cxb-l cxb-b"><i /></div>
      <div ref={c} className="cxb-l cxb-c"><i /></div>
      <div ref={d} className="cxb-l cxb-d"><i /></div>
      <div ref={e} className="cxb-l cxb-e"><i /></div>
      <div className="cxb-grid" />
      <div ref={line} className="cxb-line">
        <svg viewBox="0 0 1600 560" preserveAspectRatio="none">
          <defs>
            <linearGradient id="cxb-s" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#a78bfa" stopOpacity="0" />
              <stop offset=".35" stopColor="#c4a6ff" stopOpacity=".6" />
              <stop offset=".8" stopColor="#ff9a52" stopOpacity=".55" />
              <stop offset="1" stopColor="#fff0d6" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="cxb-f" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#b08cff" stopOpacity=".18" />
              <stop offset="1" stopColor="#b08cff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={`${LINE} 1600,560 0,560`} fill="url(#cxb-f)" />
          <polyline points={LINE} fill="none" stroke="url(#cxb-s)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="cxb-vig" />
      <div className="cxb-grain" />
    </div>
  )
}
