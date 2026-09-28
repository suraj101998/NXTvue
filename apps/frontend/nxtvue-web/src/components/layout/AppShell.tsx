import { ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { cn } from '@/utils/cn'

interface AppShellProps {
  className?: string
  children?: ReactNode
  hideHeader?: boolean
}

export function AppShell({ className, hideHeader = false, children }: AppShellProps) {
  return (
    <div className={cn('min-h-screen bg-bg-primary', className)}>
      {!hideHeader && <Header />}
      <main
        id="main-content"
        className={cn('pt-14 lg:pt-[60px]', hideHeader && 'pt-0')}
        role="main"
      >
        {children || <Outlet />}
      </main>
      <footer className="border-t border-border-subtle bg-bg-secondary/50">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-text-muted text-sm">
              © 2026 NXTvue. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-text-muted hover:text-text-primary text-sm transition-colors">Privacy</a>
              <a href="#" className="text-text-muted hover:text-text-primary text-sm transition-colors">Terms</a>
              <a href="#" className="text-text-muted hover:text-text-primary text-sm transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}