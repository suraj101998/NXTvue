// ─── React Error Boundary ────────────────────────────────────────────────────

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onReset?: () => void
  sectionName?: string
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  showDetails: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo })
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    })
    this.props.onReset?.()
  }

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }))
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      const { sectionName } = this.props
      const { error, errorInfo, showDetails } = this.state

      return (
        <div className="w-full py-12 px-6 flex items-center justify-center">
          <div className="max-w-lg w-full bg-[rgba(10,14,28,0.9)] backdrop-blur-2xl border border-red-500/20 rounded-3xl p-8 shadow-2xl text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6 text-red-600">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h3 className="font-heading text-xl font-bold text-text-primary mb-2">
              {sectionName ? `Error in ${sectionName}` : 'Something went wrong'}
            </h3>

            <p className="text-text-secondary text-sm mb-6 leading-relaxed">
              We encountered an unexpected error while rendering this view. You can reload this section or return to the dashboard.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
              <Button
                variant="primary"
                onClick={this.handleReset}
                className="w-full sm:w-auto"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>

              <Button
                variant="outline"
                onClick={() => (window.location.href = '/dashboard')}
                className="w-full sm:w-auto"
              >
                <Home className="w-4 h-4 mr-2" />
                Go to Dashboard
              </Button>
            </div>

            {error && (
              <div className="text-left border-t border-slate-200 pt-4 mt-2">
                <button
                  type="button"
                  onClick={this.toggleDetails}
                  className="flex items-center justify-between w-full text-xs text-text-muted hover:text-text-primary transition-colors py-1"
                >
                  <span>Technical details</span>
                  {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showDetails && (
                  <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl overflow-x-auto text-[11px] font-mono text-red-700 leading-normal max-h-48 overflow-y-auto">
                    <p className="font-bold">{error.toString()}</p>
                    {errorInfo?.componentStack && (
                      <pre className="mt-2 text-text-muted text-[10px] whitespace-pre-wrap">
                        {errorInfo.componentStack}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  sectionName?: string
) {
  return function WithErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary sectionName={sectionName}>
        <Component {...props} />
      </ErrorBoundary>
    )
  }
}
