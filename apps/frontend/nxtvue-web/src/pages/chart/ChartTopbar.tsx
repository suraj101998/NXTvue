import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { NotificationBell } from '@/components/notifications/NotificationBell'

const NAV = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Charts', href: '/chart' },
  { label: 'Analyze', href: '/analysis' },
  { label: 'My Portfolio', href: '/portfolio' },
  { label: 'About', href: '/about' },
]

export function ChartTopbar({ theme, onTheme }: { theme: 'dark' | 'light'; onTheme: () => void }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  return (
    <div className="topbar">
      <div className="tb">
        <div className="nbar">
          <Link className="logo" to="/dashboard">
            <span className="mk">
              <svg viewBox="0 0 28 22" fill="none" stroke="url(#nxc-lg)" strokeWidth="3.2" strokeLinecap="round">
                <defs>
                  <linearGradient id="nxc-lg" x1="0" y1="0" x2="1" y2="1">
                    <stop stopColor="#2de2c4" />
                    <stop offset="1" stopColor="#ffb454" />
                  </linearGradient>
                </defs>
                <path d="M10 2 4 20M18 2l-6 18M26 2l-6 18" />
              </svg>
            </span>
            NXTvue
          </Link>
          <div className="links">
            {NAV.map((n) => (
              <Link key={n.href} to={n.href} className={pathname.startsWith(n.href) ? 'cur' : ''} aria-current={pathname.startsWith(n.href) ? 'page' : undefined}>
                {n.label}
              </Link>
            ))}
          </div>
          <div className="nact">
            <button type="button" className="ib" aria-label="Toggle theme" onClick={onTheme} title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
              </svg>
            </button>
            <NotificationBell triggerClassName="ib" />
            <Link className="btn p" to="/pricing">
              See Plans
            </Link>
            <button type="button" className="btn lo" onClick={() => navigate('/login')}>
              Logout
            </button>
            <button type="button" className="ib burger" aria-label="Menu" onClick={() => setOpen((v) => !v)}>
              &#9776;
            </button>
          </div>
        </div>
        <div className={`sheet${open ? ' open' : ''}`} onClick={() => setOpen(false)}>
          {NAV.map((n) => (
            <Link key={n.href} to={n.href}>
              {n.label}
            </Link>
          ))}
          <a
            href="/login"
            onClick={(e) => {
              e.preventDefault()
              navigate('/login')
            }}
          >
            Logout
          </a>
        </div>
      </div>
    </div>
  )
}

export function ChartFooter() {
  return (
    <footer className="foot">
      <div className="w">
        <div className="fgrid">
          <div>
            <Link className="logo" to="/dashboard" style={{ padding: 0 }}>
              <svg viewBox="0 0 28 22" width="26" height="22" fill="none" stroke="url(#nxc-lg)" strokeWidth="3" strokeLinecap="round">
                <path d="M10 2 4 20M18 2l-6 18M26 2l-6 18" />
              </svg>
              NXTvue
            </Link>
            <p>Institutional-grade equity research, generated from historical and market data and built for patient capital.</p>
          </div>
          <div>
            <h5>Product</h5>
            {NAV.slice(0, 4).map((n) => (
              <Link key={n.href} to={n.href}>
                {n.label}
              </Link>
            ))}
          </div>
          <div>
            <h5>Company</h5>
            <Link to="/about">About</Link>
            <Link to="/pricing">See Plans</Link>
            <a href="#top">Contact</a>
          </div>
          <div>
            <h5>Legal</h5>
            <a href="#top">Privacy</a>
            <a href="#top">Terms</a>
            <a href="#top">Disclaimer</a>
          </div>
        </div>
        <div className="fbot">
          <span>© 2026 NXTvue. All rights reserved.</span>
          <span className="s">
            <i />
            Engine online
          </span>
          <a className="btn" href="#top">
            Back to top ↑
          </a>
        </div>
        <div className="wm" aria-hidden="true">
          NXTvue
        </div>
      </div>
    </footer>
  )
}
