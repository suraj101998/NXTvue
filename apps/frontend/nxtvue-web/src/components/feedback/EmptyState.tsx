import { HTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/utils/cn'
import { Button } from '@/components/ui/Button'
import { Search, FolderOpen, BarChart3, Users, Bell, History, LucideIcon } from 'lucide-react'

interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'portfolio' | 'watchlist' | 'analysis' | 'search' | 'compare' | 'notifications' | 'history'
  title?: string
  description?: string
  action?: ReactNode
  icon?: LucideIcon
}

const variantConfigs = {
  default: {
    icon: FolderOpen,
    title: 'Nothing here yet',
    description: 'Get started by creating or adding your first item.',
  },
  portfolio: {
    icon: BarChart3,
    title: 'No Portfolio Loaded',
    description: 'Upload your holdings spreadsheet (.xlsx/.csv) or start with demo holdings to view analytics.',
  },
  watchlist: {
    icon: Search,
    title: 'Your Watchlist is Empty',
    description: 'Save stocks, ETFs, and funds you want NXTvue to monitor in real-time.',
  },
  analysis: {
    icon: BarChart3,
    title: 'No Active Analysis',
    description: 'Enter a ticker symbol above to run a deep institutional quantitative analysis.',
  },
  search: {
    icon: Search,
    title: 'No Results Found',
    description: 'Try searching by company name, NSE/BSE symbol, or US ticker (e.g. RELIANCE, NVDA).',
  },
  compare: {
    icon: Users,
    title: 'Select Assets to Compare',
    description: 'Choose two stocks or ETFs to see a side-by-side valuation and risk comparison.',
  },
  notifications: {
    icon: Bell,
    title: "You're All Caught Up",
    description: 'No new alerts or notifications. Important market movements and reports will appear here.',
  },
  history: {
    icon: History,
    title: 'No Analysis History',
    description: 'Reports and comparative valuations you generate will be automatically saved here.',
  },
}

export function EmptyState({
  className,
  variant = 'default',
  title,
  description,
  action,
  icon,
  ...props
}: EmptyStateProps) {
  const config = variantConfigs[variant]
  const Icon = icon || config.icon

  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-16 px-6', className)} {...props}>
      <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-5 text-blue-400 shadow-inner">
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="font-heading text-lg font-semibold text-text-primary mb-2">
        {title || config.title}
      </h3>
      <p className="text-text-secondary text-sm max-w-sm mb-6 leading-relaxed">
        {description || config.description}
      </p>
      {action && (
        <div className="flex items-center justify-center gap-3">
          {action}
        </div>
      )}
    </div>
  )
}

export function EmptyStateWithAction({
  variant = 'default',
  actionLabel,
  actionHref,
  actionOnClick,
  ...props
}: EmptyStateProps & { actionLabel?: string; actionHref?: string; actionOnClick?: () => void }) {
  return (
    <EmptyState
      variant={variant}
      action={
        (actionLabel || actionHref || actionOnClick) && (
          actionHref ? (
            <Button variant="primary" asChild>
              <Link to={actionHref}>{actionLabel || 'Get Started'}</Link>
            </Button>
          ) : (
            <Button variant="primary" onClick={actionOnClick}>
              {actionLabel || 'Get Started'}
            </Button>
          )
        )
      }
      {...props}
    />
  )
}
