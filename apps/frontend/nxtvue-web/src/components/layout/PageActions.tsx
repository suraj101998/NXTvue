import { Moon, Sun } from 'lucide-react'
import { useTheme, type Theme } from '@/hooks/useTheme'
import './siteChrome.css'

/** Switches the whole app between light and dark. */
export function ThemeButton({ compact = false }: { compact?: boolean }) {
  const { theme, toggle } = useTheme()
  const isLight = theme === 'light'
  return (
    <button type="button" onClick={toggle} className={compact ? 'pg-btn compact' : 'pg-btn'} data-theme={theme} title={`Switch to ${isLight ? 'Dark' : 'Light'} mode`} aria-label="Toggle Theme">
      {isLight ? <Moon width={16} height={16} /> : <Sun width={16} height={16} />}
      {!compact && <span>{isLight ? 'Dark' : 'Light'}</span>}
    </button>
  )
}

interface RefreshButtonProps {
  onClick: () => void
  /** Spins the icon and disables the button while data is loading. */
  loading?: boolean
  /** Overrides the app theme for this button. */
  theme?: Theme
  title?: string
}

export function RefreshButton({ onClick, loading = false, theme, title }: RefreshButtonProps) {
  const app = useTheme().theme
  return (
    <button type="button" onClick={onClick} disabled={loading} className="pg-btn" data-theme={theme ?? app} title={title} aria-label="Refresh Data">
      <svg
        width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true"
        style={{ animation: loading ? 'pg-spin 1s linear infinite' : undefined }}
      >
        <path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" />
      </svg>
      <span>Refresh</span>
    </button>
  )
}
