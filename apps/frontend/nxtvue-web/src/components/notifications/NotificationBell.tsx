// ─── Notification Bell & Popover Component ────────────────────────────────────

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell } from 'lucide-react'
import { useNotifications } from '@/context/NotificationContext'
import { TvWidget } from '@/components/charts/TvWidget'
import { cn } from '@/utils/cn'

interface NotificationBellProps {
  className?: string
}

export function NotificationBell({ className }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { unreadCount } = useNotifications()
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape
  useEffect(() => {
    if (!isOpen) return
    const onMouseDown = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [isOpen])

  // Intercept link clicks inside the TradingView iframe so stories open
  // inside our app rather than navigating away.
  // We use a transparent overlay over the iframe to capture pointer events
  // and block external navigation while still allowing TradingView to render.
  const handleWidgetContainerClick = (e: React.MouseEvent) => {
    // Let the widget itself render; we just prevent any <a> navigation
    const target = e.target as HTMLElement
    const anchor = target.closest('a')
    if (anchor && anchor.href && !anchor.href.startsWith(window.location.origin)) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'relative p-2 rounded-xl transition-all duration-200',
          isOpen ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
        )}
        aria-label="Top market stories"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        title="Top market stories"
      >
        <Bell className="w-4 h-4" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white" aria-hidden="true" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="dialog"
            aria-label="Top market stories"
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 mt-2 w-[min(24rem,calc(100vw-1.5rem))] rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden z-[500]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-900 tracking-wide uppercase">Top Stories</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors text-[11px]"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* TradingView top-stories widget — links intercepted via pointer-events */}
            <div
              className="h-[440px] relative"
              onClick={handleWidgetContainerClick}
            >
              <TvWidget
                widget="news-feed"
                theme="light"
                height={440}
                options={{
                  'layout-mode': 'flow',
                  'item-size': 'normal',
                  'assets-type': 'all',
                  'news-type': 'top-stories',
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
