import React, { forwardRef, ButtonHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, asChild, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center gap-2 font-sans font-medium rounded-full transition-all duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary disabled:opacity-50 disabled:cursor-not-allowed'

    const variants = {
      primary: 'bg-gradient-to-r from-blue-400 to-indigo-500 text-bg-primary shadow-lg shadow-blue-400/30 hover:shadow-xl hover:shadow-blue-400/45 hover:-translate-y-0.5 active:translate-y-0',
      secondary: 'bg-bg-glass backdrop-blur-md border border-border-default text-text-primary hover:bg-bg-card-hover hover:border-border-emphasis hover:-translate-y-0.5',
      ghost: 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-glass',
      outline: 'bg-transparent border border-border-default text-text-primary hover:bg-bg-glass hover:border-border-emphasis',
    }

    const sizes = {
      sm: 'px-4 py-2 text-sm',
      md: 'px-6 py-3 text-base',
      lg: 'px-8 py-4 text-lg',
    }

    const mergedClassName = cn(baseStyles, variants[variant], sizes[size], className)

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<any>
      return React.cloneElement(child, {
        ref,
        className: cn(mergedClassName, child.props.className),
        ...props,
      })
    }

    return (
      <button
        ref={ref}
        className={mergedClassName}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth="4" />
            <path className="opacity-75" d="M12 2a10 10 0 0 1 10 10" />
          </svg>
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'