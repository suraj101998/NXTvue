const GREEN = '#10b981'
const RED = '#ef4444'

/** Two candles, one up and one down. */
export function CandleIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" strokeLinecap="round" aria-hidden="true">
      <path d="M7 4v16" stroke={GREEN} strokeWidth="1.6" />
      <rect x="5" y="8" width="4" height="8" rx="1" fill={GREEN} />
      <path d="M17 3v18" stroke={RED} strokeWidth="1.6" />
      <rect x="15" y="6" width="4" height="10" rx="1" fill={RED} />
    </svg>
  )
}

/** A rising zig-zag line. */
export function LineIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2.5 15.5 7 10l4 4.5 4.5-7L21.5 13" stroke={GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
