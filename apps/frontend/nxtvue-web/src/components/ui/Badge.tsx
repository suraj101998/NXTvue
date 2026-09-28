import { HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/utils/cn'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'blue' | 'green' | 'red' | 'amber' | 'indigo'
  size?: 'sm' | 'md'
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', children, ...props }, ref) => {
    const variants = {
      default: 'bg-bg-glass text-text-secondary border border-border-subtle',
      blue: 'badge-blue',
      green: 'badge-green',
      red: 'badge-red',
      amber: 'badge-amber',
      indigo: 'bg-indigo-500/15 border-indigo-500/20 text-indigo-400',
    }

    const sizes = {
      sm: 'px-2 py-0.5 text-[10px]',
      md: 'px-3 py-1 text-[11px]',
    }

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full font-medium uppercase tracking-wider',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {children}
      </span>
    )
  }
)

Badge.displayName = 'Badge'