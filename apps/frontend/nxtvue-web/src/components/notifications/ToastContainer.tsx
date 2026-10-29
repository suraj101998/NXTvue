// ─── Toast Container Component ────────────────────────────────────────────────

import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react'
import { useNotifications, ToastItem } from '@/context/NotificationContext'
import { cn } from '@/utils/cn'

export function ToastContainer() {
  const { toasts, dismissToast } = useNotifications()

  return (
    <div className="fixed top-20 right-6 z-[600] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  )
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
    info: <Info className="w-5 h-5 text-blue-600 shrink-0" />,
  }

  const borderColors = {
    success: 'border-green-500/30',
    error: 'border-red-500/30',
    warning: 'border-amber-500/30',
    info: 'border-blue-500/30',
  }

  const bgAccents = {
    success: 'bg-green-500/10',
    error: 'bg-red-500/10',
    warning: 'bg-amber-500/10',
    info: 'bg-blue-500/10',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-2xl backdrop-blur-3xl border text-sm',
        'bg-[rgba(8,12,28,0.95)]',
        borderColors[toast.type]
      )}
    >
      <div className={cn('p-1.5 rounded-xl', bgAccents[toast.type])}>
        {icons[toast.type]}
      </div>

      <div className="flex-1 min-w-0 pt-0.5">
        {toast.title && (
          <p className="font-heading font-semibold text-text-primary text-sm mb-0.5">
            {toast.title}
          </p>
        )}
        <p className="text-xs text-text-secondary leading-relaxed">{toast.message}</p>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-slate-50 transition-colors shrink-0"
        aria-label="Dismiss toast"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  )
}
