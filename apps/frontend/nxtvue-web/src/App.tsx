import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, ProtectedRoute } from '@/auth'
import { NotificationProvider } from '@/context/NotificationContext'
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/pages/login/LoginPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { AnalysisPage } from '@/pages/analysis/AnalysisPage'
import { AnalysisHistoryPage } from '@/pages/analysis/AnalysisHistoryPage'
import { PortfolioPage } from '@/pages/portfolio/PortfolioPage'
import { ChartPage } from '@/pages/chart/ChartPage'
import { PricingPage } from '@/pages/pricing/PricingPage'
import { AboutPage } from '@/pages/about/AboutPage'

function App() {
  return (
    <ErrorBoundary sectionName="Application">
      <AuthProvider>
        <NotificationProvider>
          <Routes>
            {/* Root path renders the Login Page directly */}
            <Route path="/" element={<LoginPage />} />

            {/* Public Login Route */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected application routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <DashboardPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/analysis"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <AnalysisPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/analysis/:ticker"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <AnalysisPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/analysis/history"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <AnalysisHistoryPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/chart"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <ChartPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/chart/:symbol"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <ChartPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/portfolio"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <PortfolioPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/pricing"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <PricingPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/about"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <AboutPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            {/* Fallback */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </NotificationProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
