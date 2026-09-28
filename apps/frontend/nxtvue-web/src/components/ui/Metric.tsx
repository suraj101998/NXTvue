import { HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/utils/cn'

export interface MetricProps extends HTMLAttributes<HTMLDivElement> {
  value: string | number
  label: string
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  prefix?: string
  suffix?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export const Metric = forwardRef<HTMLDivElement, MetricProps>(
  ({ className, value, label, change, changeType = 'neutral', prefix, suffix, size = 'md', ...props }, ref) => {
    const sizes = {
      sm: { value: 'text-2xl', label: 'text-caption', gap: 'gap-1' },
      md: { value: 'text-3xl', label: 'text-caption', gap: 'gap-2' },
      lg: { value: 'text-4xl', label: 'text-body-sm', gap: 'gap-3' },
      xl: { value: 'text-5xl', label: 'text-body', gap: 'gap-3' },
    }

    const changeColors = {
      positive: 'metric-change-positive',
      negative: 'metric-change-negative',
      neutral: 'text-text-muted',
    }

    return (
      <div
        ref={ref}
        className={cn('flex flex-col', sizes[size].gap, className)}
        {...props}
      >
        <div className="flex items-baseline gap-1">
          {prefix && <span className="font-heading font-bold text-text-primary">{prefix}</span>}
          <span className={cn('metric-value', sizes[size].value)}>
            {value}
          </span>
          {suffix && <span className="font-heading font-bold text-text-primary">{suffix}</span>}
        </div>
        <span className={cn('metric-label', sizes[size].label)}>{label}</span>
        {change && (
          <span className={cn('metric-label font-mono', changeColors[changeType])}>
            {change}
          </span>
        )}
      </div>
    )
  }
)

Metric.displayName = 'Metric'

export interface MetricGroupProps extends HTMLAttributes<HTMLDivElement> {
  columns?: 1 | 2 | 3 | 4
  gap?: 'sm' | 'md' | 'lg'
}

export const MetricGroup = forwardRef<HTMLDivElement, MetricGroupProps>(
  ({ className, columns = 3, gap = 'md', children, ...props }, ref) => {
    const gridCols = {
      1: 'grid-cols-1',
      2: 'grid-cols-1 sm:grid-cols-2',
      3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
      4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    }

    const gaps = {
      sm: 'gap-3',
      md: 'gap-4',
      lg: 'gap-6',
    }

    return (
      <div
        ref={ref}
        className={cn('grid', gridCols[columns], gaps[gap], className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)

MetricGroup.displayName = 'MetricGroup'