import { Download } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { getReportUrl } from '@/api/analysis'
import { cn } from '@/utils/cn'

export interface ReportViewerProps {
  finalMemo: string
  pdfFilename?: string | null
  className?: string
}

export function ReportViewer({ finalMemo, pdfFilename, className }: ReportViewerProps) {
  const sections = parseMemo(finalMemo)

  return (
    <div className={cn('space-y-1', className)}>
      {/* PDF download bar */}
      {pdfFilename && (
        <div className="flex items-center justify-between glass-card px-6 py-3 mb-4">
          <span className="text-sm text-text-secondary">
            Full report available as PDF
          </span>
          <a
            href={getReportUrl(pdfFilename)}
            download={pdfFilename}
            className="inline-flex"
          >
            <Button variant="secondary" size="sm">
              <Download className="w-4 h-4" />
              Download PDF
            </Button>
          </a>
        </div>
      )}

      {/* Report content */}
      <Card variant="default">
        <CardContent className="p-6 sm:p-8">
          <div className="prose-report space-y-4 text-sm leading-relaxed">
            {sections.map((section, i) => {
              if (section.type === 'h2') {
                return (
                  <h2 key={i} className="text-text-primary font-semibold text-base mt-8 mb-3 first:mt-0 border-b border-border-subtle pb-2">
                    {section.text}
                  </h2>
                )
              }
              if (section.type === 'h3') {
                return (
                  <h3 key={i} className="text-text-primary font-medium text-sm mt-5 mb-2">
                    {section.text}
                  </h3>
                )
              }
              if (section.type === 'table') {
                return (
                  <div key={i} className="overflow-x-auto my-3">
                    <pre className="text-xs font-mono text-text-secondary whitespace-pre bg-bg-tertiary rounded-lg p-4">
                      {section.text}
                    </pre>
                  </div>
                )
              }
              return (
                <p key={i} className="text-text-secondary">
                  {section.text}
                </p>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Memo parser ──────────────────────────────────────────────────────────────

type Section = { type: 'h2' | 'h3' | 'p' | 'table'; text: string }

function parseMemo(memo: string): Section[] {
  const lines = memo.split('\n')
  const sections: Section[] = []
  let tableBuf: string[] = []

  const flushTable = () => {
    if (tableBuf.length > 0) {
      sections.push({ type: 'table', text: tableBuf.join('\n') })
      tableBuf = []
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd()

    if (line.startsWith('## ')) {
      flushTable()
      sections.push({ type: 'h2', text: line.slice(3).trim() })
    } else if (line.startsWith('### ')) {
      flushTable()
      sections.push({ type: 'h3', text: line.slice(4).trim() })
    } else if (line.startsWith('# ')) {
      flushTable()
      sections.push({ type: 'h2', text: line.slice(2).trim() })
    } else if (line.includes('|') && line.trim().startsWith('|')) {
      // Table line — buffer together
      tableBuf.push(line)
    } else {
      flushTable()
      const text = line.trim()
      if (text) {
        sections.push({ type: 'p', text })
      }
    }
  }
  flushTable()

  return sections
}
