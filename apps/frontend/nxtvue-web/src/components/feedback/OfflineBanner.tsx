// ─── Offline Banner Component ─────────────────────────────────────────────────

import { motion, AnimatePresence } from 'framer-motion'
import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

export function OfflineBanner() {
  const isOnline = useOnlineStatus()

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
          className="fixed top-0 left-0 right-0 z-[1000] bg-amber-500 text-black px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 shadow-lg"
        >
          <WifiOff className="w-4 h-4" />
          <span>You are currently offline. Viewing cached data and offline mode.</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
