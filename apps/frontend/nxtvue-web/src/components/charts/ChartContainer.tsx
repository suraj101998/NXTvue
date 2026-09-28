import { forwardRef, HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/utils/cn'
import { Loader2 } from 'lucide-react'

export interface ChartContainerProps extends HTMLAttributes<HTMLDivElement> {
  title?: string
  subtitle?: string
  action?: ReactNode
  loading?: boolean
  error?: string
  empty?: boolean
  emptyMessage?: string
  height?: string
}

export const ChartContainer = forwardRef<HTMLDivElement, ChartContainerProps>(
  ({ className, title, subtitle, action, loading, error, empty, emptyMessage = 'No data available', height = '300px', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('glass-card', className)}
        {...props}
      >
        {(title || subtitle || action) && (
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-border-subtle">
            <div>
              {title && <h3 className="font-heading text-lg font-semibold text-text-primary">{title}</h3>}
              {subtitle && <p className="text-text-secondary text-sm mt-0.5">{subtitle}</p>}
            </div>
            {action && <div>{action}</div>}
          </div>
        )}
        <div className="relative" style={{ height }}>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-bg-primary/50 backdrop-blur-sm z-10">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                <span className="text-text-secondary text-sm">Loading chart...</span>
              </div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-bg-primary/50 backdrop-blur-sm z-10 p-4 text-center">
              <div className="glass-card-strong p-6 max-w-md">
                <svg className="w-10 h-10 text-red-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-text-primary font-medium mb-1">Failed to load chart</p>
                <p className="text-text-secondary text-sm mb-4">{error}</p>
                <button className="btn-secondary text-sm" onClick={() => window.location.reload()}>
                  Try Again
                </button>
              </div>
            </div>
          )}
          {empty && !loading && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-bg-primary/50 backdrop-blur-sm z-10 p-4 text-center">
              <div className="glass-card-strong p-6 max-w-md">
                <svg className="w-10 h-10 text-text-muted mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-text-primary font-medium mb-1">No Data Available</p>
                <p className="text-text-secondary text-sm">{emptyMessage}</p>
              </div>
            </div>
          )}
          {!loading && !error && !empty && (
            <div className="w-full h-full">
              {children}
            </div>
          )}
        </div>
      </div>
    )
  }
)

ChartContainer.displayName = 'ChartContainer'
// ReportTable component for displaying tabular data
export interface ReportTableProps extends HTMLAttributes<HTMLDivElement> {
  headers: string[]
  rows: (string | React.ReactNode)[][]
}

export const ReportTable = forwardRef<HTMLDivElement, ReportTableProps>(
  ({ className, headers, rows, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('overflow-x-auto mb-10 border border-white/10 rounded-xl bg-white/[0.02] backdrop-blur-md shadow-2xl', className)}
      {...props}
    >
      <table className="w-full text-sm text-left whitespace-nowrap">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.03]">
            {headers.map((h, i) => (
              <th key={i} className="px-5 py-4 font-heading font-medium text-white/90 tracking-wide">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/[0.04] transition-colors duration-200">
              {row.map((cell, j) => (
                <td key={j} className={`px-5 py-3.5 font-body text-white/70 ${j === 0 ? 'font-medium text-white/80' : ''}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
)

ReportTable.displayName = 'ReportTable'
