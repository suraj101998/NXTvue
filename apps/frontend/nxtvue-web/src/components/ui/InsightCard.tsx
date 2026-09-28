import { HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/utils/cn'
import { Lightbulb, AlertTriangle, TrendingUp, TrendingDown, Info, Target } from 'lucide-react'

export interface InsightCardProps extends HTMLAttributes<HTMLDivElement> {
  type?: 'insight' | 'warning' | 'opportunity' | 'risk' | 'neutral' | 'target'
  title: string
  children: React.ReactNode
  icon?: React.ReactNode
  action?: React.ReactNode
}

const typeStyles = {
  insight: 'border-blue-400/30 bg-blue-400/5',
  warning: 'border-amber-400/30 bg-amber-400/5',
  opportunity: 'border-green-400/30 bg-green-400/5',
  risk: 'border-red-400/30 bg-red-400/5',
  neutral: 'border-border-default bg-bg-glass',
  target: 'border-indigo-400/30 bg-indigo-400/5',
}

const typeIcons = {
  insight: <Lightbulb className="w-5 h-5 text-blue-400" />,
  warning: <AlertTriangle className="w-5 h-5 text-amber-400" />,
  opportunity: <TrendingUp className="w-5 h-5 text-green-400" />,
  risk: <TrendingDown className="w-5 h-5 text-red-400" />,
  neutral: <Info className="w-5 h-5 text-text-muted" />,
  target: <Target className="w-5 h-5 text-indigo-400" />,
}

export const InsightCard = forwardRef<HTMLDivElement, InsightCardProps>(
  ({ className, type = 'neutral', title, children, icon, action, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'glass-card p-6 border-l-4 transition-all duration-300 hover:border-opacity-50',
          typeStyles[type],
          className
        )}
        {...props}
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            {icon || typeIcons[type]}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-heading text-body font-semibold text-text-primary mb-2">
              {title}
            </h4>
            <div className="text-text-secondary text-body leading-relaxed">
              {children}
            </div>
            {action && (
              <div className="mt-4">
                {action}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }
)

InsightCard.displayName = 'InsightCard'