import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/utils/cn'
import {
  LayoutDashboard,
  LineChart,
  BarChart2,
  CandlestickChart,
  Info,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react'
import { NotificationBell } from '@/components/notifications/NotificationBell'

// ─── Nav item definition ──────────────────────────────────────────────────────
interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  description?: string
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard className="w-4 h-4" />,
    description: 'Overview & market pulse',
  },
  {
    label: 'Charts',
    href: '/chart',
    icon: <CandlestickChart className="w-4 h-4" />,
    description: 'Interactive live charting',
  },
  {
    label: 'Analyze',
    href: '/analysis',
    icon: <LineChart className="w-4 h-4" />,
    description: 'Deep-dive any asset',
  },
  {
    label: 'My Portfolio',
    href: '/portfolio',
    icon: <BarChart2 className="w-4 h-4" />,
    description: 'Holdings & watchlist',
  },
  {
    label: 'About',
    href: '/about',
    icon: <Info className="w-4 h-4" />,
    description: 'Our story & mission',
  },
]


// ─── Pill indicator that slides under the active link ─────────────────────────
// Measured via refs; we track each nav item's offsetLeft + offsetWidth.
function NavPill({ items }: { items: NavItem[] }) {
  const location = useLocation()
  const refs = useRef<Record<string, HTMLAnchorElement | null>>({})
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null)

  useEffect(() => {
    const activeHref = items.find(it => {
      if (it.href === '/dashboard') return location.pathname === '/dashboard'
      if (it.href === '/analysis')  return location.pathname.startsWith('/analysis')
      if (it.href === '/chart')     return location.pathname.startsWith('/chart')
      if (it.href === '/portfolio') return location.pathname.startsWith('/portfolio')
      return location.pathname === it.href
    })?.href

    if (!activeHref) { setPill(null); return }
    const el = refs.current[activeHref]
    if (!el) return
    const parent = el.closest('nav')
    if (!parent) return
    const elRect = el.getBoundingClientRect()
    const parentRect = parent.getBoundingClientRect()
    setPill({ left: elRect.left - parentRect.left, width: elRect.width })
  }, [location.pathname, items])

  return (
    <>
      {pill && (
        <motion.div
          layoutId="nav-pill"
          className="absolute bottom-0 h-full rounded-xl bg-slate-50 border border-slate-200 pointer-events-none"
          style={{ left: pill.left, width: pill.width }}
          transition={{ type: 'spring', stiffness: 400, damping: 34 }}
        />
      )}
      {items.map(item => (
        <Link
          key={item.href}
          to={item.href}
          ref={el => { refs.current[item.href] = el }}
          aria-current={location.pathname.startsWith(item.href) && item.href !== '/dashboard' ? 'page' :
            location.pathname === item.href ? 'page' : undefined}
          className="relative z-10 flex items-center gap-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-200
            text-text-muted hover:text-text-primary"
        >
          {item.icon}
          <span>{item.label}</span>
        </Link>
      ))}
    </>
  )
}

// ─── Main Navigation ──────────────────────────────────────────────────────────
export function Navigation() {
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  // Close mobile menu on route change AND fire routechange so inner-scroll source resets
  useEffect(() => {
    setMobileOpen(false)
    window.dispatchEvent(new CustomEvent('nxtvue:routechange'))
  }, [location.pathname])

  // Track scroll — pure window.scroll; scrolled = true when past 16px threshold.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
    window.addEventListener('scroll', onScroll, { passive: true })
    // Sync immediately in case the page mounts already scrolled
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Reset scrolled state on every route change (new page starts at top)
  useEffect(() => {
    setScrolled(window.scrollY > 16)
  }, [location.pathname])

  const handleLogout = () => navigate('/login')

  // Active state for individual items (used in mobile)
  const isActive = (href: string) => {
    if (href === '/dashboard') return location.pathname === '/dashboard'
    if (href === '/analysis')  return location.pathname.startsWith('/analysis')
    if (href === '/portfolio')  return location.pathname.startsWith('/portfolio')
    if (href === '/chart')      return location.pathname.startsWith('/chart')
    return location.pathname === href
  }

  return (
    <>
      {/* ── Desktop / Tablet Navbar ────────────────────────────────────────── */}
      {/*
        Two-layer approach:
        • Outer div  = always full-width; carries the background/border when NOT scrolled
        • Inner div  = the centred floating pill when scrolled, plain content row otherwise
        This ensures there are never bare side gaps regardless of viewport width.
      */}
      <div
        className={cn(
          'hidden lg:block w-full transition-all duration-250',
          !scrolled && 'bg-white/95 backdrop-blur-xl border-b border-slate-200',
          scrolled  && 'bg-transparent',
        )}
      >
        {/* Inner pill — shrinks to floating card on scroll */}
        <div
          className={cn(
            'mx-auto transition-all duration-250',
            scrolled
              ? 'mt-3 max-w-[1240px] px-4 pb-3'
              : 'max-w-[1800px] px-6 lg:px-10',
          )}
        >
        <div
          className={cn(
              'hidden lg:flex items-center justify-between h-[60px] px-4 transition-all duration-250',
            scrolled
              ? [
                  'rounded-2xl',
                  'bg-white',
                  'backdrop-blur-[48px] saturate-[1.8]',
                  'border border-slate-300',
                  'shadow-[0_8px_30px_rgba(15,23,42,0.12)]',
                ].join(' ')
              : 'bg-transparent',
          )}
        >
          {/* ── Brand ──────────────────────────────────────────────────── */}
          <Link
            to="/dashboard"
            className="flex items-center gap-2.5 shrink-0 group"
            aria-label="NXTvue — go to dashboard"
          >
            <svg className="w-6 h-[18px] text-slate-900 transition-opacity group-hover:opacity-80" viewBox="0 0 23 17" aria-hidden="true">
              <path d="M8.15 0.9 L4.55 0.9 L0.5 9.3 L4.1 9.3 Z" fill="currentColor" />
              <path d="M17.0 0 L13.4 0 L6.15 16.4 L9.75 16.4 Z" fill="currentColor" />
              <path d="M22.9 0 L19.3 0 L15.0 7.6 L18.6 7.6 Z" fill="currentColor" />
              <path d="M22.6 6.9 L19.0 6.9 L14.05 16.4 L17.65 16.4 Z" fill="currentColor" />
            </svg>
            <span
              className="font-heading text-[17px] font-bold tracking-[0.08em] text-slate-900"
            >
              NXTvue
            </span>
          </Link>

          {/* ── Centre nav links with animated pill ────────────────────── */}
          <nav
            className="relative flex items-center gap-1 px-1 py-1 rounded-xl"
            role="navigation"
            aria-label="Main navigation"
          >
            <NavPill items={NAV_ITEMS} />
          </nav>

          {/* ── Right — action buttons ──────────────────────────────────── */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Notification Bell */}
            <NotificationBell />

            {/* See Plans */}
            <Link
              to="/pricing"
              className="flex items-center px-4 py-2 rounded-xl text-sm font-semibold text-white bg-slate-900 hover:bg-blue-700 shadow-sm transition-colors duration-200"
            >
              See Plans
            </Link>

            {/* Logout — turns red on hover */}
            <button
              type="button"
              onClick={handleLogout}
              className="group flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-250 bg-white border border-slate-300 text-slate-600 hover:bg-red-50 hover:border-red-300 hover:text-red-600"
            >
              <LogOut className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
        </div>
      </div>

      {/* ── Mobile header bar ──────────────────────────────────────────────── */}
      <div className="lg:hidden flex items-center justify-between h-[56px] px-5
        bg-white/95 backdrop-blur-xl border-b border-slate-200">
        {/* Brand */}
        <Link to="/dashboard" className="flex items-center gap-2.5" aria-label="NXTvue">
          <svg className="w-5 h-[15px] text-slate-900" viewBox="0 0 23 17" aria-hidden="true">
            <path d="M8.15 0.9 L4.55 0.9 L0.5 9.3 L4.1 9.3 Z" fill="currentColor" />
            <path d="M17.0 0 L13.4 0 L6.15 16.4 L9.75 16.4 Z" fill="currentColor" />
            <path d="M22.9 0 L19.3 0 L15.0 7.6 L18.6 7.6 Z" fill="currentColor" />
            <path d="M22.6 6.9 L19.0 6.9 L14.05 16.4 L17.65 16.4 Z" fill="currentColor" />
          </svg>
          <span
            className="font-heading text-base font-bold tracking-[0.08em] text-slate-900"
          >
            NXTvue
          </span>
        </Link>

        {/* Right mobile controls */}
        <div className="flex items-center gap-2">
          <NotificationBell />
          {/* Hamburger */}
          <button
            className="p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-slate-50 transition-colors"
            onClick={() => setMobileOpen(v => !v)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* ── Mobile drawer ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[290] bg-slate-900/40 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
            />

            {/* Drawer panel */}
            <motion.div
              key="drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 36 }}
              className={cn(
                'fixed top-0 right-0 bottom-0 z-[295] w-[300px] lg:hidden',
                'flex flex-col',
                'bg-white',
                'border-l border-slate-200',
                'shadow-[-20px_0_50px_rgba(15,23,42,0.15)]',
              )}
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
                <div className="flex items-center gap-2.5">
                  <svg className="w-5 h-[15px] text-slate-900" viewBox="0 0 23 17" aria-hidden="true">
                    <path d="M8.15 0.9 L4.55 0.9 L0.5 9.3 L4.1 9.3 Z" fill="currentColor" />
                    <path d="M17.0 0 L13.4 0 L6.15 16.4 L9.75 16.4 Z" fill="currentColor" />
                    <path d="M22.9 0 L19.3 0 L15.0 7.6 L18.6 7.6 Z" fill="currentColor" />
                    <path d="M22.6 6.9 L19.0 6.9 L14.05 16.4 L17.65 16.4 Z" fill="currentColor" />
                  </svg>
                  <span
                    className="font-heading text-base font-bold tracking-[0.08em] text-slate-900"
                  >
                    NXTvue
                  </span>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-slate-50 transition-colors"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Nav links */}
              <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1" role="navigation" aria-label="Mobile navigation">
                {NAV_ITEMS.map((item, i) => (
                  <motion.div
                    key={item.href}
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Link
                      to={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'flex items-center justify-between px-4 py-3.5 rounded-xl transition-all duration-200',
                        isActive(item.href)
                          ? 'bg-slate-100 border border-slate-200 text-text-primary'
                          : 'text-text-muted hover:bg-slate-50 hover:text-text-primary',
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          'p-2 rounded-lg',
                          isActive(item.href) ? 'bg-blue-100 text-blue-700' : 'bg-slate-50 text-text-muted'
                        )}>
                          {item.icon}
                        </span>
                        <div>
                          <p className="text-sm font-semibold leading-none mb-0.5">{item.label}</p>
                          {item.description && (
                            <p className="text-[11px] text-text-muted leading-none">{item.description}</p>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-text-muted" />
                    </Link>
                  </motion.div>
                ))}
              </nav>

              {/* Bottom CTA buttons */}
              <div className="px-4 pb-8 pt-4 border-t border-slate-200 space-y-3">
                <Link
                  to="/pricing"
                  onClick={() => setMobileOpen(false)}
                  className="w-full flex items-center justify-center px-4 py-3 rounded-xl text-sm font-semibold text-white bg-slate-900 hover:bg-blue-700 transition-colors"
                >
                  See Plans
                </Link>
                {/* Logout — red hover mobile */}
                <button
                  type="button"
                  onClick={() => { setMobileOpen(false); handleLogout() }}
                  className="group w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-300 hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-all duration-200"
                >
                  <LogOut className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
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