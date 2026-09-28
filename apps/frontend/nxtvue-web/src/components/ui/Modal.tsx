import { useEffect, useRef, ReactNode, forwardRef, HTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/utils/cn'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  showClose?: boolean
}

export function Modal({ open, onClose, title, description, children, size = 'md', showClose = true }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const titleId = title ? 'modal-title' : undefined
  const descriptionId = description ? 'modal-description' : undefined

  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    function handleOverlayClick(event: MouseEvent) {
      if (event.target === overlayRef.current) onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    overlayRef.current?.addEventListener('click', handleOverlayClick)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      overlayRef.current?.removeEventListener('click', handleOverlayClick)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[90vw]',
  }

  const modalContent = (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <div
        ref={contentRef}
        className={cn(
          'w-full glass-card-strong rounded-2xl shadow-xl border border-border-default overflow-hidden animate-scale-in',
          sizes[size]
        )}
      >
        {(title || showClose) && (
          <div className="flex items-start justify-between p-6 border-b border-border-subtle">
            <div>
              {title && (
                <h2 id={titleId} className="font-heading text-lg font-semibold text-text-primary">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descriptionId} className="text-text-secondary text-sm mt-1">
                  {description}
                </p>
              )}
            </div>
            {showClose && (
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-glass transition-colors flex-shrink-0 ml-4"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

interface ModalContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export const ModalContent = forwardRef<HTMLDivElement, ModalContentProps>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('', className)} {...props}>
      {children}
    </div>
  )
)

ModalContent.displayName = 'ModalContent'