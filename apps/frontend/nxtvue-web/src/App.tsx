import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/pages/login/LoginPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { AnalysisPage } from '@/pages/analysis/AnalysisPage'
import { ComparePage } from '@/pages/compare/ComparePage'
import { PortfolioPage } from '@/pages/portfolio/PortfolioPage'
import { PortfolioIntelligencePage } from '@/pages/intelligence/PortfolioIntelligencePage'
import { PricingPage } from '@/pages/pricing/PricingPage'
import { AboutPage } from '@/pages/about/AboutPage'

function App() {
  return (
    <Routes>
      {/* Auth routes — no AppShell wrapper */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />

      {/* App routes — wrapped in AppShell */}
      <Route
        path="/*"
        element={
          <AppShell>
            <Routes>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/analysis" element={<AnalysisPage />} />
              <Route path="/analysis/:asset" element={<AnalysisPage />} />
              <Route path="/compare" element={<ComparePage />} />
              <Route path="/portfolio" element={<PortfolioPage />} />
              <Route path="/portfolio/intelligence" element={<PortfolioIntelligencePage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </AppShell>
        }
      />
    </Routes>
  )
}

export default App