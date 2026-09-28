import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Sparkles, Shield, Globe, Lock, ArrowRight } from 'lucide-react'
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
    description: 'For essential equity tracking and fundamental portfolio insights.',
    prices: { Monthly: 999, Quarterly: 899, Annual: 699 },
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
    description: 'Advanced quantitative orchestration & AI research for serious investors.',
    prices: { Monthly: 2999, Quarterly: 2699, Annual: 1999 },
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
    description: 'Unrestricted scale, custom factor models & API data pipeline access.',
    prices: { Monthly: 14999, Quarterly: 12999, Annual: 9999 },
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
    <div className="relative min-h-screen bg-[#0a0f1a] text-white overflow-y-auto selection:bg-blue-400/30 selection:text-white">
      {/* Boomerang Video Background */}
      <BoomerangVideoBg
        src={BG_VIDEO}
        className="fixed inset-0 w-full h-full opacity-40 mix-blend-screen pointer-events-none z-0"
      />

      {/* Gradient Overlay for high readability */}
      <div className="fixed inset-0 bg-gradient-to-b from-[#0a0f1a]/80 via-[#0a0f1a]/60 to-[#0a0f1a] pointer-events-none z-0" />

      <main className="relative z-10 w-full min-h-screen overflow-x-hidden py-20 px-6 sm:px-8 lg:px-12">
        <div className="w-full max-w-7xl mx-auto flex flex-col items-center">
          
          {/* Header Section */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full mb-12 flex flex-col items-center text-center"
          >
            <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm shadow-inner">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-semibold text-white uppercase tracking-wider font-heading">
                NXTvue<sup className="text-[10px]">™</sup> Pricing
              </span>
            </div>
            <h1 className="w-full font-heading font-normal text-4xl sm:text-5xl lg:text-6xl text-white mb-6 tracking-tight leading-tight">
              Scale your <span className="text-blue-400">investment intelligence.</span>
            </h1>
            <p className="w-full max-w-3xl text-white/70 text-base sm:text-lg leading-relaxed font-light mx-auto">
              Transparent, predictable pricing designed for serious investors and quantitative analysts. Choose the plan that fits your strategy.
            </p>
          </motion.div>

          {/* Billing Cycle Toggle */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex bg-black/50 p-1.5 rounded-full border border-white/10 backdrop-blur-xl mb-16 shadow-2xl"
          >
            {(['Monthly', 'Quarterly', 'Annual'] as const).map((cycle) => (
              <button
                key={cycle}
                onClick={() => setBillingCycle(cycle)}
                className={cn(
                  'relative px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 font-heading',
                  billingCycle === cycle
                    ? 'text-[#0a0f1a] bg-white shadow-lg font-semibold'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                )}
              >
                {cycle}
                {cycle !== 'Monthly' && (
                  <span
                    className={cn(
                      'absolute -top-2 -right-2 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md',
                      billingCycle === cycle ? 'bg-blue-500 text-white' : 'bg-blue-500/80 text-white'
                    )}
                  >
                    Save {cycle === 'Annual' ? '30%' : '15%'}
                  </span>
                )}
              </button>
            ))}
          </motion.div>

          {/* Pricing Plan Cards Grid */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-7xl items-stretch mb-24"
          >
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={cn(
                  'relative flex flex-col p-8 sm:p-9 rounded-3xl backdrop-blur-2xl transition-all duration-500',
                  plan.popular
                    ? 'bg-white/10 border-2 border-blue-400 shadow-[0_0_50px_rgba(96,165,250,0.15)] scale-100 md:scale-105 z-10'
                    : 'bg-black/40 border border-white/10 hover:border-white/20 hover:bg-white/[0.04] z-0'
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-blue-400 text-[#0a0f1a] text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wider shadow-lg font-heading">
                    Most Popular
                  </div>
                )}

                {/* Plan Details */}
                <h3 className="text-xl font-heading font-semibold text-white mb-2">{plan.name}</h3>
                <p className="text-white/60 text-sm h-12 mb-6 font-light leading-snug">{plan.description}</p>

                {/* Price Display */}
                <div className="flex items-baseline gap-1.5 mb-8">
                  <span className="text-4xl sm:text-5xl font-normal text-white tracking-tighter font-heading">
                    ₹{plan.prices[billingCycle].toLocaleString()}
                  </span>
                  <span className="text-white/50 text-sm">/ mo</span>
                </div>

                {/* CTA Button */}
                <Link
                  to="/login"
                  className={cn(
                    'w-full py-3.5 rounded-xl font-heading font-semibold text-sm transition-all mb-8 text-center flex items-center justify-center',
                    plan.popular
                      ? 'bg-blue-400 text-[#0a0f1a] hover:bg-white shadow-lg hover:shadow-blue-400/20'
                      : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                  )}
                >
                  {plan.cta}
                </Link>

                {/* Feature Checklist */}
                <div className="flex flex-col gap-3.5 mt-auto pt-4 border-t border-white/5">
                  {plan.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-400/20 flex items-center justify-center mt-0.5 border border-blue-400/30">
                        <Check className="w-3 h-3 text-blue-400" />
                      </div>
                      <span className="text-sm text-white/80 leading-relaxed font-light">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>

          {/* Full Feature Comparison Section */}
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="w-full max-w-7xl mb-24"
          >
            <h2 className="font-heading text-3xl font-semibold text-white text-center mb-12">
              Compare All Features
            </h2>
            <div className="overflow-x-auto border border-white/10 rounded-2xl bg-black/40 backdrop-blur-xl shadow-2xl">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.04]">
                    <th className="p-5 font-heading font-medium text-white/90 tracking-wide">
                      Feature
                    </th>
                    {plans.map((plan) => (
                      <th
                        key={plan.name}
                        className={cn(
                          'p-5 font-heading font-medium text-center tracking-wide',
                          plan.popular ? 'text-blue-400' : 'text-white/90'
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
                      <tr className="bg-white/[0.03] border-t border-b border-white/10">
                        <td
                          colSpan={4}
                          className="px-5 py-3 font-heading font-semibold text-white/50 text-xs uppercase tracking-widest"
                        >
                          {cat.category}
                        </td>
                      </tr>
                      {cat.features.map((f, idx) => (
                        <tr
                          key={f.name}
                          className={cn(
                            'border-b border-white/5 hover:bg-white/[0.03] transition-colors',
                            idx === cat.features.length - 1 ? 'border-b-0' : ''
                          )}
                        >
                          <td className="px-5 py-4 text-white/80 font-light">{f.name}</td>
                          <td className="px-5 py-4 text-white/70 font-light text-center">{f.starter}</td>
                          <td className="px-5 py-4 text-white/90 font-light text-center font-medium bg-white/[0.01]">
                            {f.pro}
                          </td>
                          <td className="px-5 py-4 text-white/70 font-light text-center">{f.inst}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.section>

          {/* Enterprise Custom Solution Banner */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="w-full max-w-7xl mb-20"
          >
            <div className="w-full p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-blue-500/10 via-white/5 to-transparent border border-blue-400/20 backdrop-blur-xl shadow-2xl flex flex-col items-center text-center">
              <h3 className="w-full font-heading text-2xl sm:text-3xl font-semibold text-white mb-4">
                Need a Custom Quantitative Solution?
              </h3>
              <p className="w-full max-w-3xl text-white/70 mb-8 font-light text-base sm:text-lg leading-relaxed mx-auto">
                Managing a large fund or family office? We provide tailored data pipelines, on-premise deployments, and co-development partnerships.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-blue-400 text-[#0a0f1a] font-heading font-semibold text-sm hover:bg-white shadow-lg transition-all"
              >
                Contact Sales
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>

          {/* Value Guarantees */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="w-full max-w-7xl grid grid-cols-1 md:grid-cols-3 gap-6"
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
                className="p-6 rounded-2xl bg-black/30 border border-white/10 text-center backdrop-blur-md"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-400/10 border border-blue-400/20 flex items-center justify-center mx-auto mb-4">
                  <item.icon className="w-6 h-6 text-blue-400" />
                </div>
                <h4 className="font-heading text-lg font-semibold text-white mb-2">{item.title}</h4>
                <p className="text-white/60 text-sm font-light leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </motion.div>

        </div>
      </main>
    </div>
  )
}
