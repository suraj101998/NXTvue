import { HTMLAttributes } from 'react'
import { cn } from '@/utils/cn'
import { Button } from '@/components/ui/Button'
import { AlertTriangle, RefreshCw, WifiOff, Server, Database } from 'lucide-react'

interface ErrorStateProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'network' | 'server' | 'data' | 'not-found'
  title?: string
  description?: string
  onRetry?: () => void
  retryLabel?: string
}

const variantConfigs = {
  default: {
    icon: AlertTriangle,
    title: 'Something went wrong',
    description: 'We encountered an unexpected error. Please try again.',
  },
  network: {
    icon: WifiOff,
    title: 'Connection Lost',
    description: 'Unable to connect to the server. Please check your internet connection and try again.',
  },
  server: {
    icon: Server,
    title: 'Server Error',
    description: 'Our servers are experiencing issues. Please try again in a few minutes.',
  },
  data: {
    icon: Database,
    title: 'Data Unavailable',
    description: 'The requested data could not be loaded. Some market data may be temporarily unavailable.',
  },
  'not-found': {
    icon: AlertTriangle,
    title: 'Page Not Found',
    description: 'The page you\'re looking for doesn\'t exist or has been moved.',
  },
}

export function ErrorState({ className, variant = 'default', title, description, onRetry, retryLabel = 'Try Again', ...props }: ErrorStateProps) {
  const config = variantConfigs[variant]
  const Icon = config.icon

  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-16 px-6', className)} {...props}>
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
        <Icon className="w-8 h-8 text-red-400" />
      </div>
      <h3 className="font-heading text-xl font-semibold text-text-primary mb-2">
        {title || config.title}
      </h3>
      <p className="text-text-secondary max-w-sm mb-6">
        {description || config.description}
      </p>
      {onRetry && (
        <Button variant="primary" onClick={onRetry} className="w-auto">
          <RefreshCw className="w-4 h-4 mr-2" />
          {retryLabel}
        </Button>
      )}
    </div>
  )
}

export function InlineError({ message, onRetry, retryLabel = 'Retry' }: { message: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div className="glass-card p-4 border-l-4 border-red-500/50 bg-red-500/5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 flex-1">
        <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
        <p className="text-text-secondary text-sm">{message}</p>
      </div>
      {onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          {retryLabel}
        </Button>
      )}
    </div>
  )
}