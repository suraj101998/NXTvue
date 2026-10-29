// ─── Login Page ────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/auth/AuthContext'
import { cn } from '@/utils/cn'
import { Loader2 } from 'lucide-react'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const { login, loading: authLoading, error: authError } = useAuth()
  const [reducedMotion, setReducedMotion] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formEmail, setFormEmail] = useState('')
  const [formName, setFormName] = useState('')

  const from = (location.state as { from?: Location })?.from?.pathname || '/dashboard'

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const h = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener?.('change', h)
    return () => mq.removeEventListener?.('change', h)
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const play = async () => { try { await video.play() } catch { /* blocked */ } }
    play()
    const onVis = () => { if (document.hidden) video.pause(); else if (!reducedMotion) play() }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [reducedMotion])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await login(formEmail, formName)
      navigate(from, { replace: true })
    } catch (err) {
      // Error is handled by auth context
    } finally {
      setIsLoading(false)
    }
  }, [formEmail, formName, login, navigate, from])

  const handleDevLogin = useCallback(async () => {
    setIsLoading(true)
    try {
      await login('test@example.com', 'Test User', true)
      navigate(from, { replace: true })
    } catch (err) {
      // Error handled by auth context
    } finally {
      setIsLoading(false)
    }
  }, [login, navigate, from])

  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-900 overflow-x-hidden font-sans selection:bg-blue-100 selection:text-slate-900">
      {/* Video background */}
      <video
        ref={videoRef}
        className="fixed inset-0 w-full h-full object-cover z-0 pointer-events-none opacity-[0.12]"
        autoPlay muted loop playsInline preload="auto" aria-hidden="true"
        poster="https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/130837c4-0244-4f37-9c61-8d801d93fd29.jpg"
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260912_104303_0c6d60b2-9353-408e-9449-585108a22fb5.mp4"
        style={{ display: reducedMotion ? 'none' : 'block' }}
      />
      <div className={cn('fixed inset-0 w-full h-full z-0 bg-white', reducedMotion ? 'block' : 'hidden')} />

      {/* Light veil */}
      <div className="fixed inset-0 z-0 pointer-events-none" style={{
        background: 'radial-gradient(90% 70% at 20% 30%, rgba(37,99,235,0.08) 0%, rgba(248,250,252,0.92) 60%, #f8fafc 100%)'
      }} />

      {/* Header — brand only */}
      <header className="fixed top-0 left-0 right-0 z-20 h-20 sm:h-24 flex items-center px-6 sm:px-12 lg:px-16 pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto" aria-label="NXTvue">
          <svg className="w-7 h-5 text-slate-900" viewBox="0 0 23 17" aria-hidden="true">
            <path d="M8.15 0.9 L4.55 0.9 L0.5 9.3 L4.1 9.3 Z" fill="currentColor" />
            <path d="M17.0 0 L13.4 0 L6.15 16.4 L9.75 16.4 Z" fill="currentColor" />
            <path d="M22.9 0 L19.3 0 L15.0 7.6 L18.6 7.6 Z" fill="currentColor" />
            <path d="M22.6 6.9 L19.0 6.9 L14.05 16.4 L17.65 16.4 Z" fill="currentColor" />
          </svg>
          <span
            className="font-heading text-xl sm:text-2xl font-bold tracking-[0.08em] text-slate-900"
          >
            NXTvue
          </span>
        </div>
      </header>

      {/* Main split layout */}
      <main className="relative z-10 min-h-screen flex items-center justify-between px-6 sm:px-12 lg:px-16 xl:px-20 pt-24 pb-24 sm:py-24">
        <div className="w-full max-w-[1400px] mx-auto flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-16">

          {/* Left hero */}
          <div className="w-full lg:flex-1 lg:max-w-[640px] text-left flex flex-col gap-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold uppercase tracking-wider w-fit">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              <span>NXTvue OS 1.0 Live</span>
            </div>

            <h1
              className="font-heading font-bold text-slate-900 tracking-tight leading-[1.08] m-0"
              style={{
                fontSize: 'clamp(2.5rem, 5.5vw, 3.75rem)',
                letterSpacing: '-0.03em',
              }}
            >
              Institutional Intelligence.<br />
              Made Effortless.
            </h1>

            <p className="text-slate-500 text-base sm:text-lg leading-relaxed font-normal m-0 max-w-[46ch]">
              Transform complex financial data into clear, actionable investment intelligence.
              NXTvue combines quantitative finance, risk analytics, and AI interpretation.
            </p>

            {/* Partners marquee */}
            <div className="w-full max-w-[580px] overflow-hidden border-t border-slate-200 pt-5 mt-2">
              <p className="text-[11px] text-slate-500 uppercase tracking-[0.12em] font-semibold mb-4">Supported Integrations</p>
              <div className="relative w-full overflow-hidden" style={{
                maskImage: 'linear-gradient(90deg, transparent, #000 15%, #000 85%, transparent)',
                WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 15%, #000 85%, transparent)',
              }}>
                <div className="flex animate-marquee w-max" style={{ animationDuration: '24s' }}>
                  {[
                    { name: 'INDmoney', style: { fontFamily: 'Georgia, serif', fontWeight: 700, letterSpacing: '-0.02em', fontSize: '15px' } },
                    { name: 'NSE', style: { fontFamily: 'Arial, sans-serif', fontWeight: 900, letterSpacing: '0.08em', fontSize: '13px', textTransform: 'uppercase' as const } },
                    { name: 'BSE', style: { fontFamily: '"Trebuchet MS", sans-serif', fontWeight: 600, letterSpacing: '0.01em', fontSize: '15px', fontStyle: 'italic' as const } },
                    { name: 'MCX', style: { fontFamily: '"Courier New", monospace', fontWeight: 700, letterSpacing: '0.12em', fontSize: '13px', textTransform: 'uppercase' as const } },
                    { name: 'NSDL', style: { fontFamily: 'Palatino, "Book Antiqua", serif', fontWeight: 400, letterSpacing: '-0.01em', fontSize: '16px' } },
                    { name: 'CDSL', style: { fontFamily: 'Impact, "Arial Narrow", sans-serif', fontWeight: 400, letterSpacing: '0.04em', fontSize: '14px' } },
                  ].map((p, i) => (
                    <span key={i} className="mx-6 shrink-0 whitespace-nowrap text-slate-500 hover:text-slate-900 transition-colors cursor-pointer" style={p.style}>
                      {p.name}
                    </span>
                  ))}
                  {[
                    { name: 'INDmoney', style: { fontFamily: 'Georgia, serif', fontWeight: 700, letterSpacing: '-0.02em', fontSize: '15px' } },
                    { name: 'NSE', style: { fontFamily: 'Arial, sans-serif', fontWeight: 900, letterSpacing: '0.08em', fontSize: '13px', textTransform: 'uppercase' as const } },
                    { name: 'BSE', style: { fontFamily: '"Trebuchet MS", sans-serif', fontWeight: 600, letterSpacing: '0.01em', fontSize: '15px', fontStyle: 'italic' as const } },
                    { name: 'MCX', style: { fontFamily: '"Courier New", monospace', fontWeight: 700, letterSpacing: '0.12em', fontSize: '13px', textTransform: 'uppercase' as const } },
                    { name: 'NSDL', style: { fontFamily: 'Palatino, "Book Antiqua", serif', fontWeight: 400, letterSpacing: '-0.01em', fontSize: '16px' } },
                    { name: 'CDSL', style: { fontFamily: 'Impact, "Arial Narrow", sans-serif', fontWeight: 400, letterSpacing: '0.04em', fontSize: '14px' } },
                  ].map((p, i) => (
                    <span key={i + 100} className="mx-6 shrink-0 whitespace-nowrap text-slate-500 hover:text-slate-900 transition-colors cursor-pointer" style={p.style}>
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right: glass card with login form */}
          <div className="w-full sm:w-[460px] flex-shrink-0">
            <AnimatePresence mode="wait">
              <motion.div
                key="login"
                variants={{
                  initial: { opacity: 0, y: 20, scale: 0.98 },
                  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
                  exit: { opacity: 0, y: -16, scale: 0.97, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } },
                }}
                initial="initial"
                animate="animate"
                exit="exit"
                className="relative rounded-[32px] p-8 sm:p-10 flex flex-col gap-6 box-border border border-slate-200 bg-white"
                style={{
                  boxShadow: '0 24px 60px rgba(15,23,42,0.12), 0 2px 6px rgba(15,23,42,0.05)',
                }}
              >
                {/* Card header */}
                <div className="relative z-10">
                  <h2 className="font-heading text-2xl font-semibold text-slate-900 tracking-tight mb-1.5">Welcome back</h2>
                  <p className="text-sm text-slate-500 font-normal">Sign in to access your investment intelligence</p>
                </div>

                {/* Card body — login form */}
                <div className="relative z-10 flex flex-col gap-4 w-full">
                  <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
                    <div className="flex flex-col gap-1.5 text-left w-full">
                      <label htmlFor="email" className="text-[13px] text-slate-500 font-medium">Email Address</label>
                      <input
                        id="email" type="email" placeholder="name@company.com"
                        value={formEmail} onChange={e => setFormEmail(e.target.value)}
                        required autoComplete="email"
                        className={cn(
                          'w-full bg-white border border-slate-300 rounded-xl text-slate-900 px-4 py-3 text-[14.5px] font-sans placeholder-slate-400',
                          'focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/15',
                          'transition-all box-border'
                        )}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5 text-left w-full">
                      <div className="flex items-center justify-between">
                        <label htmlFor="name" className="text-[13px] text-slate-500 font-medium">Display Name</label>
                      </div>
                      <input
                        id="name" type="text" placeholder="Your Name"
                        value={formName} onChange={e => setFormName(e.target.value)}
                        required autoComplete="name"
                        className={cn(
                          'w-full bg-white border border-slate-300 rounded-xl text-slate-900 px-4 py-3 text-[14.5px] font-sans placeholder-slate-400',
                          'focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/15',
                          'transition-all box-border'
                        )}
                      />
                    </div>

                    {authError && (
                      <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                        {authError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isLoading || authLoading || !formEmail || !formName}
                      className={cn(
                        'w-full mt-2 rounded-xl border-none cursor-pointer font-semibold text-white py-3.5 px-5 text-[15px] inline-flex items-center justify-center gap-2.5 transition-all duration-200',
                        'hover:-translate-y-0.5 hover:brightness-110 shadow-[0_10px_24px_rgba(37,99,235,0.3)]',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        'group'
                      )}
                      style={{ background: 'linear-gradient(135deg,#2563eb 0%,#4f46e5 100%)' }}
                    >
                      <span>{isLoading || authLoading ? 'Signing in…' : 'Sign In to NXTvue'}</span>
                      {!isLoading && !authLoading && (
                        <svg viewBox="0 0 16 16" className="w-4 h-4 stroke-white fill-none stroke-[2.2] stroke-linecap-round stroke-linejoin-round transition-transform duration-200 group-hover:translate-x-1">
                          <path d="M3 8h10M9 4l4 4-4 4" />
                        </svg>
                      )}
                      {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    </button>
                  </form>

                  <div className="flex items-center justify-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold uppercase tracking-wider w-fit mx-auto">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                    <span>Development Mode</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleDevLogin}
                    disabled={isLoading || authLoading}
                    className="w-full mt-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 py-3 px-5 text-[15px] font-medium transition-all duration-200 hover:bg-slate-100 border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Quick Login (Test User)
                  </button>

                  <p className="text-center text-slate-500 text-[13.5px] font-normal m-0">
                    By continuing, you agree to our{' '}
                    <a href="/terms" className="text-blue-600 hover:underline">Terms of Service</a>
                    {' '}and{' '}
                    <a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-10 h-16 sm:h-20 flex items-center justify-between px-6 sm:px-12 lg:px-16 border-t border-slate-200 bg-white/80 backdrop-blur-md pointer-events-none">
        <span className="text-xs sm:text-sm text-slate-500 pointer-events-auto">© 2026 NXTvue Systems, Inc. All rights reserved.</span>
        <span className="text-xs sm:text-sm text-slate-500 pointer-events-auto hidden sm:inline-block">Secure Investment Intelligence Platform</span>
      </footer>
    </div>
  )
}