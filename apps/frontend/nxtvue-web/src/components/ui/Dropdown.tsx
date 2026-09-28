import { useState, useRef, useEffect, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/utils/cn'
import { ChevronDown, X } from 'lucide-react'

interface DropdownProps {
  trigger: ReactNode
  content: ReactNode
  align?: 'left' | 'right'
  offset?: number
}

export function Dropdown({ trigger, content, align = 'right', offset = 8 }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (triggerRef.current && !triggerRef.current.contains(event.target as Node) &&
          contentRef.current && !contentRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const dropdownContent = (
    <div
      ref={contentRef}
      className={cn(
        'fixed z-[600] glass-card-strong rounded-xl shadow-xl border border-border-default py-1.5 min-w-[180px] animate-scale-in',
        align === 'right' ? 'origin-top-right' : 'origin-top-left'
      )}
      role="menu"
    >
      {content}
    </div>
  )

  return (
    <>
      <div ref={triggerRef} className="relative inline-block">
        {trigger}
      </div>
      {open && createPortal(dropdownContent, document.body)}
    </>
  )
}

interface DropdownItemProps {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  destructive?: boolean
  icon?: ReactNode
  shortcut?: string
}

export function DropdownItem({ children, onClick, disabled, destructive, icon, shortcut }: DropdownItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full px-4 py-2.5 text-left text-sm font-medium transition-colors flex items-center gap-3',
        destructive
          ? 'text-red-400 hover:bg-red-500/10'
          : 'text-text-secondary hover:text-text-primary hover:bg-bg-glass',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      role="menuitem"
    >
      {icon && <span className="w-4 h-4 flex-shrink-0">{icon}</span>}
      <span className="flex-1">{children}</span>
      {shortcut && <span className="text-text-muted text-xs font-mono">{shortcut}</span>}
    </button>
  )
}

export function DropdownSeparator() {
  return <div className="h-px bg-border-subtle my-1.5" role="separator" />
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
      {children}
    </div>
  )
}