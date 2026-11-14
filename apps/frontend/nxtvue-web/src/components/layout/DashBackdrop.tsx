import { useEffect } from 'react'
import { useParallax } from '@/hooks/useParallax'
import './dashboardFx.css'

/**
 * The dashboard's atmosphere, fixed behind everything (navbar, page and footer).
 * Four soft light pools drift slowly and move at different speeds as you scroll, under a vignette and fine grain.
 * It also feeds the pointer position to every glass card, so the card's spotlight follows the cursor.
 * Only visible in dark mode (see dashboardFx.css).
 */
export function DashBackdrop() {
  const a = useParallax<HTMLDivElement>(-0.05)
  const b = useParallax<HTMLDivElement>(-0.09)
  const c = useParallax<HTMLDivElement>(-0.03)
  const d = useParallax<HTMLDivElement>(-0.07)

  useEffect(() => {
    let raf = 0
    const onMove = (e: PointerEvent) => {
      const card = (e.target as Element | null)?.closest<HTMLElement>('.dx-card, .dx-glass')
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
    <div className="dxb" aria-hidden="true">
      <div ref={a} className="dxb-l dxb-a"><i /></div>
      <div ref={b} className="dxb-l dxb-b"><i /></div>
      <div ref={c} className="dxb-l dxb-c"><i /></div>
      <div ref={d} className="dxb-l dxb-d"><i /></div>
      <div className="dxb-vig" />
      <div className="dxb-grain" />
    </div>
  )
}
