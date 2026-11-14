import { ReactNode, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Header } from './Header'
import { SiteFooter } from './SiteFooter'
import { DashBackdrop } from './DashBackdrop'
import { ChartBackdrop } from './ChartBackdrop'
import { NavActionContext, type NavAction } from './navAction'
import { ToastContainer } from '@/components/notifications/ToastContainer'
import { OfflineBanner } from '@/components/feedback/OfflineBanner'
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/utils/cn'
import './siteChrome.css'

interface AppShellProps {
  className?: string
  children?: ReactNode
  hideHeader?: boolean
}

export function AppShell({ className, hideHeader = false, children }: AppShellProps) {
  const location = useLocation()
  const { theme } = useTheme()
  const [navAction, setNavAction] = useState<NavAction | null>(null)
  const path = location.pathname
  const isDashboard = path === '/dashboard' || path === '/'
  const isChart = path === '/chart' || path.startsWith('/chart/')

  return (
    <NavActionContext.Provider value={{ action: navAction, setAction: setNavAction }}>
      <div className={cn('min-h-screen', isDashboard ? 'dash-dark' : 'bg-bg-primary text-text-primary', isChart && 'chart-shell', className)}>
        {isDashboard && <DashBackdrop />}
        {isChart && <ChartBackdrop />}
        <OfflineBanner />
        <ToastContainer />
        {!hideHeader && <Header />}
        {/* The navbar is fixed, so every page starts below it. */}
        <main id="main-content" className={cn(!hideHeader && 'pt-14 lg:pt-16')} role="main">
          <ErrorBoundary sectionName="Page Content">
            {children || <Outlet />}
          </ErrorBoundary>
        </main>
        <SiteFooter theme={theme} />
      </div>
    </NavActionContext.Provider>
  )
}
