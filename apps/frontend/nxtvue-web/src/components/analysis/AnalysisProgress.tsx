import { useEffect, useRef, useState } from 'react'
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react'
import type { SseStatus } from '@/types/api'
import { cn } from '@/utils/cn'

export interface AnalysisProgressProps {
  status: SseStatus | 'idle'
  message?: string
  progress?: number
  className?: string
}

export function AnalysisProgress({ status, message, progress = 0, className }: AnalysisProgressProps) {
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (status === 'fetching' || status === 'analyzing') {
      if (startRef.current === null) {
        startRef.current = Date.now()
      }
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - (startRef.current ?? Date.now())) / 1000))
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (status === 'idle') {
        startRef.current = null
        setElapsed(0)
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [status])

  if (status === 'idle') return null

  return (
    <div className={cn('glass-card p-6', className)}>
      {/* Progress bar */}
      <div className="w-full bg-bg-tertiary rounded-full h-1.5 mb-5 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-400 to-indigo-500 transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">
          {status === 'complete' && (
            <CheckCircle className="w-6 h-6 text-green-400" />
          )}
          {status === 'error' && (
            <AlertCircle className="w-6 h-6 text-red-400" />
          )}
          {(status === 'fetching' || status === 'analyzing') && (
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          )}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-text-primary font-medium text-sm">
            {message || defaultMessage(status)}
          </p>
          {(status === 'fetching' || status === 'analyzing') && (
            <p className="text-text-secondary text-xs mt-1">
              {elapsed}s elapsed
              {status === 'analyzing' && ' — typical 1–3 minutes'}
            </p>
          )}
          {status === 'analyzing' && (
            <p className="text-text-secondary text-xs mt-2 max-w-md">
              Bob AI is analysing the financial data and writing a 12-section investment report.
            </p>
          )}
        </div>

        {/* Progress % */}
        {(status === 'fetching' || status === 'analyzing') && (
          <span className="flex-shrink-0 text-xs font-mono text-text-secondary">
            {progress}%
          </span>
        )}
      </div>

      {/* Phase indicators */}
      <div className="flex gap-6 mt-5 pt-5 border-t border-border-subtle">
        <Phase label="Fetch data" active={status === 'fetching'} done={status === 'analyzing' || status === 'complete'} />
        <Phase label="Generate report" active={status === 'analyzing'} done={status === 'complete'} />
        <Phase label="Done" active={false} done={status === 'complete'} />
      </div>
    </div>
  )
}

function Phase({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'w-2 h-2 rounded-full transition-all duration-300',
          done ? 'bg-green-400' : active ? 'bg-blue-400 animate-pulse' : 'bg-bg-tertiary',
        )}
      />
      <span
        className={cn(
          'text-xs transition-colors duration-300',
          done ? 'text-green-400' : active ? 'text-blue-400 font-medium' : 'text-text-secondary',
        )}
      >
        {label}
      </span>
    </div>
  )
}

function defaultMessage(status: SseStatus | 'idle'): string {
  switch (status) {
    case 'fetching':  return 'Fetching financial data…'
    case 'analyzing': return 'Generating AI report — this takes 1–3 minutes…'
    case 'complete':  return 'Report ready'
    case 'error':     return 'Analysis failed'
    default:          return ''
  }
}
