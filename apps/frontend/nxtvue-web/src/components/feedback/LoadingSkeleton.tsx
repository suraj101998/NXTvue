// ─── Reusable Loading Skeletons ───────────────────────────────────────────────

import { cn } from '@/utils/cn'

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xl bg-slate-50 border border-slate-200',
        className
      )}
      {...props}
    />
  )
}

export function SkeletonMetric({ className }: { className?: string }) {
  return (
    <div className={cn('glass-card p-5 animate-pulse space-y-3', className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-5 w-5 rounded-full" />
      </div>
      <Skeleton className="h-8 w-32" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  )
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('glass-card p-6 animate-pulse space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3.5 w-24" />
        </div>
        <Skeleton className="h-8 w-16 rounded-xl" />
      </div>
      <div className="space-y-2 pt-2">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-5/6" />
        <Skeleton className="h-3.5 w-3/4" />
      </div>
    </div>
  )
}

export function SkeletonTable({
  rows = 5,
  columns = 4,
  className,
}: {
  rows?: number
  columns?: number
  className?: string
}) {
  return (
    <div className={cn('glass-card overflow-hidden animate-pulse', className)}>
      <div className="p-4 border-b border-slate-200 bg-white">
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-3/4" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-slate-200">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="p-4">
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <Skeleton key={colIndex} className="h-4 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonChart({ className }: { className?: string }) {
  return (
    <div className={cn('glass-card p-6 animate-pulse space-y-4', className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-36" />
        <div className="flex gap-2">
          <Skeleton className="h-7 w-12 rounded-lg" />
          <Skeleton className="h-7 w-12 rounded-lg" />
          <Skeleton className="h-7 w-12 rounded-lg" />
        </div>
      </div>
      <div className="h-56 w-full flex items-end gap-3 pt-6 pb-2">
        {[40, 65, 30, 85, 55, 90, 45, 70, 60, 95, 75, 80].map((h, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
            <Skeleton className="w-full rounded-t-md" style={{ height: `${h}%` }} />
            <Skeleton className="h-2.5 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonReport({ className }: { className?: string }) {
  return (
    <div className={cn('glass-card p-8 animate-pulse space-y-6', className)}>
      <div className="border-b border-slate-200 pb-6 space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-4 bg-white rounded-xl space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-24" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  )
}
