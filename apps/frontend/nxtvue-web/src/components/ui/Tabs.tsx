import React, { useState, HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/utils/cn'

interface TabsProps {
  defaultValue: string
  value?: string
  onChange?: (value: string) => void
  children: React.ReactNode
  variant?: 'default' | 'pills' | 'underline'
  className?: string
}

export function Tabs({ defaultValue, value, onChange, children, variant = 'default', className }: TabsProps) {
  const [activeValue, setActiveValue] = useState(value || defaultValue)
  const isControlled = value !== undefined

  const currentValue = isControlled ? value : activeValue

  const handleChange = (newValue: string) => {
    if (!isControlled) setActiveValue(newValue)
    onChange?.(newValue)
  }

  const contextValue = { currentValue, onChange: handleChange, variant }

  return (
    <TabsContext.Provider value={contextValue}>
      <div className={cn('space-y-4', className)} data-tabs>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

const TabsContext = React.createContext<{
  currentValue: string
  onChange: (value: string) => void
  variant: TabsProps['variant']
} | null>(null)

function useTabsContext() {
  const context = React.useContext(TabsContext)
  if (!context) {
    throw new Error('Tabs components must be used within Tabs')
  }
  return context
}

interface TabsListProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export const TabsList = forwardRef<HTMLDivElement, TabsListProps>(
  ({ className, children, ...props }, ref) => {
    const { variant } = useTabsContext()

    const variants = {
      default: 'bg-bg-glass backdrop-blur-md rounded-xl p-1',
      pills: 'bg-transparent',
      underline: 'bg-transparent border-b border-border-subtle',
    }

    return (
      <div
        ref={ref}
        role="tablist"
        aria-orientation="horizontal"
        className={cn('flex gap-1', variants[variant], className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)

TabsList.displayName = 'TabsList'

interface TabsTriggerProps extends HTMLAttributes<HTMLButtonElement> {
  value: string
  disabled?: boolean
}

export const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, disabled, children, ...props }, ref) => {
    const { currentValue, onChange, variant } = useTabsContext()
    const isActive = currentValue === value

    const variants = {
      default: cn(
        'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
        isActive
          ? 'bg-white text-text-primary shadow-md'
          : 'text-text-secondary hover:text-text-primary hover:bg-bg-card-hover'
      ),
      pills: cn(
        'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
        isActive
          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
          : 'text-text-secondary hover:text-text-primary hover:bg-bg-glass'
      ),
      underline: cn(
        'px-4 py-3 text-sm font-medium transition-all duration-200 relative',
        isActive
          ? 'text-text-primary'
          : 'text-text-secondary hover:text-text-primary',
        !isActive && 'after:content-[""] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-transparent hover:after:bg-blue-400/50'
      ),
    }

    return (
      <button
        ref={ref}
        role="tab"
        aria-selected={isActive}
        aria-controls={`tabs-panel-${value}`}
        id={`tabs-trigger-${value}`}
        tabIndex={isActive ? 0 : -1}
        onClick={() => !disabled && onChange(value)}
        disabled={disabled}
        className={cn(variants[variant], disabled && 'opacity-50 cursor-not-allowed', className)}
        {...props}
      >
        {children}
      </button>
    )
  }
)

TabsTrigger.displayName = 'TabsTrigger'

interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string
}

export const TabsContent = forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, children, ...props }, ref) => {
    const { currentValue } = useTabsContext()
    const isActive = currentValue === value

    if (!isActive) return null

    return (
      <div
        ref={ref}
        id={`tabs-panel-${value}`}
        role="tabpanel"
        aria-labelledby={`tabs-trigger-${value}`}
        className={cn('animate-fade-in', className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)

TabsContent.displayName = 'TabsContent'