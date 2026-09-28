import { HTMLAttributes } from 'react'
import { cn } from '@/utils/cn'
import { Button } from '@/components/ui/Button'
import { Search, Plus, FolderOpen, BarChart3, Users, Shield } from 'lucide-react'

interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'portfolio' | 'watchlist' | 'analysis' | 'search' | 'compare'
  title?: string
  description?: string
  action?: React.ReactNode
  icon?: any
}

const variantConfigs = {
  default: {
    icon: FolderOpen,
    title: 'Nothing here yet',
    description: 'Get started by adding your first item.',
  },
  portfolio: {
    icon: BarChart3,
    title: 'No Portfolio Yet',
    description: 'Your portfolio is ready for its first insight. Add an investment to begin.',
  },
  watchlist: {
    icon: Search,
    title: 'No Watchlist',
    description: 'Nothing here yet. Save investments you want NXTvue to monitor.',
  },
  analysis: {
    icon: BarChart3,
    title: 'No Analysis',
    description: 'Search for an investment to begin your analysis.',
  },
  search: {
    icon: Search,
    title: 'No Results Found',
    description: 'Try adjusting your search terms or filters.',
  },
  compare: {
    icon: Users,
    title: 'Select Investments to Compare',
    description: 'Choose two or more investments to see a side-by-side comparison.',
  },
}

export function EmptyState({ className, variant = 'default', title, description, action, icon, ...props }: EmptyStateProps) {
  const config = variantConfigs[variant]
  const Icon = icon || config.icon

  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-16 px-6', className)} {...props}>
      <div className="w-16 h-16 rounded-2xl bg-bg-glass border border-border-subtle flex items-center justify-center mb-6 text-text-muted">
        <Icon className="w-8 h-8" />
      </div>
      <h3 className="font-heading text-xl font-semibold text-text-primary mb-2">
        {title || config.title}
      </h3>
      <p className="text-text-secondary max-w-sm mb-6">
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

export function EmptyStateWithAction({ variant = 'default', actionLabel, actionHref, actionOnClick, ...props }: EmptyStateProps & { actionLabel?: string; actionHref?: string; actionOnClick?: () => void }) {
  return (
    <EmptyState variant={variant} {...props}>
      {(actionLabel || actionHref || actionOnClick) && (
        <Button
          variant="primary"
          onClick={actionOnClick}
          asChild={!!actionHref}
        >
          {actionHref ? <a href={actionHref}>{actionLabel || 'Get Started'}</a> : actionLabel || 'Get Started'}
        </Button>
      )}
    </EmptyState>
  )
}