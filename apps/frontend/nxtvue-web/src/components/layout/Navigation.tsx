import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/utils/cn'
import {
  LayoutDashboard,
  LineChart,
  BarChart2,
  CandlestickChart,
  Info,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { useAuth } from '@/auth/AuthContext'
import { useNavActionValue } from './navAction'
import { Logo } from '@/components/brand/Logo'
import { ThemeButton } from './PageActions'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  description: string
}

/** The same order on every page. */
const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="w-4 h-4" />, description: 'Overview & market pulse' },
  { label: 'My Portfolio', href: '/portfolio', icon: <BarChart2 className="w-4 h-4" />, description: 'Holdings & watchlist' },
  { label: 'Charts', href: '/chart', icon: <CandlestickChart className="w-4 h-4" />, description: 'Interactive live charting' },
  { label: 'Analyze', href: '/analysis', icon: <LineChart className="w-4 h-4" />, description: 'Deep-dive any asset' },
  { label: 'About', href: '/about', icon: <Info className="w-4 h-4" />, description: 'Our story & mission' },
]

/** The two navbar buttons. Their look is the dashboard's. */
const PRIMARY_BTN =
  'bg-black text-white dark:bg-white dark:text-black text-base font-medium px-7 py-2.5 rounded-full active:scale-95 transition-all duration-200 cursor-pointer whitespace-nowrap'

function isActive(pathname: string, href: string) {
  return href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)
}

export function Navigation() {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout } = useAuth()
  const action = useNavActionValue()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Close the mobile menu when the page changes.
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  /** "See Plans" everywhere, except on a page that gives the button another job such as "See Verdict". */
  const primary = (extra: string, onNavigate?: () => void) =>
    action ? (
      <a href={action.href} onClick={onNavigate} className={cn(PRIMARY_BTN, 'hover:bg-emerald-600 dark:hover:bg-emerald-400', extra)}>
        {action.label}
      </a>
    ) : (
      <Link to="/pricing" onClick={onNavigate} className={cn(PRIMARY_BTN, 'hover:bg-emerald-600 dark:hover:bg-emerald-400', extra)}>
        See Plans
      </Link>
    )

  return (
    <>
      {/* ── Desktop / tablet ────────────────────────────────────────────── */}
      <div className="hidden lg:block relative w-full bg-white/80 dark:bg-[#0c0c0e]/75 backdrop-blur-2xl backdrop-saturate-150 border-b border-black/5 dark:border-white/[0.08]">
        <div className="max-w-[88rem] mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2" aria-label="NXTvue — go to dashboard">
            <Logo />
          </Link>

          <nav className="flex items-center gap-8" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => {
              const active = isActive(location.pathname, item.href)
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'text-[15px] font-medium transition-colors duration-200 border-b-2 py-1 whitespace-nowrap',
                    active ? 'text-black border-black dark:text-white dark:border-[#2de2c4]' : 'text-gray-700 dark:text-white/60 border-transparent hover:text-black dark:hover:text-white',
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-3">
            <NotificationBell />
            <ThemeButton />
            {primary('')}
            <button type="button" onClick={handleLogout} className={cn(PRIMARY_BTN, 'hover:bg-red-600 dark:hover:bg-red-400')}>
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile bar ──────────────────────────────────────────────────── */}
      <div className="lg:hidden relative flex items-center justify-between h-14 px-5 bg-white/80 dark:bg-[#0c0c0e]/75 backdrop-blur-2xl backdrop-saturate-150 border-b border-black/5 dark:border-white/[0.08]">
        <Link to="/dashboard" className="flex items-center gap-2" aria-label="NXTvue">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <ThemeButton compact />
          <button
            className="p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* ── Mobile drawer ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[290] bg-slate-900/40 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              key="drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 36 }}
              className="fixed top-0 right-0 bottom-0 z-[295] w-[300px] lg:hidden flex flex-col bg-white dark:bg-[#111113] border-l border-slate-200 dark:border-white/10 shadow-[-20px_0_50px_rgba(15,23,42,0.15)]"
            >
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <Logo />
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1" aria-label="Mobile navigation">
                {NAV_ITEMS.map((item, i) => {
                  const active = isActive(location.pathname, item.href)
                  return (
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <Link
                        to={item.href}
                        className={cn(
                          'flex items-center justify-between px-4 py-3.5 rounded-xl transition-all duration-200',
                          active ? 'bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 text-text-primary' : 'text-text-muted hover:bg-slate-50 dark:hover:bg-white/5 hover:text-text-primary',
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span className={cn('p-2 rounded-lg', active ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-slate-50 dark:bg-white/10 text-text-muted')}>{item.icon}</span>
                          <div>
                            <p className="text-sm font-semibold leading-none mb-0.5">{item.label}</p>
                            <p className="text-[11px] text-text-muted leading-none">{item.description}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-text-muted" />
                      </Link>
                    </motion.div>
                  )
                })}
              </nav>

              <div className="px-4 pb-8 pt-4 border-t border-slate-200 dark:border-white/10 space-y-3">
                {primary('w-full flex items-center justify-center', () => setMobileOpen(false))}
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false)
                    handleLogout()
                  }}
                  className={cn(PRIMARY_BTN, 'hover:bg-red-600 dark:hover:bg-red-400 w-full')}
                >
                  Logout
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
