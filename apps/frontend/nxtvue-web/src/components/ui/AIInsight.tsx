import { HTMLAttributes, forwardRef, useState } from 'react'
import { cn } from '@/utils/cn'
import { Sparkles, Brain, Zap, Search } from 'lucide-react'

export interface AIInsightProps extends HTMLAttributes<HTMLDivElement> {
  type?: 'insight' | 'analysis' | 'recommendation' | 'alert'
  title: string
  children: React.ReactNode
  confidence?: number
  tags?: string[]
  expandable?: boolean
  defaultExpanded?: boolean
}

export const AIInsight = forwardRef<HTMLDivElement, AIInsightProps>(
  ({ className, type = 'insight', title, children, confidence, tags, expandable = false, defaultExpanded = false, ...props }, ref) => {
    const [expanded, setExpanded] = useState(defaultExpanded)

    const typeConfig = {
      insight: { icon: Brain, color: 'text-blue-400', bg: 'bg-blue-400/5', border: 'border-blue-400/20', label: 'NXTvue INSIGHT' },
      analysis: { icon: Search, color: 'text-indigo-400', bg: 'bg-indigo-400/5', border: 'border-indigo-400/20', label: 'ANALYSIS' },
      recommendation: { icon: Sparkles, color: 'text-green-400', bg: 'bg-green-400/5', border: 'border-green-400/20', label: 'RECOMMENDATION' },
      alert: { icon: Zap, color: 'text-amber-400', bg: 'bg-amber-400/5', border: 'border-amber-400/20', label: 'ALERT' },
    }

    const config = typeConfig[type]

    return (
      <div
        ref={ref}
        className={cn(
          'glass-card-strong overflow-hidden transition-all duration-300',
          config.bg,
          config.border,
          className
        )}
        {...props}
      >
        <div className="p-5 border-b border-border-subtle">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-lg', config.bg.replace('bg-', 'bg-').replace('/5', '/15'))}>
                <config.icon className={cn('w-5 h-5', config.color)} />
              </div>
              <div>
                <span className="text-caption font-semibold uppercase tracking-wider text-text-muted">
                  {config.label}
                </span>
                <h4 className="font-heading text-body font-semibold text-text-primary mt-0.5">
                  {title}
                </h4>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {confidence !== undefined && (
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${confidence}%` }}
                    />
                  </div>
                  <span className="text-caption font-mono text-text-muted w-10 text-right">
                    {confidence}%
                  </span>
                </div>
              )}
              {expandable && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="p-1 rounded-lg hover:bg-bg-card transition-colors text-text-muted"
                  aria-expanded={expanded}
                  aria-label={expanded ? 'Collapse' : 'Expand'}
                >
                  <svg className={cn('w-4 h-4 transition-transform', expanded && 'rotate-180')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          {tags && tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span key={tag} className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded-full bg-bg-tertiary text-text-muted border border-border-subtle">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div
          className={cn('p-5 text-text-secondary leading-relaxed transition-all duration-300', !expanded && expandable && 'line-clamp-3')}
          style={{ maxHeight: expanded || !expandable ? 'none' : '4.5rem' }}
        >
          {children}
        </div>
        {expandable && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full px-5 py-3 text-left text-sm font-medium text-text-muted hover:text-text-primary hover:bg-bg-card transition-colors border-t border-border-subtle flex items-center justify-center gap-2"
          >
            {expanded ? 'Show less' : 'Read more'}
            <svg className={cn('w-4 h-4 transition-transform', expanded && 'rotate-180')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        )}
      </div>
    )
  }
)

AIInsight.displayName = 'AIInsight'