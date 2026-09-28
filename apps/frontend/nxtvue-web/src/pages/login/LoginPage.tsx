import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────
type Step =
  | 'login'
  | 'forgot-email'
  | 'forgot-otp'
  | 'forgot-newpw'
  | 'signup'
  | 'signup-otp'

// ─── OTP Box Component ─────────────────────────────────────────────────────────
function OtpInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const refs = useRef<Array<HTMLInputElement | null>>([])

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !value[i] && i > 0) {
      refs.current[i - 1]?.focus()
    }
  }

  const handleChange = (i: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1)
    const next = [...value]
    next[i] = digit
    onChange(next)
    if (digit && i < 5) refs.current[i + 1]?.focus()
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!paste) return
    const next = Array(6).fill('')
    paste.split('').forEach((c, i) => { next[i] = c })
    onChange(next)
    const focusIdx = Math.min(paste.length, 5)
    refs.current[focusIdx]?.focus()
    e.preventDefault()
  }

  return (
    <div className="flex gap-3 justify-center" onPaste={handlePaste}>
      {Array(6).fill(0).map((_, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ''}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKey(i, e)}
          className="w-11 h-12 text-center text-xl font-bold bg-black/55 border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#38bdf8] focus:ring-4 focus:ring-[#38bdf8]/20 transition-all shadow-[inset_0_2px_5px_rgba(0,0,0,0.6)] caret-[#38bdf8]"
        />
      ))}
    </div>
  )
}

// ─── Shared field styles ───────────────────────────────────────────────────────
const fieldClass =
  'w-full bg-black/55 border border-white/10 rounded-xl text-white px-4 py-3 text-[14.5px] font-sans placeholder-[#94a3b8]/35 focus:outline-none focus:border-[#38bdf8] focus:bg-black/75 focus:ring-4 focus:ring-[#38bdf8]/20 transition-all shadow-[inset_0_2px_5px_rgba(0,0,0,0.6)] box-border'

const labelClass = 'text-[13px] text-[#94a3b8] font-medium'

const primaryBtn =
  'w-full mt-2 rounded-xl border-none cursor-pointer font-semibold text-[#030712] py-3.5 px-5 text-[15px] inline-flex items-center justify-center gap-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white shadow-[0_10px_35px_rgba(255,255,255,0.25),inset_0_1px_0_rgba(255,255,255,0.9)] disabled:opacity-50 disabled:cursor-not-allowed'

const socialBtn =
  'flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-white/[0.02] border border-white/10 text-white text-sm font-medium transition-all duration-200 hover:bg-[rgba(56,189,248,0.08)] hover:border-[rgba(56,189,248,0.4)] hover:-translate-y-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] cursor-pointer'

// ─── Card animation variants ───────────────────────────────────────────────────
const cardVariants = {
  initial: { opacity: 0, y: 20, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, y: -16, scale: 0.97, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } },
}

// ─── Partners marquee ──────────────────────────────────────────────────────────
const partners = [
  { name: 'Stripe',   style: { fontFamily: 'Georgia, serif', fontWeight: 700, letterSpacing: '-0.02em', fontSize: '15px' } },
  { name: 'Coinbase', style: { fontFamily: 'Arial, sans-serif', fontWeight: 900, letterSpacing: '0.08em', fontSize: '13px', textTransform: 'uppercase' as const } },
  { name: 'Uniswap',  style: { fontFamily: '"Trebuchet MS", sans-serif', fontWeight: 600, letterSpacing: '0.01em', fontSize: '15px', fontStyle: 'italic' as const } },
  { name: 'Aave',     style: { fontFamily: '"Courier New", monospace', fontWeight: 700, letterSpacing: '0.12em', fontSize: '13px', textTransform: 'uppercase' as const } },
  { name: 'Compound', style: { fontFamily: 'Palatino, "Book Antiqua", serif', fontWeight: 400, letterSpacing: '-0.01em', fontSize: '16px' } },
  { name: 'MakerDAO', style: { fontFamily: 'Impact, "Arial Narrow", sans-serif', fontWeight: 400, letterSpacing: '0.04em', fontSize: '14px' } },
  { name: 'Chainlink',style: { fontFamily: 'Verdana, sans-serif', fontWeight: 700, letterSpacing: '-0.03em', fontSize: '13px' } },
]

// ─── Google OAuth URL builder ──────────────────────────────────────────────────
function buildGoogleOAuthUrl() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
  const redirectUri = `${window.location.origin}/auth/callback/google`
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

// ─── GitHub OAuth URL builder ──────────────────────────────────────────────────
function buildGithubOAuthUrl() {
  const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID || ''
  const redirectUri = `${window.location.origin}/auth/callback/github`
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'read:user user:email',
  })
  return `https://github.com/login/oauth/authorize?${params}`
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function LoginPage() {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [step, setStep] = useState<Step>('login')

  // Login
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  // Forgot password
  const [fpEmail, setFpEmail] = useState('')
  const [fpOtp, setFpOtp] = useState(Array(6).fill(''))
  const [fpNewPw, setFpNewPw] = useState('')
  const [fpConfirmPw, setFpConfirmPw] = useState('')
  const [fpLoading, setFpLoading] = useState(false)

  // Sign up
  const [suName, setSuName] = useState('')
  const [suEmail, setSuEmail] = useState('')
  const [suPassword, setSuPassword] = useState('')
  const [suConfirmPw, setSuConfirmPw] = useState('')
  const [suOtp, setSuOtp] = useState(Array(6).fill(''))
  const [suLoading, setSuLoading] = useState(false)

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

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginLoading(true)
    await new Promise(r => setTimeout(r, 1200))
    setLoginLoading(false)
    navigate('/dashboard')
  }, [navigate])

  const handleGoogleLogin = useCallback(() => {
    window.location.href = buildGoogleOAuthUrl()
  }, [])

  const handleGithubLogin = useCallback(() => {
    window.location.href = buildGithubOAuthUrl()
  }, [])

  const handleFpSendOtp = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setFpLoading(true)
    await new Promise(r => setTimeout(r, 1000))
    setFpLoading(false)
    setStep('forgot-otp')
  }, [])

  const handleFpVerifyOtp = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setFpLoading(true)
    await new Promise(r => setTimeout(r, 800))
    setFpLoading(false)
    setStep('forgot-newpw')
  }, [])

  const handleFpSubmitNewPw = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setFpLoading(true)
    await new Promise(r => setTimeout(r, 1000))
    setFpLoading(false)
    // Reset forgot-pw state and go back to login
    setFpEmail(''); setFpOtp(Array(6).fill('')); setFpNewPw(''); setFpConfirmPw('')
    setStep('login')
  }, [])

  const handleSignUp = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setSuLoading(true)
    await new Promise(r => setTimeout(r, 1000))
    setSuLoading(false)
    setStep('signup-otp')
  }, [])

  const handleSignUpOtp = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setSuLoading(true)
    await new Promise(r => setTimeout(r, 1000))
    setSuLoading(false)
    // Reset sign-up state and redirect to login
    setSuName(''); setSuEmail(''); setSuPassword(''); setSuConfirmPw(''); setSuOtp(Array(6).fill(''))
    setStep('login')
  }, [])

  // ── Step titles/subtitles ──────────────────────────────────────────────────
  const headings: Record<Step, { title: string; sub: string }> = {
    'login':        { title: 'Welcome back',        sub: 'Sign in to your enterprise workspace' },
    'forgot-email': { title: 'Forgot Password',     sub: "Enter your email and we'll send an OTP" },
    'forgot-otp':   { title: 'Check your email',    sub: `We sent a 6-digit OTP to ${fpEmail}` },
    'forgot-newpw': { title: 'Set new password',    sub: 'Choose a strong password for your account' },
    'signup':       { title: 'Create account',      sub: 'Get started with NXTvue today' },
    'signup-otp':   { title: 'Verify your email',   sub: `We sent a 6-digit OTP to ${suEmail}` },
  }

  const { title, sub } = headings[step]

  // ── Card content per step ─────────────────────────────────────────────────
  const renderCardBody = () => {
    switch (step) {

      // ── LOGIN ──────────────────────────────────────────────────────────────
      case 'login':
        return (
          <>
            {/* Social buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={handleGoogleLogin} className={socialBtn}>
                <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0">
                  <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.3 8.9 5 12 5z" />
                  <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
                  <path fill="#FBBC05" d="M5.3 14.7c-.2-.7-.4-1.5-.4-2.7s.2-2 .4-2.7L1.6 6.4C.6 8.4 0 10.6 0 13s.6 4.6 1.6 6.6l3.7-2.9z" />
                  <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.3-6.7-5.3L1.6 15.6C3.5 19.4 7.4 23 12 23z" />
                </svg>
                <span>Google</span>
              </button>
              <button type="button" onClick={handleGithubLogin} className={socialBtn}>
                <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12c0 5.3 3.4 9.8 8.2 11.4.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.6-4-1.6-.6-1.5-1.4-1.9-1.4-1.9-1.1-.8.1-.8.1-.8 1.2.1 1.9 1.2 1.9 1.2 1.1 1.9 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.3 1.3-3.1-.1-.3-.6-1.5.1-3.1 0 0 1-.3 3.3 1.2 1-.3 2-.4 3-.4s2 .1 3 .4c2.3-1.5 3.3-1.2 3.3-1.2.7 1.6.2 2.8.1 3.1.8.8 1.3 1.8 1.3 3.1 0 4.7-2.8 5.6-5.5 5.9.4.4.8 1.2.8 2.4v3.5c0 .3.2.7.8.6C20.6 21.8 24 17.3 24 12c0-6.6-5.4-12-12-12z" />
                </svg>
                <span>GitHub</span>
              </button>
            </div>

            <Divider />

            <form onSubmit={handleLogin} className="flex flex-col gap-4 w-full">
              <Field label="Work Email" htmlFor="login-email">
                <input
                  id="login-email" type="email" placeholder="name@company.com"
                  value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                  required autoComplete="email" className={fieldClass}
                />
              </Field>
              <Field
                label="Password"
                htmlFor="login-pw"
                labelRight={
                  <button type="button" onClick={() => setStep('forgot-email')}
                    className="text-[13px] text-[#38bdf8] font-medium hover:underline">
                    Forgot password?
                  </button>
                }
              >
                <input
                  id="login-pw" type="password" placeholder="••••••••••••"
                  value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                  required autoComplete="current-password" className={fieldClass}
                />
              </Field>
              <PrimaryButton loading={loginLoading} label="Sign In to Workspace" />
            </form>

            <p className="text-center text-[#94a3b8] text-[13.5px] font-normal m-0">
              Don't have an account?{' '}
              <button type="button" onClick={() => setStep('signup')}
                className="text-[#38bdf8] font-semibold hover:underline bg-transparent border-none p-0 cursor-pointer">
                Request access
              </button>
            </p>
          </>
        )

      // ── FORGOT PASSWORD — email ────────────────────────────────────────────
      case 'forgot-email':
        return (
          <form onSubmit={handleFpSendOtp} className="flex flex-col gap-4 w-full">
            <Field label="Your Email Address" htmlFor="fp-email">
              <input
                id="fp-email" type="email" placeholder="name@company.com"
                value={fpEmail} onChange={e => setFpEmail(e.target.value)}
                required autoComplete="email" className={fieldClass}
              />
            </Field>
            <PrimaryButton loading={fpLoading} label="Send OTP" />
            <BackLink onClick={() => setStep('login')} />
          </form>
        )

      // ── FORGOT PASSWORD — OTP ──────────────────────────────────────────────
      case 'forgot-otp':
        return (
          <form onSubmit={handleFpVerifyOtp} className="flex flex-col gap-5 w-full">
            <OtpInput value={fpOtp} onChange={setFpOtp} />
            <PrimaryButton loading={fpLoading} label="Verify OTP" disabled={fpOtp.join('').length < 6} />
            <BackLink onClick={() => setStep('forgot-email')} />
          </form>
        )

      // ── FORGOT PASSWORD — new password ────────────────────────────────────
      case 'forgot-newpw':
        return (
          <form onSubmit={handleFpSubmitNewPw} className="flex flex-col gap-4 w-full">
            <Field label="New Password" htmlFor="fp-newpw">
              <input
                id="fp-newpw" type="password" placeholder="••••••••••••"
                value={fpNewPw} onChange={e => setFpNewPw(e.target.value)}
                required autoComplete="new-password" className={fieldClass}
              />
            </Field>
            <Field label="Confirm New Password" htmlFor="fp-confirmpw">
              <input
                id="fp-confirmpw" type="password" placeholder="••••••••••••"
                value={fpConfirmPw} onChange={e => setFpConfirmPw(e.target.value)}
                required autoComplete="new-password" className={fieldClass}
              />
            </Field>
            <PrimaryButton
              loading={fpLoading} label="Submit"
              disabled={!fpNewPw || fpNewPw !== fpConfirmPw}
            />
          </form>
        )

      // ── SIGN UP ────────────────────────────────────────────────────────────
      case 'signup':
        return (
          <form onSubmit={handleSignUp} className="flex flex-col gap-4 w-full">
            <Field label="Full Name" htmlFor="su-name">
              <input
                id="su-name" type="text" placeholder="Jane Doe"
                value={suName} onChange={e => setSuName(e.target.value)}
                required autoComplete="name" className={fieldClass}
              />
            </Field>
            <Field label="Email Address" htmlFor="su-email">
              <input
                id="su-email" type="email" placeholder="name@company.com"
                value={suEmail} onChange={e => setSuEmail(e.target.value)}
                required autoComplete="email" className={fieldClass}
              />
            </Field>
            <Field label="Password" htmlFor="su-pw">
              <input
                id="su-pw" type="password" placeholder="••••••••••••"
                value={suPassword} onChange={e => setSuPassword(e.target.value)}
                required autoComplete="new-password" className={fieldClass}
              />
            </Field>
            <Field label="Confirm Password" htmlFor="su-confirmpw">
              <input
                id="su-confirmpw" type="password" placeholder="••••••••••••"
                value={suConfirmPw} onChange={e => setSuConfirmPw(e.target.value)}
                required autoComplete="new-password" className={fieldClass}
              />
            </Field>
            <PrimaryButton
              loading={suLoading} label="Create Account"
              disabled={!suName || !suEmail || !suPassword || suPassword !== suConfirmPw}
            />
            <BackLink onClick={() => setStep('login')} label="Already have an account? Sign in" />
          </form>
        )

      // ── SIGN UP — OTP ──────────────────────────────────────────────────────
      case 'signup-otp':
        return (
          <form onSubmit={handleSignUpOtp} className="flex flex-col gap-5 w-full">
            <OtpInput value={suOtp} onChange={setSuOtp} />
            <PrimaryButton loading={suLoading} label="Verify & Complete Sign Up" disabled={suOtp.join('').length < 6} />
            <BackLink onClick={() => setStep('signup')} />
          </form>
        )
    }
  }

  return (
    <div className="relative min-h-screen bg-[#010308] text-white overflow-x-hidden font-sans selection:bg-white/30 selection:text-white">
      {/* Video background */}
      <video
        ref={videoRef}
        className="fixed inset-0 w-full h-full object-cover z-0 pointer-events-none"
        autoPlay muted loop playsInline preload="auto" aria-hidden="true"
        poster="https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/130837c4-0244-4f37-9c61-8d801d93fd29.jpg"
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260912_104303_0c6d60b2-9353-408e-9449-585108a22fb5.mp4"
        style={{ display: reducedMotion ? 'none' : 'block' }}
      />
      <div className={cn('fixed inset-0 w-full h-full z-0 bg-[#010308]', reducedMotion ? 'block' : 'hidden')} />

      {/* Cinematic veil */}
      <div className="fixed inset-0 z-0 pointer-events-none" style={{
        background: `
          radial-gradient(130% 80% at 20% 40%, rgba(2,6,15,0.0) 0%, rgba(2,6,15,0.4) 65%, rgba(2,6,15,0.85) 100%),
          linear-gradient(90deg, rgba(2,6,15,0.5) 0%, rgba(2,6,15,0.2) 50%, rgba(2,6,15,0.7) 100%)
        `
      }} />

      {/* ── Header — brand only, no nav ──────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-20 h-20 sm:h-24 flex items-center px-6 sm:px-12 lg:px-16 pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto" aria-label="NXTvue">
          {/* NXTvue icon */}
          <svg className="w-7 h-5 text-white" viewBox="0 0 23 17" aria-hidden="true">
            <path d="M8.15 0.9 L4.55 0.9 L0.5 9.3 L4.1 9.3 Z" fill="currentColor" />
            <path d="M17.0 0 L13.4 0 L6.15 16.4 L9.75 16.4 Z" fill="currentColor" />
            <path d="M22.9 0 L19.3 0 L15.0 7.6 L18.6 7.6 Z" fill="currentColor" />
            <path d="M22.6 6.9 L19.0 6.9 L14.05 16.4 L17.65 16.4 Z" fill="currentColor" />
          </svg>
          <span
            className="font-heading text-xl sm:text-2xl font-bold tracking-[0.08em] text-white"
            style={{
              background: 'linear-gradient(180deg,#fff 0%,#cbd5e1 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            NXTvue
          </span>
        </div>
      </header>

      {/* ── Main split layout ─────────────────────────────────────────────── */}
      <main className="relative z-10 min-h-screen flex items-center justify-between px-6 sm:px-12 lg:px-16 xl:px-20 pt-24 pb-24 sm:py-24">
        <div className="w-full max-w-[1400px] mx-auto flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-16">

          {/* Left hero */}
          <div className="w-full lg:flex-1 lg:max-w-[640px] text-left flex flex-col gap-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[rgba(56,189,248,0.08)] border border-[rgba(56,189,248,0.2)] text-[#38bdf8] text-xs font-semibold uppercase tracking-wider backdrop-blur-md shadow-[0_0_20px_rgba(56,189,248,0.15)] w-fit">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              <span>NXTvue OS 1.0 Live</span>
            </div>

            <h1
              className="font-heading font-bold text-white tracking-tight leading-[1.08] m-0"
              style={{
                fontSize: 'clamp(2.5rem, 5.5vw, 3.75rem)',
                letterSpacing: '-0.03em',
                background: 'linear-gradient(180deg,#ffffff 0%,#94a3b8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Institutional Intelligence.<br />
              Made Effortless.
            </h1>

            <p className="text-[#94a3b8] text-base sm:text-lg leading-relaxed font-normal m-0 max-w-[46ch]">
              Transform complex financial data into clear, actionable investment intelligence.
              NXTvue combines quantitative finance, risk analytics, and AI interpretation.
            </p>

            {/* Partners marquee */}
            <div className="w-full max-w-[580px] overflow-hidden border-t border-white/10 pt-5 mt-2">
              <p className="text-[11px] text-[#94a3b8] uppercase tracking-[0.12em] font-semibold mb-4">Supported Integrations</p>
              <div
                className="relative w-full overflow-hidden"
                style={{
                  maskImage: 'linear-gradient(90deg, transparent, #000 15%, #000 85%, transparent)',
                  WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 15%, #000 85%, transparent)',
                }}
              >
                <div className="flex animate-marquee w-max" style={{ animationDuration: '24s' }}>
                  {[...partners, ...partners].map((p, i) => (
                    <span
                      key={i}
                      aria-hidden={i >= partners.length}
                      className="mx-6 shrink-0 whitespace-nowrap text-white/40 hover:text-white/85 transition-colors cursor-pointer"
                      style={p.style}
                    >
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Right: animated glass card ──────────────────────────────── */}
          <div className="w-full sm:w-[460px] flex-shrink-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                variants={cardVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="relative rounded-[32px] p-8 sm:p-10 flex flex-col gap-6 box-border border border-[rgba(56,189,248,0.25)]"
                style={{
                  background: `
                    linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.005) 100%),
                    radial-gradient(circle at top right, rgba(56,189,248,0.08), transparent 60%),
                    linear-gradient(180deg, rgba(5,11,24,0.65) 0%, rgba(2,5,12,0.8) 100%)
                  `,
                  backdropFilter: 'blur(50px) saturate(1.8)',
                  WebkitBackdropFilter: 'blur(50px) saturate(1.8)',
                  boxShadow: '0 40px 100px rgba(0,0,0,0.8), 0 0 60px rgba(56,189,248,0.12), inset 0 1px 1px rgba(255,255,255,0.4), inset 0 0 20px rgba(56,189,248,0.05)',
                }}
              >
                {/* Top border glow */}
                <div
                  className="absolute -inset-[1px] rounded-[32px] pointer-events-none p-[1px]"
                  style={{
                    background: 'linear-gradient(180deg,rgba(56,189,248,0.6) 0%,rgba(255,255,255,0.1) 40%,rgba(255,255,255,0.0) 100%)',
                    WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                    WebkitMaskComposite: 'xor',
                    maskComposite: 'exclude',
                  }}
                />

                {/* Card header */}
                <div className="relative z-10">
                  <h2 className="font-heading text-2xl font-semibold text-white tracking-tight mb-1.5">{title}</h2>
                  <p className="text-sm text-[#94a3b8] font-normal">{sub}</p>
                </div>

                {/* Card body — step-driven */}
                <div className="relative z-10 flex flex-col gap-4 w-full">
                  {renderCardBody()}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-10 h-16 sm:h-20 flex items-center justify-between px-6 sm:px-12 lg:px-16 border-t border-white/[0.08] bg-[#010308]/80 backdrop-blur-md pointer-events-none">
        <span className="text-xs sm:text-sm text-[#94a3b8] pointer-events-auto">© 2026 NXTvue Systems, Inc. All rights reserved.</span>
        <span className="text-xs sm:text-sm text-[#94a3b8] pointer-events-auto hidden sm:inline-block">Secure Investment Intelligence Platform</span>
      </footer>
    </div>
  )
}

// ─── Small reusable helpers ────────────────────────────────────────────────────

function Field({
  label, htmlFor, labelRight, children,
}: {
  label: string
  htmlFor: string
  labelRight?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5 text-left w-full">
      <div className="flex items-center justify-between">
        <label htmlFor={htmlFor} className={labelClass}>{label}</label>
        {labelRight}
      </div>
      {children}
    </div>
  )
}

function Divider() {
  return (
    <div className="flex items-center text-center text-xs font-medium uppercase tracking-wider text-[#94a3b8]/40 before:flex-1 before:border-b before:border-white/10 before:mr-3.5 after:flex-1 after:border-b after:border-white/10 after:ml-3.5">
      or continue with email
    </div>
  )
}

function PrimaryButton({
  loading, label, disabled,
}: {
  loading: boolean
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className={cn(primaryBtn, 'group')}
      style={{ background: 'linear-gradient(135deg,#ffffff 0%,#cbd5e1 100%)' }}
    >
      <span>{loading ? 'Please wait…' : label}</span>
      {!loading && (
        <svg viewBox="0 0 16 16" className="w-4 h-4 stroke-[#030712] fill-none stroke-[2.2] stroke-linecap-round stroke-linejoin-round transition-transform duration-200 group-hover:translate-x-1">
          <path d="M3 8h10M9 4l4 4-4 4" />
        </svg>
      )}
    </button>
  )
}

function BackLink({ onClick, label = '← Back' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-center text-[13px] text-[#94a3b8] hover:text-white transition-colors bg-transparent border-none p-0 cursor-pointer w-full"
    >
      {label}
    </button>
  )
}
