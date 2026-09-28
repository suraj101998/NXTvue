import { forwardRef, HTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

export interface PageContainerProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'narrow' | 'full'
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
}

export const PageContainer = forwardRef<HTMLDivElement, PageContainerProps>(
  ({ className, variant = 'default', padding = 'lg', children, ...props }, ref) => {
    const variants = {
      default: 'max-w-[1400px] mx-auto',
      narrow: 'max-w-[900px] mx-auto',
      full: 'max-w-full',
    }

    const paddings = {
      none: '',
      sm: 'px-4',
      md: 'px-6',
      lg: 'px-8',
      xl: 'px-12',
    }

    return (
      <div
        ref={ref}
        className={cn(variants[variant], paddings[padding], 'w-full', className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)

PageContainer.displayName = 'PageContainer'

export const Section = forwardRef<HTMLSectionElement, HTMLAttributes<HTMLSectionElement> & { spacing?: 'sm' | 'md' | 'lg' | 'xl' }>(
  ({ className, spacing = 'lg', children, ...props }, ref) => {
    const spacings = {
      sm: 'py-8',
      md: 'py-12',
      lg: 'py-16',
      xl: 'py-24',
    }

    return (
      <section
        ref={ref}
        className={cn(spacings[spacing], className)}
        {...props}
      >
        {children}
      </section>
    )
  }
)

Section.displayName = 'Section'