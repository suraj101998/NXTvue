import { useId } from 'react'

/** The NXTvue mark: three slanted strokes in the brand gradient. */
export function LogoMark({ className, strokeWidth = 3.2 }: { className?: string; strokeWidth?: number }) {
  const id = useId()
  return (
    <svg className={className} viewBox="0 0 28 22" fill="none" stroke={`url(#${id})`} strokeWidth={strokeWidth} strokeLinecap="round" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop style={{ stopColor: 'var(--logo-a)' }} />
          <stop offset="1" style={{ stopColor: 'var(--logo-b)' }} />
        </linearGradient>
      </defs>
      <path d="M10 2 4 20M18 2l-6 18M26 2l-6 18" />
    </svg>
  )
}

interface LogoProps {
  /** Hides the NXTvue wordmark, leaving only the mark. */
  markOnly?: boolean
  className?: string
}

/** The NXTvue logo: the mark on a rounded tile, then the wordmark. The one logo used on every page. */
export function Logo({ markOnly = false, className = '' }: LogoProps) {
  return (
    <span className={`nx-logo ${className}`}>
      <span className="nx-logo-mk">
        <LogoMark />
      </span>
      {!markOnly && <span className="nx-logo-wm">NXTvue</span>}
    </span>
  )
}
