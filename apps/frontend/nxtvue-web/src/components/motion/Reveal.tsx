import { useEffect, useRef, useState, type CSSProperties, type ElementType, type HTMLAttributes } from 'react'
import { cn } from '@/utils/cn'
import '@/components/layout/dashboardFx.css'

// One observer for every Reveal on the page.
const callbacks = new WeakMap<Element, () => void>()
let observer: IntersectionObserver | null = null

function getObserver() {
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          callbacks.get(e.target)?.()
          observer?.unobserve(e.target)
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.08 },
    )
  }
  return observer
}

interface RevealProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType
  /** Milliseconds to wait before the reveal starts, to stagger siblings. */
  delay?: number
}

/** Fades and lifts its content in the first time it scrolls into view. */
export function Reveal({ as: Component = 'div', delay, className, style, children, ...rest }: RevealProps) {
  const ref = useRef<HTMLElement>(null)
  // Without IntersectionObserver (very old browsers) everything is simply shown.
  const [shown, setShown] = useState(() => typeof IntersectionObserver === 'undefined')

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const obs = getObserver()
    callbacks.set(el, () => setShown(true))
    obs.observe(el)
    return () => {
      obs.unobserve(el)
      callbacks.delete(el)
    }
  }, [])

  const css = delay === undefined ? style : ({ ...style, '--d': `${delay}ms` } as CSSProperties)
  return (
    <Component {...rest} ref={ref} className={cn('rv', shown && 'in', className)} style={css}>
      {children}
    </Component>
  )
}
