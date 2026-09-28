import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/utils/cn'
import {
  LayoutDashboard,
  LineChart,
  FolderOpen,
  BarChart2,
  Info,
  Sparkles,
  LogOut,
  Menu,
  X,
  ChevronRight,
  FileText,
  TrendingUp,
} from 'lucide-react'

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
    label: 'Analyze',
    href: '/analysis',
    icon: <LineChart className="w-4 h-4" />,
    description: 'Deep-dive any asset',
  },
  {
    label: 'Reports',
    href: '/compare',
    icon: <FolderOpen className="w-4 h-4" />,
    description: 'Your recent reports',
  },
  {
    label: 'My Portfolio',
    href: '/portfolio',
    icon: <BarChart2 className="w-4 h-4" />,
    description: 'Holdings & intelligence',
  },
  {
    label: 'About',
    href: '/about',
    icon: <Info className="w-4 h-4" />,
    description: 'Our story & mission',
  },
]

// ─── Active-link helper ────────────────────────────────────────────────────────
function useIsActive(href: string) {
  const { pathname } = useLocation()
  if (href === '/dashboard') return pathname === '/dashboard'
  if (href === '/analysis')  return pathname.startsWith('/analysis')
  if (href === '/portfolio')  return pathname.startsWith('/portfolio')
  return pathname === href
}

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
      if (it.href === '/portfolio')  return location.pathname.startsWith('/portfolio')
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
          className="absolute bottom-0 h-full rounded-xl bg-white/[0.06] border border-white/[0.1] pointer-events-none"
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
          className="relative z-10 flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors duration-200
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
          'w-full transition-all duration-250',
          !scrolled && 'bg-[rgba(1,3,8,0.62)] backdrop-blur-[32px] border-b border-white/[0.06]',
          scrolled  && 'bg-transparent',
        )}
      >
        {/* Inner pill — shrinks to floating card on scroll */}
        <div
          className={cn(
            'mx-auto transition-all duration-250',
            scrolled
              ? 'mt-3 max-w-[1080px] px-4 pb-3'
              : 'max-w-[1800px] px-6 lg:px-10',
          )}
        >
        <div
          className={cn(
              'hidden lg:flex items-center justify-between h-[60px] px-4 transition-all duration-250',
            scrolled
              ? [
                  'rounded-2xl',
                  'bg-[rgba(5,9,20,0.80)]',
                  'backdrop-blur-[48px] saturate-[1.8]',
                  'border border-white/[0.12]',
                  'shadow-[0_8px_40px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)]',
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
            <svg className="w-6 h-[18px] text-white transition-opacity group-hover:opacity-80" viewBox="0 0 23 17" aria-hidden="true">
              <path d="M8.15 0.9 L4.55 0.9 L0.5 9.3 L4.1 9.3 Z" fill="currentColor" />
              <path d="M17.0 0 L13.4 0 L6.15 16.4 L9.75 16.4 Z" fill="currentColor" />
              <path d="M22.9 0 L19.3 0 L15.0 7.6 L18.6 7.6 Z" fill="currentColor" />
              <path d="M22.6 6.9 L19.0 6.9 L14.05 16.4 L17.65 16.4 Z" fill="currentColor" />
            </svg>
            <span
              className="font-heading text-[17px] font-bold tracking-[0.08em]"
              style={{
                background: 'linear-gradient(180deg, #fff 0%, #94a3b8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
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
            {/* See Plans — premium */}
            <Link
              to="/pricing"
              className="relative flex items-center gap-2 px-4 py-[7px] rounded-xl text-sm font-semibold overflow-hidden group transition-all duration-300 hover:-translate-y-px"
              style={{
                background: 'linear-gradient(135deg, rgba(56,189,248,0.15) 0%, rgba(129,140,248,0.15) 100%)',
                border: '1px solid rgba(56,189,248,0.32)',
                color: '#bae6fd',
                boxShadow: '0 0 20px rgba(56,189,248,0.12), inset 0 1px 0 rgba(255,255,255,0.07)',
              }}
            >
              {/* Hover fill */}
              <span
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-xl"
                style={{ background: 'linear-gradient(135deg, rgba(56,189,248,0.25) 0%, rgba(129,140,248,0.25) 100%)' }}
              />
              {/* Shimmer sweep on hover */}
              <span
                className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out pointer-events-none"
                style={{ background: 'linear-gradient(105deg,transparent 35%,rgba(255,255,255,0.12) 50%,transparent 65%)' }}
              />
              {/* Top prismatic line */}
              <span
                className="absolute inset-x-2 top-0 h-px pointer-events-none"
                style={{ background: 'linear-gradient(90deg,transparent,rgba(56,189,248,0.8),rgba(168,148,255,0.6),transparent)' }}
              />
              {/* Bottom faint glow edge */}
              <span
                className="absolute inset-x-4 bottom-0 h-px pointer-events-none"
                style={{ background: 'linear-gradient(90deg,transparent,rgba(56,189,248,0.2),transparent)' }}
              />
              <Sparkles className="relative z-10 w-3.5 h-3.5 text-[#38bdf8] group-hover:text-white transition-colors duration-200" />
              <span className="relative z-10 tracking-wide group-hover:text-white transition-colors duration-200">See Plans</span>
            </Link>

            {/* Logout — turns red on hover */}
            <button
              type="button"
              onClick={handleLogout}
              className="group flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-250 bg-white/[0.04] border border-white/[0.08] text-text-muted hover:bg-red-500/[0.1] hover:border-red-500/40 hover:text-red-400 hover:-translate-y-px hover:shadow-[0_0_18px_rgba(239,68,68,0.15)]"
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
        bg-[rgba(1,3,8,0.75)] backdrop-blur-[32px] border-b border-white/[0.07]">
        {/* Brand */}
        <Link to="/dashboard" className="flex items-center gap-2.5" aria-label="NXTvue">
          <svg className="w-5 h-[15px] text-white" viewBox="0 0 23 17" aria-hidden="true">
            <path d="M8.15 0.9 L4.55 0.9 L0.5 9.3 L4.1 9.3 Z" fill="currentColor" />
            <path d="M17.0 0 L13.4 0 L6.15 16.4 L9.75 16.4 Z" fill="currentColor" />
            <path d="M22.9 0 L19.3 0 L15.0 7.6 L18.6 7.6 Z" fill="currentColor" />
            <path d="M22.6 6.9 L19.0 6.9 L14.05 16.4 L17.65 16.4 Z" fill="currentColor" />
          </svg>
          <span
            className="font-heading text-base font-bold tracking-[0.08em]"
            style={{
              background: 'linear-gradient(180deg,#fff 0%,#94a3b8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            NXTvue
          </span>
        </Link>

        {/* Hamburger */}
        <button
          className="p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-colors"
          onClick={() => setMobileOpen(v => !v)}
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
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
              className="fixed inset-0 z-[290] bg-black/60 backdrop-blur-sm lg:hidden"
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
                'bg-[rgba(4,7,18,0.96)] backdrop-blur-[60px]',
                'border-l border-white/[0.08]',
                'shadow-[-40px_0_80px_rgba(0,0,0,0.6)]',
              )}
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07]">
                <div className="flex items-center gap-2.5">
                  <svg className="w-5 h-[15px] text-white" viewBox="0 0 23 17" aria-hidden="true">
                    <path d="M8.15 0.9 L4.55 0.9 L0.5 9.3 L4.1 9.3 Z" fill="currentColor" />
                    <path d="M17.0 0 L13.4 0 L6.15 16.4 L9.75 16.4 Z" fill="currentColor" />
                    <path d="M22.9 0 L19.3 0 L15.0 7.6 L18.6 7.6 Z" fill="currentColor" />
                    <path d="M22.6 6.9 L19.0 6.9 L14.05 16.4 L17.65 16.4 Z" fill="currentColor" />
                  </svg>
                  <span
                    className="font-heading text-base font-bold tracking-[0.08em]"
                    style={{
                      background: 'linear-gradient(180deg,#fff 0%,#94a3b8 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    NXTvue
                  </span>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-colors"
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
                          ? 'bg-white/[0.07] border border-white/[0.1] text-text-primary'
                          : 'text-text-muted hover:bg-white/[0.04] hover:text-text-primary',
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          'p-2 rounded-lg',
                          isActive(item.href) ? 'bg-[rgba(56,189,248,0.12)] text-[#38bdf8]' : 'bg-white/[0.05] text-text-muted'
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
              <div className="px-4 pb-8 pt-4 border-t border-white/[0.07] space-y-3">
                {/* See Plans — premium mobile */}
                <Link
                  to="/pricing"
                  onClick={() => setMobileOpen(false)}
                  className="relative w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl overflow-hidden group transition-all duration-200"
                  style={{
                    background: 'linear-gradient(135deg,rgba(56,189,248,0.15) 0%,rgba(129,140,248,0.15) 100%)',
                    border: '1px solid rgba(56,189,248,0.32)',
                    color: '#bae6fd',
                  }}
                >
                  <span
                    className="absolute inset-x-2 top-0 h-px pointer-events-none"
                    style={{ background: 'linear-gradient(90deg,transparent,rgba(56,189,248,0.8),rgba(168,148,255,0.6),transparent)' }}
                  />
                  <span
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                    style={{ background: 'linear-gradient(135deg,rgba(56,189,248,0.25) 0%,rgba(129,140,248,0.25) 100%)' }}
                  />
                  <Sparkles className="relative z-10 w-4 h-4 text-[#38bdf8]" />
                  <span className="relative z-10 text-sm font-semibold">See Plans</span>
                </Link>
                {/* Logout — red hover mobile */}
                <button
                  type="button"
                  onClick={() => { setMobileOpen(false); handleLogout() }}
                  className="group w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-text-muted bg-white/[0.04] border border-white/[0.08] hover:bg-red-500/[0.1] hover:border-red-500/40 hover:text-red-400 transition-all duration-200"
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