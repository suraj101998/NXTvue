import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Shield, Globe, Lock, Zap, Building2, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/utils/cn'

const BG_VIDEO =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260511_131941_d136af49-e243-493a-be14-6ff3f24e09e6.mp4'

type BillingCycle = 'Monthly' | 'Quarterly' | 'Annual'

interface BoomerangProps {
  src: string
  className?: string
}

function BoomerangVideoBg({ src, className }: BoomerangProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const displayCanvasRef = useRef<HTMLCanvasElement>(null)
  const [framesReady, setFramesReady] = useState(false)
  const framesRef = useRef<HTMLCanvasElement[]>([])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const frames: HTMLCanvasElement[] = []
    let capturing = true
    let lastTime = -1
    const MAX_WIDTH = 960

    const captureFrame = () => {
      if (!capturing || video.readyState < 2) return
      if (video.currentTime === lastTime) return
      lastTime = video.currentTime

      const vw = video.videoWidth
      const vh = video.videoHeight
      if (!vw || !vh) return

      const scale = Math.min(1, MAX_WIDTH / vw)
      const w = Math.round(vw * scale)
      const h = Math.round(vh * scale)

      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(video, 0, 0, w, h)
      frames.push(canvas)
    }

    type VFCVideo = HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number
    }
    const vfcVideo = video as VFCVideo
    const hasVFC = typeof vfcVideo.requestVideoFrameCallback === 'function'

    let rafId = 0
    const rafLoop = () => {
      captureFrame()
      if (capturing) rafId = requestAnimationFrame(rafLoop)
    }

    const vfcLoop = () => {
      captureFrame()
      if (capturing && vfcVideo.requestVideoFrameCallback) {
        vfcVideo.requestVideoFrameCallback(vfcLoop)
      }
    }

    const onEnded = () => {
      capturing = false
      if (frames.length > 0) {
        framesRef.current = frames
        setFramesReady(true)
      }
    }

    const onLoaded = () => {
      video.play().catch(() => {})
      if (hasVFC) {
        vfcVideo.requestVideoFrameCallback!(vfcLoop)
      } else {
        rafId = requestAnimationFrame(rafLoop)
      }
    }

    video.addEventListener('loadedmetadata', onLoaded)
    video.addEventListener('ended', onEnded)
    if (video.readyState >= 1) onLoaded()

    return () => {
      capturing = false
      cancelAnimationFrame(rafId)
      video.removeEventListener('loadedmetadata', onLoaded)
      video.removeEventListener('ended', onEnded)
    }
  }, [src])

  useEffect(() => {
    if (!framesReady) return
    const canvas = displayCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const frames = framesRef.current
    if (frames.length === 0) return

    const first = frames[0]
    canvas.width = first.width
    canvas.height = first.height

    let index = 0
    let direction = 1
    let last = performance.now()
    const interval = 1000 / 30
    let rafId = 0

    const render = (now: number) => {
      if (now - last >= interval) {
        last = now
        ctx.drawImage(frames[index], 0, 0)
        index += direction
        if (index >= frames.length - 1) {
          index = frames.length - 1
          direction = -1
        } else if (index <= 0) {
          index = 0
          direction = 1
        }
      }
      rafId = requestAnimationFrame(render)
    }
    rafId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(rafId)
  }, [framesReady])

  return (
    <div className={className ?? 'absolute inset-0 w-full h-full'}>
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-cover"
        style={{ display: framesReady ? 'none' : 'block' }}
        muted
        playsInline
        preload="auto"
        crossOrigin="anonymous"
      />
      <canvas
        ref={displayCanvasRef}
        className="w-full h-full object-cover"
        style={{ display: framesReady ? 'block' : 'none' }}
      />
    </div>
  )
}

const plans = [
  {
    name: 'Starter',
    icon: Zap,
    description: 'Essential equity tracking & fundamental portfolio insights.',
    prices: { Monthly: 999, Quarterly: 899, Annual: 699 },
    accentColor: 'from-slate-500/10 to-slate-400/5',
    borderColor: 'border-slate-200',
    glowColor: '',
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-600',
    features: [
      'Up to 10 stock & ETF holdings',
      'Basic risk metrics (Volatility, Drawdown)',
      'Quarterly valuation summaries',
      'Daily end-of-day price updates',
      'Community & email support',
    ],
    popular: false,
    cta: 'Start Free Trial',
  },
  {
    name: 'Professional',
    icon: Sparkles,
    description: 'Advanced quantitative orchestration & AI research for serious investors.',
    prices: { Monthly: 2999, Quarterly: 2699, Annual: 1999 },
    accentColor: 'from-blue-600/15 via-indigo-600/10 to-violet-600/5',
    borderColor: 'border-blue-400/50',
    glowColor: 'shadow-[0_0_40px_rgba(59,130,246,0.18),0_0_80px_rgba(99,102,241,0.10)]',
    iconBg: 'bg-blue-600',
    iconColor: 'text-white',
    features: [
      'Unlimited holdings & multi-asset portfolios',
      'Full quant analyzer (Sharpe, Sortino, VaR, CVaR)',
      'NXTvue A.R.I.A Interactive AI Analyst',
      'Correlation matrix & factor stress testing',
      'Real-time transaction & dividend sync',
      'Priority analyst email & chat support',
    ],
    popular: true,
    cta: 'Get Started',
  },
  {
    name: 'Institutional',
    icon: Building2,
    description: 'Unrestricted scale, custom factor models & API data pipeline access.',
    prices: { Monthly: 14999, Quarterly: 12999, Annual: 9999 },
    accentColor: 'from-amber-500/10 via-orange-500/5 to-transparent',
    borderColor: 'border-amber-400/40',
    glowColor: 'shadow-[0_0_32px_rgba(245,158,11,0.12),0_0_60px_rgba(234,88,12,0.08)]',
    iconBg: 'bg-gradient-to-br from-amber-500 to-orange-600',
    iconColor: 'text-white',
    features: [
      'Multi-seat workspace (up to 10 analysts)',
      'Custom factor regression & attribution',
      'Alternative & macro dataset connectors',
      'Unlimited High-Frequency API access',
      'Dedicated quantitative success manager',
      '99.99% Enterprise SLA guarantee',
    ],
    popular: false,
    cta: 'Contact Sales',
  },
]

const comparisonCategories = [
  {
    category: 'Portfolio Management',
    features: [
      { name: 'Holdings Tracking', starter: '10', pro: 'Unlimited', inst: 'Unlimited' },
      { name: 'Multi-Portfolio Support', starter: '1', pro: 'Unlimited', inst: 'Unlimited' },
      { name: 'Transaction Import', starter: 'Manual CSV', pro: 'Broker Sync + Auto', inst: 'Broker Sync + REST API' },
      { name: 'Tax & Capital Gains', starter: 'Basic Annual', pro: 'Real-time FIFO/LIFO', inst: 'Custom Multi-jurisdiction' },
    ],
  },
  {
    category: 'Analytics & Quantitative Analyzer',
    features: [
      { name: 'Basic Metrics (Returns, CAGR, P&L)', starter: '✓', pro: '✓', inst: '✓' },
      { name: 'Risk Analytics (Beta, Volatility, Max DD)', starter: 'Basic', pro: 'Advanced Multi-factor', inst: 'Institutional Grade' },
      { name: 'Quant Analyzer (Sharpe, Sortino, VaR, CVaR)', starter: '✗', pro: '✓', inst: '✓' },
      { name: 'Correlation Matrix & Overlap', starter: '✗', pro: '✓', inst: '✓ + Custom Factor' },
      { name: 'Factor Attribution (Fama-French)', starter: '✗', pro: '✗', inst: '✓' },
    ],
  },
  {
    category: 'AI Research & Intelligence',
    features: [
      { name: 'A.R.I.A AI Analyst', starter: '✗', pro: '✓ (Unlimited Queries)', inst: '✓ (Custom Fine-tuned)' },
      { name: 'Scenario Analysis & Stress Testing', starter: '✗', pro: '✓', inst: '✓ + Tail-risk Sim' },
      { name: 'Research Frequency', starter: 'Monthly', pro: 'Real-time Weekly', inst: 'Continuous Stream' },
    ],
  },
  {
    category: 'Support & Infrastructure',
    features: [
      { name: 'Support Level', starter: 'Email (48h)', pro: 'Priority Email & Chat', inst: '24/7 Dedicated Quant Team' },
      { name: 'API Access', starter: '✗', pro: '1,000 calls / mo', inst: 'Unlimited' },
      { name: 'Team Seats', starter: '1 User', pro: '1 User', inst: 'Up to 10 Seats' },
      { name: 'SSO & Role-Based Access', starter: '✗', pro: '✗', inst: '✓' },
      { name: 'Uptime SLA', starter: '99.5%', pro: '99.9%', inst: '99.99%' },
    ],
  },
]

export function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('Annual')

  return (
    <div className="relative min-h-screen bg-[#f4f6fa] text-slate-900 overflow-y-auto selection:bg-blue-200 selection:text-slate-900">
      {/* Boomerang Video Background */}
      <BoomerangVideoBg
        src={BG_VIDEO}
        className="fixed inset-0 w-full h-full opacity-10 mix-blend-multiply pointer-events-none z-0"
      />

      {/* Gradient Overlay */}
      <div className="fixed inset-0 bg-gradient-to-b from-white/80 via-white/50 to-[#f4f6fa] pointer-events-none z-0" />

      <main className="relative z-10 w-full min-h-screen overflow-x-hidden py-16 px-4 sm:px-8 lg:px-12">
        <div className="w-full max-w-6xl mx-auto flex flex-col items-center">

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="w-full mb-10 flex flex-col items-center text-center"
          >
            <div className="inline-flex items-center gap-2 mb-5 px-4 py-1.5 rounded-full bg-slate-50 border border-slate-200 shadow-inner">
              <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-widest font-heading">
                NXTvue™ Pricing
              </span>
            </div>
            <h1 className="font-heading font-semibold text-3xl sm:text-4xl lg:text-5xl text-slate-900 mb-4 tracking-tight leading-tight">
              Scale your{' '}
              <span className="text-blue-600">investment intelligence.</span>
            </h1>
            <p className="max-w-2xl text-slate-500 text-sm sm:text-base leading-relaxed font-light mx-auto">
              Transparent, predictable pricing for serious investors and quantitative analysts.
            </p>
          </motion.div>

          {/* ── Billing Cycle Toggle ─────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08 }}
            className="mb-12"
          >
            <div className="inline-flex items-center bg-white rounded-2xl border border-slate-200 p-1 shadow-sm gap-1">
              {(['Monthly', 'Quarterly', 'Annual'] as const).map((cycle) => (
                <button
                  key={cycle}
                  type="button"
                  onClick={() => setBillingCycle(cycle)}
                  className={cn(
                    'relative flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap select-none',
                    billingCycle === cycle
                      ? 'bg-slate-900 text-white shadow-sm font-semibold'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50',
                  )}
                >
                  <span>{cycle}</span>
                  {cycle !== 'Monthly' && (
                    <span
                      className={cn(
                        'text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none',
                        billingCycle === cycle
                          ? 'bg-blue-500 text-white'
                          : 'bg-blue-100 text-blue-700',
                      )}
                    >
                      -{cycle === 'Annual' ? '30' : '15'}%
                    </span>
                  )}
                </button>
              ))}
            </div>
          </motion.div>

          {/* ── Plan Cards ───────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.15 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full mb-20"
          >
            {plans.map((plan) => {
              const PlanIcon = plan.icon
              return (
                <div
                  key={plan.name}
                  className={cn(
                    'relative flex flex-col rounded-2xl border transition-all duration-300',
                    'bg-gradient-to-br',
                    plan.accentColor,
                    plan.borderColor,
                    plan.popular
                      ? ['bg-white', plan.glowColor, 'hover:scale-[1.01]'].join(' ')
                      : ['bg-white/80 backdrop-blur-sm hover:shadow-md'].join(' '),
                  )}
                >
                  {/* Popular badge */}
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                      <span className="inline-flex items-center gap-1 bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-lg font-heading">
                        <Sparkles className="w-2.5 h-2.5" />
                        Most Popular
                      </span>
                    </div>
                  )}

                  <div className="p-6 flex flex-col flex-1">
                    {/* Plan icon + name */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', plan.iconBg)}>
                        <PlanIcon className={cn('w-4.5 h-4.5', plan.iconColor)} style={{ width: 18, height: 18 }} />
                      </div>
                      <h3 className="text-base font-heading font-semibold text-slate-900">{plan.name}</h3>
                    </div>

                    {/* Description */}
                    <p className="text-slate-500 text-xs leading-relaxed mb-5 font-light">{plan.description}</p>

                    {/* Price */}
                    <div className="flex items-baseline gap-1 mb-5">
                      <span className="text-3xl font-heading font-semibold text-slate-900 tracking-tight">
                        ₹{plan.prices[billingCycle].toLocaleString()}
                      </span>
                      <span className="text-slate-400 text-xs">/mo</span>
                    </div>

                    {/* CTA */}
                    <Link
                      to="/login"
                      className={cn(
                        'w-full py-2.5 rounded-xl text-sm font-semibold text-center transition-all mb-5 inline-flex items-center justify-center',
                        plan.popular
                          ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-blue-500/30'
                          : plan.name === 'Institutional'
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-90 shadow-sm'
                          : 'bg-slate-900 text-white hover:bg-slate-800',
                      )}
                    >
                      {plan.cta}
                    </Link>

                    {/* Feature list */}
                    <div className="flex flex-col gap-2.5 pt-4 border-t border-slate-100">
                      {plan.features.map((feature, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <div
                            className={cn(
                              'flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center mt-0.5',
                              plan.popular
                                ? 'bg-blue-100 border border-blue-200'
                                : plan.name === 'Institutional'
                                ? 'bg-amber-100 border border-amber-200'
                                : 'bg-slate-100 border border-slate-200',
                            )}
                          >
                            <Check
                              className={cn(
                                'w-2.5 h-2.5',
                                plan.popular
                                  ? 'text-blue-600'
                                  : plan.name === 'Institutional'
                                  ? 'text-amber-600'
                                  : 'text-slate-600',
                              )}
                            />
                          </div>
                          <span className="text-xs text-slate-600 leading-relaxed">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </motion.div>

          {/* ── Full Feature Comparison ──────────────────────────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.3 }}
            className="w-full mb-16"
          >
            <h2 className="font-heading text-2xl font-semibold text-slate-900 text-center mb-8">
              Compare All Features
            </h2>
            <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-sm">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="p-4 font-heading font-medium text-slate-600 tracking-wide text-xs uppercase">Feature</th>
                    {plans.map((plan) => (
                      <th
                        key={plan.name}
                        className={cn(
                          'p-4 font-heading font-semibold text-center text-xs uppercase tracking-wide',
                          plan.popular ? 'text-blue-600' : 'text-slate-700',
                        )}
                      >
                        {plan.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonCategories.map((cat) => (
                    <React.Fragment key={cat.category}>
                      <tr className="bg-slate-50/70 border-t border-b border-slate-200">
                        <td
                          colSpan={4}
                          className="px-4 py-2.5 font-heading font-semibold text-slate-400 text-[11px] uppercase tracking-widest"
                        >
                          {cat.category}
                        </td>
                      </tr>
                      {cat.features.map((f, idx) => (
                        <tr
                          key={f.name}
                          className={cn(
                            'border-b border-slate-100 hover:bg-slate-50/60 transition-colors',
                            idx === cat.features.length - 1 ? 'border-b-0' : '',
                          )}
                        >
                          <td className="px-4 py-3 text-slate-600 text-xs">{f.name}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs text-center">{f.starter}</td>
                          <td className="px-4 py-3 text-blue-700 text-xs font-medium text-center">{f.pro}</td>
                          <td className="px-4 py-3 text-slate-600 text-xs text-center">{f.inst}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.section>

          {/* ── Enterprise Banner ─────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.4 }}
            className="w-full mb-12"
          >
            <div className="w-full p-8 sm:p-10 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700 shadow-xl flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
              <div className="flex-1">
                <h3 className="font-heading text-xl sm:text-2xl font-semibold text-white mb-2">
                  Need a Custom Quantitative Solution?
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed font-light">
                  Managing a large fund or family office? Tailored data pipelines, on-premise deployments, and co-development partnerships.
                </p>
              </div>
              <Link
                to="/login"
                className="flex-shrink-0 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white text-slate-900 font-heading font-semibold text-sm hover:bg-blue-50 shadow transition-all whitespace-nowrap"
              >
                Contact Sales
              </Link>
            </div>
          </motion.div>

          {/* ── Value Guarantees ──────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.5 }}
            className="w-full grid grid-cols-1 sm:grid-cols-3 gap-4"
          >
            {[
              {
                icon: Shield,
                title: '30-Day Money Back',
                desc: 'Not satisfied? Full refund within 30 days, no questions asked.',
              },
              {
                icon: Lock,
                title: 'Bank-Grade Security',
                desc: 'SOC 2 Type II certified. All data encrypted at rest and in transit.',
              },
              {
                icon: Globe,
                title: 'Global Markets Coverage',
                desc: 'Indian & US equities, ETFs, mutual funds, macro signals, and commodities.',
              },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-heading text-sm font-semibold text-slate-900 mb-1">{item.title}</h4>
                  <p className="text-slate-500 text-xs leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </motion.div>

        </div>
      </main>
    </div>
  )
}
