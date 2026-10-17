// ─── Notification & Toast Context ─────────────────────────────────────────────

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

export interface NotificationItem {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'alert'
  category: 'market' | 'portfolio' | 'report' | 'system'
  timestamp: number
  read: boolean
  link?: string
}

export interface ToastItem {
  id: string
  title?: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  duration?: number
}

interface ToastMethods {
  success: (message: string, title?: string) => void
  error: (message: string, title?: string) => void
  info: (message: string, title?: string) => void
  warning: (message: string, title?: string) => void
}

interface NotificationContextType {
  notifications: NotificationItem[]
  unreadCount: number
  addNotification: (item: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  removeNotification: (id: string) => void
  clearAllNotifications: () => void
  toasts: ToastItem[]
  dismissToast: (id: string) => void
  toast: ToastMethods
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

const STORAGE_KEY = 'nxtvue_notifications'

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif_1',
    title: 'Market Regime Update',
    message: 'NIFTY 50 crossed above 200-day EMA with expanding institutional volume.',
    type: 'success',
    category: 'market',
    timestamp: Date.now() - 1000 * 60 * 30, // 30m ago
    read: false,
    link: '/dashboard',
  },
  {
    id: 'notif_2',
    title: 'Technology Concentration Alert',
    message: 'Your tech sector allocation is at 42%. Review rebalancing opportunities.',
    type: 'warning',
    category: 'portfolio',
    timestamp: Date.now() - 1000 * 60 * 120, // 2h ago
    read: false,
    link: '/portfolio/intelligence',
  },
  {
    id: 'notif_3',
    title: 'AI Analysis Complete',
    message: 'Institutional report for RELIANCE (FY26 Target: 3,350) is ready to view.',
    type: 'info',
    category: 'report',
    timestamp: Date.now() - 1000 * 60 * 360, // 6h ago
    read: true,
    link: '/analysis?ticker=RELIANCE&market=india',
  },
]

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    if (typeof window === 'undefined') return INITIAL_NOTIFICATIONS
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (e) {
      console.warn('Failed to parse notifications from localStorage:', e)
    }
    return INITIAL_NOTIFICATIONS
  })

  const [toasts, setToasts] = useState<ToastItem[]>([])

  // Persist notifications
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications))
    } catch (e) {
      console.warn('Failed to save notifications to localStorage:', e)
    }
  }, [notifications])

  const addNotification = useCallback(
    (item: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => {
      const newNotif: NotificationItem = {
        ...item,
        id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        timestamp: Date.now(),
        read: false,
      }
      setNotifications((prev) => [newNotif, ...prev])
    },
    []
  )

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
  }, [])

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const clearAllNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (item: Omit<ToastItem, 'id'>) => {
      const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)
      const duration = item.duration || 4500
      const newToast: ToastItem = { ...item, id }

      setToasts((prev) => [...prev, newToast])

      setTimeout(() => {
        dismissToast(id)
      }, duration)
    },
    [dismissToast]
  )

  const toast: ToastMethods = {
    success: (message, title) => showToast({ message, title, type: 'success' }),
    error: (message, title) => showToast({ message, title, type: 'error' }),
    info: (message, title) => showToast({ message, title, type: 'info' }),
    warning: (message, title) => showToast({ message, title, type: 'warning' }),
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        removeNotification,
        clearAllNotifications,
        toasts,
        dismissToast,
        toast,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}

export function useToast() {
  const { toast } = useNotifications()
  return toast
}
