// ─── Notification Bell & Popover Component ────────────────────────────────────

import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, CheckCheck, Trash2, ArrowUpRight, CheckCircle2, AlertTriangle, Info, AlertCircle } from 'lucide-react'
import { useNotifications, NotificationItem } from '@/context/NotificationContext'
import { cn } from '@/utils/cn'

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all')
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAllNotifications } = useNotifications()
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const filteredNotifications = activeTab === 'unread'
    ? notifications.filter((n) => !n.read)
    : notifications

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />
      case 'alert':
        return <AlertCircle className="w-4 h-4 text-red-400" />
      default:
        return <Info className="w-4 h-4 text-blue-400" />
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'relative p-2 rounded-xl transition-all duration-200',
          isOpen
            ? 'bg-white/[0.08] text-text-primary'
            : 'text-text-muted hover:text-text-primary hover:bg-white/[0.05]'
        )}
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-[rgba(6,10,24,0.96)] backdrop-blur-3xl border border-white/[0.12] shadow-2xl overflow-hidden z-[500]"
          >
            {/* Header */}
            <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-semibold text-text-primary text-sm">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    {unreadCount} new
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-colors text-xs flex items-center gap-1"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-[11px]">Mark read</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={clearAllNotifications}
                  className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-white/[0.06] transition-colors"
                  title="Clear all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex border-b border-white/[0.06] px-3 pt-2 gap-2 bg-white/[0.02]">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                  activeTab === 'all'
                    ? 'bg-white/[0.08] text-text-primary'
                    : 'text-text-muted hover:text-text-secondary'
                )}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('unread')}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                  activeTab === 'unread'
                    ? 'bg-white/[0.08] text-text-primary'
                    : 'text-text-muted hover:text-text-secondary'
                )}
              >
                Unread ({unreadCount})
              </button>
            </div>

            {/* Notification List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-white/[0.04]">
              {filteredNotifications.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <Bell className="w-8 h-8 text-text-muted/40 mx-auto mb-2" />
                  <p className="text-xs text-text-secondary">No notifications to display</p>
                </div>
              ) : (
                filteredNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => markAsRead(notif.id)}
                    className={cn(
                      'p-3.5 transition-colors flex items-start gap-3 cursor-pointer group',
                      !notif.read ? 'bg-blue-500/[0.04] hover:bg-blue-500/[0.08]' : 'hover:bg-white/[0.04]'
                    )}
                  >
                    <div className="mt-0.5 shrink-0 p-1.5 rounded-lg bg-white/[0.04]">
                      {getIcon(notif.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p className={cn('text-xs font-semibold truncate', !notif.read ? 'text-text-primary' : 'text-text-secondary')}>
                          {notif.title}
                        </p>
                        {!notif.read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-text-muted leading-relaxed line-clamp-2 mb-1.5">
                        {notif.message}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-text-muted">
                        <span>{new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {notif.link && (
                          <Link
                            to={notif.link}
                            onClick={() => setIsOpen(false)}
                            className="text-blue-400 hover:underline flex items-center gap-0.5"
                          >
                            <span>View details</span>
                            <ArrowUpRight className="w-2.5 h-2.5" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
