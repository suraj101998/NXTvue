import { useRef, useState } from 'react'
import { Upload, FileSpreadsheet, X, Download } from 'lucide-react'
import { cn } from '@/utils/cn'

export interface FileUploadInputProps {
  onFile: (file: File) => void
  onUseDefault: () => void
  disabled?: boolean
  className?: string
}

export function FileUploadInput({ onFile, onUseDefault, disabled = false, className }: FileUploadInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [selected, setSelected] = useState<File | null>(null)

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const file = files[0]
    if (!isValidFile(file)) return
    setSelected(file)
    onFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (disabled) return
    handleFiles(e.dataTransfer.files)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    handleFiles(e.target.files)
    // reset so same file can be re-selected
    e.target.value = ''
  }

  function clearSelection() {
    setSelected(null)
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Drop zone */}
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'relative rounded-2xl border-2 border-dashed px-8 py-10 text-center transition-all duration-200 cursor-pointer select-none',
          dragging
            ? 'border-blue-400 bg-blue-400/5'
            : 'border-border-default hover:border-blue-400/60 hover:bg-bg-glass',
          disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          className="sr-only"
          onChange={handleChange}
          disabled={disabled}
        />

        {selected ? (
          <div className="flex items-center justify-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-green-400 flex-shrink-0" />
            <div className="text-left min-w-0">
              <p className="text-text-primary font-medium text-sm truncate max-w-xs">
                {selected.name}
              </p>
              <p className="text-text-secondary text-xs mt-0.5">
                {formatBytes(selected.size)} · ready to analyse
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); clearSelection() }}
              className="p-1 rounded-full hover:bg-bg-glass text-text-secondary hover:text-text-primary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <Upload className="w-10 h-10 text-text-secondary mx-auto mb-3" />
            <p className="text-text-primary font-medium text-sm">
              Drop your holdings file here
            </p>
            <p className="text-text-secondary text-xs mt-1">
              or <span className="text-blue-400 font-medium">click to browse</span> · accepts .xlsx or .csv
            </p>

            {/* Template download */}
            <a
              href="/holdings-template.xlsx"
              download="holdings-template.xlsx"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 mt-4 text-xs text-text-secondary hover:text-text-primary transition-colors group"
            >
              <Download className="w-3.5 h-3.5 group-hover:text-blue-400 transition-colors" />
              Download template
            </a>
          </>
        )}
      </div>

      {/* Column hint */}
      {!selected && (
        <p className="text-xs text-text-secondary px-1">
          Required columns: <span className="font-mono text-text-primary">ticker</span>,{' '}
          <span className="font-mono text-text-primary">qty</span>,{' '}
          <span className="font-mono text-text-primary">avg_cost</span>
          {' '}· Optional: <span className="font-mono text-text-primary">market</span> (india or us, defaults to india)
        </p>
      )}

      {/* Use default button */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border-subtle" />
        <span className="text-xs text-text-secondary">or</span>
        <div className="flex-1 h-px bg-border-subtle" />
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onUseDefault}
        className={cn(
          'w-full text-center text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors py-1',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline',
        )}
      >
        Don't have a file? Run analysis with our default tech portfolio →
      </button>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidFile(file: File): boolean {
  return (
    file.name.endsWith('.xlsx') ||
    file.name.endsWith('.csv') ||
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.type === 'text/csv'
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// React import for JSX
import React from 'react'
