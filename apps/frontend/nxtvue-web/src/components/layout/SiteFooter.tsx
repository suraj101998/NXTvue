import { Link } from 'react-router-dom'
import type { Theme } from '@/hooks/useTheme'
import { Logo } from '@/components/brand/Logo'
import './siteChrome.css'

const PRODUCT = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'My Portfolio', to: '/portfolio' },
  { label: 'Charts', to: '/chart' },
  { label: 'Analyze', to: '/analysis' },
]

/** The one footer shown under every page. */
export function SiteFooter({ theme }: { theme: Theme }) {
  return (
    <footer className="sf" data-theme={theme}>
      <div className="sf-w">
        <div className="sf-grid">
          <div>
            <Link to="/dashboard" className="sf-logo" aria-label="NXTvue">
              <Logo />
            </Link>
            <p>Institutional-grade equity research, generated from historical and market data and built for patient capital.</p>
          </div>
          <div>
            <h5>Product</h5>
            {PRODUCT.map((p) => (
              <Link key={p.to} to={p.to}>{p.label}</Link>
            ))}
          </div>
          <div>
            <h5>Company</h5>
            <Link to="/about">About</Link>
            <Link to="/pricing">See Plans</Link>
            <a href="#">Contact</a>
          </div>
          <div>
            <h5>Legal</h5>
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Disclaimer</a>
          </div>
        </div>
        <div className="sf-bot">
          <span>© 2026 NXTvue. All rights reserved.</span>
          <span className="sf-st"><i />Engine online</span>
          <button type="button" className="sf-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            Back to top ↑
          </button>
        </div>
        <div className="sf-wm" aria-hidden="true">NXTvue</div>
      </div>
    </footer>
  )
}
