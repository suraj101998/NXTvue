import React, { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { ReportTable } from '@/components/charts/ChartContainer'
import { useAnalysis } from '@/hooks/useAnalysis'
import {
  FileText,
  RefreshCw,
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react'

export interface AnalysisSection {
  title: string
  content: string
}

export interface DynamicReport {
  symbol: string
  name: string
  subtitle: string
  analysisDoc: string
  pdfUrl?: string
  judgementTag: string
  judgementText: string
  executiveSummary: { label: string; text: string }[]
  summaryNote: string
  sections: AnalysisSection[]
  full_text?: string
}

export function AnalysisPage() {
  const { ticker: tickerParam } = useParams<{ ticker?: string }>()
  const [searchParams, setSearchParams] = useSearchParams()

  // Dynamic parameters from route or query — zero hardcoded ticker lists
  const rawTicker = (searchParams.get('ticker') || tickerParam || 'VRT').trim()
  const currentTicker = (rawTicker.includes(':') ? rawTicker.split(':')[0] : rawTicker).toUpperCase()
  const currentMarket = (searchParams.get('market') || (rawTicker.includes(':') ? rawTicker.split(':')[1] : 'india')).toLowerCase()
  const shouldGenerateOnLoad = searchParams.get('generate') === 'true'

  // Dynamic Report State
  const [report, setReport] = useState<DynamicReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // SSE Report Generator Hook
  const { status, message, progress, error: sseError, run: runGenerator, reset: resetGenerator } = useAnalysis()

  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const leftColRef = useRef<HTMLDivElement>(null)

  // Background Video State
  const videoRef = useRef<HTMLVideoElement>(null)
  const isSeeking = useRef(false)
  const targetTime = useRef(0)

  // Fetch or Generate Report Effect
  useEffect(() => {
    let isCancelled = false

    async function loadStockReport() {
      if (shouldGenerateOnLoad) {
        // Trigger live institutional generation
        setLoading(false)
        runGenerator(currentTicker, currentMarket, 2027)
        return
      }

      setLoading(true)
      setFetchError(null)

      try {
        const res = await fetch(`/api/v1/analysis/${encodeURIComponent(currentTicker)}`)
        if (isCancelled) return

        if (res.ok) {
          const data: DynamicReport = await res.json()
          setReport(data)
          setLoading(false)
          // Initialize A.R.I.A chat greeting
          setChatMessages([
            {
              role: 'model',
              text: `Hello. I am A.R.I.A. I have analyzed the dynamic 2027 institutional report for ${data.name} (${data.symbol}). How can I assist you with this research today?`,
            },
          ])
        } else if (res.status === 404) {
          // Report has not been generated yet
          setReport(null)
          setLoading(false)
        } else {
          const errData = await res.json().catch(() => ({}))
          setFetchError(errData.detail || `Failed to retrieve report for ${currentTicker}`)
          setLoading(false)
        }
      } catch (err: any) {
        if (!isCancelled) {
          setFetchError(err.message || 'Network error while retrieving report')
          setLoading(false)
        }
      }
    }

    loadStockReport()

    return () => {
      isCancelled = true
    }
  }, [currentTicker, currentMarket, shouldGenerateOnLoad])

  // Handle SSE completion: when live generation finishes, fetch the parsed report
  useEffect(() => {
    if (status === 'complete') {
      // Remove generate=true from URL query
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('generate')
      setSearchParams(newParams, { replace: true })

      // Fetch the newly generated PDF data from server
      fetch(`/api/v1/analysis/${encodeURIComponent(currentTicker)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: DynamicReport | null) => {
          if (data) {
            setReport(data)
            setChatMessages([
              {
                role: 'model',
                text: `Institutional analysis for ${data.name} (${data.symbol}) is now ready. I am standing by for any queries regarding valuation, business moat, or technical entry triggers.`,
              },
            ])
          }
        })
        .catch(console.error)
    }
  }, [status, currentTicker])

  const handleStartGeneration = () => {
    setFetchError(null)
    resetGenerator()
    runGenerator(currentTicker, currentMarket, 2027)
  }

  // Mouse tracking mapped to video timeline
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!videoRef.current || isNaN(videoRef.current.duration)) return
      if (isChatOpen) return

      const xPercentage = e.clientX / window.innerWidth
      targetTime.current = Math.max(0, Math.min(videoRef.current.duration, xPercentage * videoRef.current.duration))

      if (!isSeeking.current) {
        isSeeking.current = true
        videoRef.current.currentTime = targetTime.current
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [isChatOpen])

  // Scrub when chat opens
  useEffect(() => {
    if (!videoRef.current || isNaN(videoRef.current.duration)) return

    if (isChatOpen) {
      targetTime.current = videoRef.current.duration * 0.85
      if (!isSeeking.current) {
        isSeeking.current = true
        videoRef.current.currentTime = targetTime.current
      }
    }
  }, [isChatOpen])

  const handleSeeked = () => {
    if (!videoRef.current) return
    if (Math.abs(videoRef.current.currentTime - targetTime.current) > 0.05) {
      videoRef.current.currentTime = targetTime.current
    } else {
      isSeeking.current = false
    }
  }

  // A.R.I.A Copilot Chat
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!chatInput.trim() || isTyping) return

    const userMsg = chatInput.trim()
    setChatInput('')
    const newHistory = [...chatMessages, { role: 'user' as const, text: userMsg }]
    setChatMessages(newHistory)
    setIsTyping(true)

    try {
      const response = await fetch('/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newHistory.map((m) => ({
            role: m.role === 'model' ? 'assistant' : 'user',
            content: m.text,
          })),
          context: {
            symbol: report?.symbol || currentTicker,
            name: report?.name || currentTicker,
            judgement: report?.judgementTag,
            judgement_text: report?.judgementText,
            summary: report?.summaryNote,
          },
        }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.reply) {
          setChatMessages((prev) => [...prev, { role: 'model', text: data.reply }])
          setIsTyping(false)
          return
        }
      }
    } catch (err) {
      console.warn('Backend copilot error, falling back to dynamic analyst response:', err)
    }

    // Dynamic contextual fallback
    await new Promise((resolve) => setTimeout(resolve, 500))
    const fallbackText = report
      ? `Regarding ${report.name} (${report.symbol}): Classification is "${report.judgementTag}". ${report.judgementText}`
      : `Analyzing ${currentTicker}: Generating real-time investment evaluation.`
    setChatMessages((prev) => [...prev, { role: 'model', text: fallbackText }])
    setIsTyping(false)
  }

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [chatMessages, isTyping])

  // Helper to parse content into tables, bullet lists, or paragraphs
  const renderSectionContent = (content: string) => {
    if (!content) return null

    const rawBlocks = content.split(/\n\s*\n/)

    return rawBlocks.map((block, bIdx) => {
      const trimmed = block.trim()
      if (!trimmed) return null

      const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean)

      // Markdown Table Parser
      const isTable = lines.length >= 2 && lines.every((l) => l.startsWith('|') && l.endsWith('|'))
      if (isTable) {
        const headers = lines[0].slice(1, -1).split('|').map((c) => c.trim())
        const dataLines = lines.slice(1).filter((l) => !l.replace(/[|\s\-:]/g, '') == false)
        const rows = dataLines.map((l) => l.slice(1, -1).split('|').map((c) => c.trim()))
        if (headers.length > 0 && rows.length > 0) {
          return (
            <div key={bIdx} className="my-6 overflow-x-auto">
              <ReportTable headers={headers} rows={rows} />
            </div>
          )
        }
      }

      // Bullet List Parser
      const isList = lines.some((l) => /^[•\-\*]\s+|^\d+\.\s+/.test(l))
      if (isList) {
        return (
          <ul key={bIdx} className="space-y-3 pl-2 my-4 text-slate-700 font-light">
            {lines.map((line, lIdx) => {
              const cleanLine = line.replace(/^[•\-\*]\s+|^\d+\.\s+/, '')
              const colonIdx = cleanLine.indexOf(':')
              if (colonIdx > 0 && colonIdx < 50) {
                const prefix = cleanLine.slice(0, colonIdx)
                const rest = cleanLine.slice(colonIdx + 1)
                return (
                  <li key={lIdx} className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 shrink-0" />
                    <div>
                      <strong className="text-slate-900 font-medium mr-1.5">{prefix}:</strong>
                      <span className="text-slate-600">{rest}</span>
                    </div>
                  </li>
                )
              }
              return (
                <li key={lIdx} className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 shrink-0" />
                  <span className="text-slate-700">{cleanLine}</span>
                </li>
              )
            })}
          </ul>
        )
      }

      // Investor Stance Card Parser (Section 13)
      if (/Existing (?:Holders|Long-Term)|Fresh Investors|Aggressive|Conservative/i.test(trimmed)) {
        return (
          <div key={bIdx} className="my-3 p-4 rounded-xl bg-slate-50 border border-slate-200 border-slate-300 transition-all">
            <p className="text-slate-800 text-sm leading-relaxed">{trimmed}</p>
          </div>
        )
      }

      // Standard formatted paragraph
      return (
        <p key={bIdx} className="text-slate-700 font-light leading-relaxed mb-4 text-[15px] sm:text-[16px]">
          {trimmed}
        </p>
      )
    })
  }

  const isGenerating = status === 'fetching' || status === 'analyzing'

  return (
    <div className="relative bg-slate-50 text-slate-900 w-full font-body selection:bg-blue-100 selection:text-slate-900 min-h-screen">
      {/* Background Interactive AI Video */}
      <video
        ref={videoRef}
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260826_041744_63efcd78-bf7d-4039-99e2-2461e8a61903.mp4"
        className="fixed inset-0 z-0 object-cover w-full h-full pointer-events-none"
        style={{
          objectPosition: '85% center',
          transformOrigin: '80% 50%',
          transform: isChatOpen ? 'scale(0.95) translate(-2%, 6%)' : 'scale(0.85) translate(0%, 0%)',
          transition: 'transform 0.8s cubic-bezier(0.25, 1, 0.5, 1)',
        }}
        muted
        playsInline
        preload="auto"
        onSeeked={handleSeeked}
      />

      {/* Two-Column Layout */}
      <div className="relative z-10 flex flex-col md:flex-row w-full min-h-screen">
        {/* Left Column — Content Container */}
        <div
          ref={leftColRef}
          className="order-2 md:order-1 w-full md:w-[60%] lg:w-[55%] pointer-events-auto bg-white/90 md:bg-white/80 backdrop-blur-2xl border-t md:border-t-0 md:border-r border-slate-200 pt-6 pb-10 px-6 sm:px-10 md:px-14 shadow-xl min-h-screen"
        >
          <div className="max-w-4xl mx-auto">
            {/* Top Navigation & Action Row */}
            <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
              <Link
                to="/portfolio?tab=watchlist"
                className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Watchlist
              </Link>

              <div className="flex items-center gap-2 flex-wrap">
                {report && (
                  <>
                    <a
                      href={report.pdfUrl || `/api/v1/reports/${report.symbol}.pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold border border-emerald-200 transition-all cursor-pointer shadow-sm active:scale-95"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      View Official PDF
                    </a>

                    <button
                      onClick={handleStartGeneration}
                      disabled={isGenerating}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold border border-slate-300 transition-all cursor-pointer shadow-sm active:scale-95"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin text-blue-600' : ''}`} />
                      Regenerate
                    </button>
                  </>
                )}

                <Link
                  to="/analysis/history"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-all shadow-sm"
                >
                  <FileText className="w-3.5 h-3.5" />
                  All Reports
                </Link>
              </div>
            </div>

            {/* LIVE GENERATION PROGRESS BANNER */}
            {isGenerating && (
              <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-br from-blue-50 via-white to-indigo-50 border border-blue-200 shadow-lg backdrop-blur-xl mb-10 relative overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

                <div className="flex items-center gap-4 mb-4 relative z-10">
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 border border-blue-200 flex items-center justify-center">
                    <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-heading font-bold text-xl text-slate-900">Generating AI Institutional Report</h3>
                      <span className="text-[10px] uppercase font-mono tracking-widest text-blue-700 bg-blue-100 px-2.5 py-0.5 rounded-full border border-blue-200">
                        {currentTicker} • {currentMarket.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Synthesizing multi-year financial statements, moat durability, and technical signals
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-2 relative z-10 mt-6">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-blue-600">{message || 'Processing financial metrics…'}</span>
                    <span className="text-slate-700 font-bold">{progress}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 transition-all duration-500 rounded-full"
                      style={{ width: `${Math.max(progress, 8)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ERROR DISPLAY */}
            {!isGenerating && (fetchError || sseError) && (
              <div className="p-6 rounded-2xl bg-red-50 border border-red-200 mb-8 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-red-600 text-sm">Analysis Request Encountered an Issue</h4>
                  <p className="text-xs text-red-700 mt-1">{fetchError || sseError?.userMessage}</p>
                  <button
                    onClick={handleStartGeneration}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium border border-red-200 transition-all cursor-pointer"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}

            {/* REPORT NOT FOUND / NOT GENERATED YET STATE */}
            {!loading && !report && !isGenerating && (
              <div className="p-8 md:p-12 rounded-3xl bg-white border border-slate-200 text-center relative overflow-hidden my-12">
                <h2 className="text-2xl md:text-3xl font-heading font-bold text-slate-900 mb-2">
                  No Report Found for {currentTicker}
                </h2>
                <p className="text-slate-600 text-sm max-w-md mx-auto mb-8 leading-relaxed">
                  The institutional deep-dive memorandum for {currentTicker} has not yet been generated. Click below to
                  generate the full 13-section analysis with Bob AI and market data.
                </p>
                <button
                  onClick={handleStartGeneration}
                  className="inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  Generate AI Report for {currentTicker}
                </button>
              </div>
            )}

            {/* INITIAL SKELETON LOADING STATE */}
            {loading && !report && (
              <div className="space-y-6 my-12 animate-pulse">
                <div className="h-8 w-48 bg-slate-100 rounded-lg" />
                <div className="h-16 w-3/4 bg-slate-100 rounded-xl" />
                <div className="h-32 w-full bg-slate-50 rounded-2xl" />
                <div className="h-48 w-full bg-slate-50 rounded-2xl" />
              </div>
            )}

            {/* DYNAMIC REPORT DISPLAY */}
            {report && (
              <div className="animate-in fade-in duration-500">
                {/* Title & Header */}
                <div className="mb-8">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-slate-100 border border-slate-300 backdrop-blur-sm mb-4">
                    <FileText className="w-3.5 h-3.5 text-slate-700" />
                    <span className="text-xs font-mono tracking-wider text-slate-800 uppercase">
                      {report.analysisDoc}
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-1" />
                  </div>

                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold text-slate-900 tracking-tight leading-tight">
                    {report.name} ({report.symbol}): <br className="hidden sm:block" />
                    <span className="text-blue-600 font-normal">{report.subtitle}</span>
                  </h1>
                </div>

                {/* My Judgement Card */}
                <div className="p-6 md:p-8 rounded-3xl bg-white border border-slate-200 mb-10 shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldAlert className="w-4 h-4 text-blue-600" />
                    <h3 className="text-xs uppercase tracking-widest text-slate-600 font-heading font-semibold">
                      My Judgement
                    </h3>
                  </div>
                  <p className="text-lg md:text-xl text-slate-900 leading-relaxed font-light">
                    {report.judgementText}
                  </p>
                  <div className="mt-4 pt-4 border-t border-slate-200 flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-slate-500 uppercase tracking-wider font-mono">Classification:</span>
                    <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full shadow-sm">
                      {report.judgementTag}
                    </span>
                  </div>
                </div>

                {/* Executive Summary */}
                {report.executiveSummary && report.executiveSummary.length > 0 && (
                  <div className="space-y-4 mb-12">
                    <h3 className="text-sm uppercase tracking-wider text-slate-500 font-heading font-semibold">
                      Executive Summary
                    </h3>
                    <div className="grid grid-cols-1 gap-3">
                      {report.executiveSummary.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all"
                        >
                          <strong className="text-slate-900 font-medium font-heading block mb-1 text-sm text-blue-600">
                            {item.label}
                          </strong>
                          <p className="text-slate-700 font-light text-sm leading-relaxed">{item.text}</p>
                        </div>
                      ))}
                    </div>

                    {report.summaryNote && (
                      <p className="text-xs text-slate-600 italic pt-2 pl-1 border-l-2 border-blue-400/40">
                        {report.summaryNote}
                      </p>
                    )}
                  </div>
                )}

                {/* Quick Section Jump Bar */}
                {report.sections && report.sections.length > 0 && (
                  <div className="mb-10 pb-4 border-b border-slate-200">
                    <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2 font-mono">Jump to Section:</p>
                    <div className="flex gap-2 overflow-x-auto pb-2 custom-report-scrollbar">
                      {report.sections.map((sec, idx) => (
                        <a
                          key={idx}
                          href={`#sec-${idx}`}
                          className="text-xs px-3 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 whitespace-nowrap transition-colors"
                        >
                          {sec.title.split('.')[0]}. {sec.title.split('.')[1]?.slice(0, 16) || sec.title.slice(0, 16)}…
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Canonical Numbered Sections */}
                <div className="space-y-12">
                  {report.sections &&
                    report.sections.map((sec, idx) => (
                      <section
                        key={idx}
                        id={`sec-${idx}`}
                        className="scroll-mt-24 p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-xl hover:border-slate-200 transition-all"
                      >
                        <h2 className="text-xl sm:text-2xl font-heading font-bold text-slate-900 border-b border-slate-200 pb-3 mb-6 flex items-center justify-between">
                          <span>{sec.title}</span>
                          <span className="text-xs font-mono text-slate-400 font-normal">#{idx + 1}</span>
                        </h2>

                        <div className="text-slate-700 font-light leading-relaxed">
                          {renderSectionContent(sec.content)}
                        </div>
                      </section>
                    ))}
                </div>

                {/* Disclaimer */}
                <p className="text-slate-500 text-xs text-center border-t border-slate-200 pt-8 mt-16 pb-8 uppercase tracking-widest font-heading">
                  Disclaimer: This analysis is for educational and institutional research purposes based on historical and
                  market data. It does not constitute investment advice. Generated dynamically by NXTvue Institutional
                  Engine for {report.symbol}.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column Spacer for Video Viewport */}
        <div className="hidden md:block order-1 md:order-2 md:w-[40%] lg:w-[45%] pointer-events-none shrink-0 md:sticky md:top-0 md:h-[calc(100vh-60px)]" />

        {/* A.R.I.A Floating Chat Window */}
        <div className="fixed bottom-6 right-6 md:bottom-8 md:right-10 pointer-events-auto z-[400] flex flex-col items-end">
          {/* Chat Modal */}
          <div
            className={`w-[calc(100vw-3rem)] sm:w-[380px] h-[480px] bg-white border border-slate-200 rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 origin-bottom-right ${
              isChatOpen
                ? 'opacity-100 scale-100 translate-y-0 mb-4'
                : 'opacity-0 scale-95 translate-y-4 pointer-events-none absolute bottom-full mb-4'
            }`}
          >
            {/* Chat Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 border border-blue-200">
                  <span className="text-[15px] select-none text-blue-600 absolute">✳︎</span>
                  {isTyping && (
                    <div className="absolute inset-0 rounded-full border border-blue-400 animate-ping opacity-30" />
                  )}
                </div>
                <div>
                  <h4 className="font-heading font-bold text-sm text-slate-900">A.R.I.A</h4>
                  <p className="text-[10px] text-blue-600/80 uppercase tracking-widest font-mono">
                    {report ? `${report.symbol} Analyst` : 'Financial Analyst'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                className="text-slate-500 hover:text-slate-900 transition-colors p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Chat Messages */}
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 custom-report-scrollbar flex flex-col">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-sm'
                        : 'bg-slate-100 text-slate-800 border border-slate-200 rounded-bl-sm'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex w-full justify-start">
                  <div className="bg-slate-100 border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5 items-center">
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-200 bg-slate-50">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={`Ask A.R.I.A about ${report?.symbol || currentTicker}…`}
                  className="w-full bg-slate-50 border border-slate-200 rounded-full pl-4 pr-12 py-2.5 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-400/50 focus:bg-slate-100 transition-all"
                  disabled={isTyping}
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isTyping}
                  className="absolute right-1.5 w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 transition-transform cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>

          {/* Chat FAB */}
          <button
            onClick={() => setIsChatOpen(true)}
            className={`w-14 h-14 rounded-full flex items-center justify-center bg-white border border-blue-200 text-slate-900 shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 cursor-pointer ${
              isChatOpen ? 'scale-0 opacity-0 pointer-events-none absolute' : 'scale-100 opacity-100'
            }`}
          >
            <span className="text-[26px] select-none mt-0.5 text-blue-600">✳︎</span>
          </button>
        </div>
      </div>
    </div>
  )
}
