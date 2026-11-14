import { useEffect, useRef } from 'react'

/**
 * Moves an element a fraction of the page scroll, for a subtle depth effect.
 * The transform is written straight to the element (no React state), one frame at a time.
 * `max` stops the drift once the element is far off screen. Does nothing when the user prefers reduced motion.
 */
export function useParallax<T extends HTMLElement>(factor: number, { scale = 1, max = 1200 }: { scale?: number; max?: number } = {}) {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let raf = 0
    const apply = () => {
      raf = 0
      const y = Math.min(window.scrollY, max) * factor
      el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)${scale !== 1 ? ` scale(${scale})` : ''}`
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply)
    }

    apply()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [factor, scale, max])

  return ref
}
