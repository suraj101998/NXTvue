import { HTMLAttributes } from 'react'
import { cn } from '@/utils/cn'
import { Loader2 } from 'lucide-react'

interface LoadingStateProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'spinner' | 'skeleton' | 'inline'
  size?: 'sm' | 'md' | 'lg'
  text?: string
}

export function LoadingState({ className, variant = 'spinner', size = 'md', text, ...props }: LoadingStateProps) {
  const sizes = {
    sm: { spinner: 'w-5 h-5', text: 'text-xs' },
    md: { spinner: 'w-8 h-8', text: 'text-sm' },
    lg: { spinner: 'w-12 h-12', text: 'text-base' },
  }

  if (variant === 'inline') {
    return (
      <div className={cn('inline-flex items-center gap-2', className)} {...props}>
        <Loader2 className={cn(sizes[size].spinner, 'text-blue-400 animate-spin')} />
        {text && <span className={cn('text-text-secondary', sizes[size].text)}>{text}</span>}
      </div>
    )
  }

  if (variant === 'skeleton') {
    return (
      <div className={cn('space-y-3', className)} {...props}>
        <div className="h-4 bg-gradient-to-r from-bg-tertiary via-bg-card to-bg-tertiary rounded animate-pulse" style={{ width: '60%' }} />
        <div className="h-4 bg-gradient-to-r from-bg-tertiary via-bg-card to-bg-tertiary rounded animate-pulse" style={{ width: '40%' }} />
        <div className="h-4 bg-gradient-to-r from-bg-tertiary via-bg-card to-bg-tertiary rounded animate-pulse" style={{ width: '80%' }} />
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)} {...props}>
      <Loader2 className={cn(sizes[size].spinner, 'text-blue-400 animate-spin')} />
      {text && <span className={cn('text-text-secondary', sizes[size].text)}>{text}</span>}
    </div>
  )
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('glass-card p-6 animate-pulse', className)}>
      <div className="h-6 bg-gradient-to-r from-bg-tertiary via-bg-card to-bg-tertiary rounded w-3/4 mb-4" />
      <div className="h-4 bg-gradient-to-r from-bg-tertiary via-bg-card to-bg-tertiary rounded w-1/2 mb-2" />
      <div className="h-4 bg-gradient-to-r from-bg-tertiary via-bg-card to-bg-tertiary rounded w-1/3" />
    </div>
  )
}

export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="glass-card overflow-hidden animate-pulse">
      <div className="p-4 border-b border-border-subtle">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }).map((_, i) => (
            <div key={i} className="h-4 bg-gradient-to-r from-bg-tertiary via-bg-card to-bg-tertiary rounded w-3/4" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-border-subtle">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="p-4">
            <div className="grid" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <div key={colIndex} className="h-5 bg-gradient-to-r from-bg-tertiary via-bg-card to-bg-tertiary rounded w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}