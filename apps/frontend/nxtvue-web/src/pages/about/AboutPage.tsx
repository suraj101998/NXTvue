import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { cn } from '@/utils/cn'
import { ArrowRight, Sparkles, Target, Zap, Shield, BarChart3, Brain, Users, Globe, Award, BookOpen, Lightbulb } from 'lucide-react'

export function AboutPage() {
  const maskContainerRef = useRef<HTMLDivElement>(null)
  const spotlightHaloRef = useRef<HTMLDivElement>(null)
  const particleCanvasRef = useRef<HTMLCanvasElement>(null)

  const [targetX, setTargetX] = useState(window.innerWidth * 0.75)
  const [targetY, setTargetY] = useState(window.innerHeight * 0.5)
  const [currentX, setCurrentX] = useState(window.innerWidth * 0.75)
  const [currentY, setCurrentY] = useState(window.innerHeight * 0.5)
  const [isHovered, setIsHovered] = useState(false)
  const spotlightRadius = 150

  useEffect(() => {
    function updateMask() {
      if (!maskContainerRef.current || !spotlightHaloRef.current) return

      const maskStyle = `radial-gradient(circle ${spotlightRadius}px at ${currentX}px ${currentY}px, black 0%, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 70%, transparent 100%)`
      maskContainerRef.current.style.maskImage = maskStyle
      maskContainerRef.current.style.webkitMaskImage = maskStyle

      spotlightHaloRef.current.style.left = `${currentX}px`
      spotlightHaloRef.current.style.top = `${currentY}px`
    }

    function animateInteraction() {
      const ease = isHovered ? 0.15 : 0.04

      setCurrentX(prev => prev + (targetX - prev) * ease)
      setCurrentY(prev => prev + (targetY - prev) * ease)

      if (!isHovered) {
        const time = Date.now() * 0.0012
        const baseX = window.innerWidth * (window.innerWidth < 768 ? 0.5 : 0.75)
        const baseY = window.innerHeight * 0.5

        setTargetX(baseX + Math.cos(time) * 80)
        setTargetY(baseY + Math.sin(time * 1.3) * 60)
      }

      updateMask()
      requestAnimationFrame(animateInteraction)
    }

    function handleMouseMove(e: MouseEvent) {
      setTargetX(e.clientX)
      setTargetY(e.clientY)
      setIsHovered(true)
    }

    function handleMouseLeave() {
      setIsHovered(false)
    }

    function handleTouchMove(e: TouchEvent) {
      if (e.touches.length > 0) {
        setTargetX(e.touches[0].clientX)
        setTargetY(e.touches[0].clientY)
        setIsHovered(true)
      }
    }

    function handleTouchEnd() {
      setIsHovered(false)
    }

    document.body.addEventListener('mousemove', handleMouseMove)
    document.body.addEventListener('mouseleave', handleMouseLeave)
    document.body.addEventListener('touchmove', handleTouchMove, { passive: true })
    document.body.addEventListener('touchend', handleTouchEnd)

    animateInteraction()

    return () => {
      document.body.removeEventListener('mousemove', handleMouseMove)
      document.body.removeEventListener('mouseleave', handleMouseLeave)
      document.body.removeEventListener('touchmove', handleTouchMove)
      document.body.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isHovered])

  // Particle System
  useEffect(() => {
    const canvas = particleCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let particles: any[] = []
    const particleCount = window.innerWidth < 768 ? 25 : 50

    function resizeCanvas() {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    window.addEventListener('resize', resizeCanvas)
    resizeCanvas()

    class Particle {
      constructor() {
        this.x = Math.random() * canvas.width
        this.y = Math.random() * canvas.height
        this.size = Math.random() * 1.5 + 0.5
        this.speedX = Math.random() * 0.4 - 0.2
        this.speedY = Math.random() * -0.6 - 0.1
        this.opacity = Math.random() * 0.5 + 0.1
      }

      update() {
        this.x += this.speedX
        this.y += this.speedY

        if (this.y < 0) {
          this.y = canvas.height
          this.x = Math.random() * canvas.width
        }
        if (this.x > canvas.width) this.x = 0
        if (this.x < 0) this.x = canvas.width
      }

      draw() {
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(0, 255, 157, ${this.opacity})`
        ctx.shadowBlur = 10
        ctx.shadowColor = '#00ff9d'
        ctx.fill()
        ctx.shadowBlur = 0
      }
    }

    function initParticles() {
      particles = []
      for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle())
      }
    }

    function animateParticles() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (let i = 0; i < particles.length; i++) {
        particles[i].update()
        particles[i].draw()
      }
      requestAnimationFrame(animateParticles)
    }

    initParticles()
    animateParticles()

    return () => {
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [])

  const stats = [
    { label: 'Assets Analyzed', value: '15,000+', icon: BarChart3 },
    { label: 'Quant Models', value: '47', icon: Brain },
    { label: 'Institutional Clients', value: '200+', icon: Users },
    { label: 'Countries', value: '12', icon: Globe },
  ]

  const values = [
    {
      number: '01',
      title: 'Intelligence Over Data',
      desc: 'We don\'t just show metrics. We interpret them. Every number has a narrative. Every metric has meaning.',
      icon: Lightbulb,
    },
    {
      number: '02',
      title: 'Quantitative Rigor',
      desc: 'Institutional-grade risk models, factor analysis, and scenario analyzers powering every recommendation.',
      icon: Target,
    },
    {
      number: '03',
      title: 'AI That Explains',
      desc: 'Not a chatbot. An analyst. NXTvue AI interprets your portfolio like a seasoned investment professional.',
      icon: Brain,
    },
    {
      number: '04',
      title: 'Trust Through Transparency',
      desc: 'No black boxes. Every calculation is traceable. Every assumption is documented. Your trust is earned.',
      icon: Shield,
    },
  ]

  const team = [
    { name: 'Dr. Arjun Mehta', role: 'Chief Quantitative Officer', background: 'Ex-Goldman Sachs, PhD Financial Mathematics' },
    { name: 'Priya Sharma', role: 'Head of AI Research', background: 'Ex-Google DeepMind, ML Systems' },
    { name: 'Rajesh Kumar', role: 'Chief Technology Officer', background: 'Ex-Microsoft Azure, Distributed Systems' },
    { name: 'Anjali Patel', role: 'Head of Product', background: 'Ex-BlackRock, Investment Platforms' },
  ]

  return (
    <div className="relative min-h-screen bg-black text-white overflow-y-auto">
      {/* Background Layers */}
      <img
        src="https://strvid.nyc3.cdn.digitaloceanspaces.com/motionsite/statu-image.png"
        alt="Classical Statue Base"
        className="fixed inset-0 w-full h-full object-cover z-0"
        style={{ objectPosition: window.innerWidth < 768 ? '50% center' : '85% center' }}
      />

      {/* Reveal Mask Layer */}
      <div
        ref={maskContainerRef}
        className="fixed inset-0 w-full h-full z-10 pointer-events-none"
        style={{
          maskImage: `radial-gradient(circle ${spotlightRadius}px at ${currentX}px ${currentY}px, black 0%, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 70%, transparent 100%)`,
          webkitMaskImage: `radial-gradient(circle ${spotlightRadius}px at ${currentX}px ${currentY}px, black 0%, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 70%, transparent 100%)`,
        }}
      >
        <img
          src="https://strvid.nyc3.cdn.digitaloceanspaces.com/motionsite/statu-image-hover.png"
          alt="Cyber Statue Glow"
          className="w-full h-full object-cover"
          style={{ objectPosition: window.innerWidth < 768 ? '50% center' : '85% center' }}
        />
      </div>

      {/* Spotlight Halo Ring */}
      <div
        ref={spotlightHaloRef}
        className="fixed z-20 pointer-events-none"
        style={{
          left: `${currentX}px`,
          top: `${currentY}px`,
          transform: 'translate(-50%, -50%)',
          width: `${spotlightRadius * 2}px`,
          height: `${spotlightRadius * 2}px`,
          border: '2px solid rgba(0, 255, 157, 0.4)',
          borderRadius: '50%',
          boxShadow: '0 0 30px rgba(0, 255, 157, 0.2), inset 0 0 20px rgba(0, 255, 157, 0.1)',
        }}
      />

      {/* Particle Canvas */}
      <canvas
        ref={particleCanvasRef}
        className="fixed inset-0 z-20 pointer-events-none"
      />

      {/* Foreground Content */}
      <div className="relative z-30 flex flex-col justify-between p-6 md:p-10 pointer-events-none min-h-screen">
        {/* Header */}
        <header className="flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-3 cursor-pointer group">
            <div className="w-10 h-10 rounded-xl bg-black/50 backdrop-blur-md border border-green-400/30 shadow-[0_0_10px_rgba(0,255,157,0.1)] flex items-center justify-center transition duration-500 group-hover:border-green-400/70 group-hover:shadow-[0_0_20px_rgba(0,255,157,0.3)]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00ff9d" strokeWidth="2">
                <polygon points="12 2 2 22 22 22" />
                <circle cx="12" cy="16" r="2" />
              </svg>
            </div>
            <span className="font-heading font-extrabold text-2xl tracking-[0.08em] text-white">NXTvue</span>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <a href="#values" className="text-sm font-medium text-white/70 hover:text-green-400 transition">Values</a>
            <a href="#team" className="text-sm font-medium text-white/70 hover:text-green-400 transition">Team</a>
            <a href="#approach" className="text-sm font-medium text-white/70 hover:text-green-400 transition">Approach</a>
            <a href="#careers" className="text-sm font-medium text-white/70 hover:text-green-400 transition">Careers</a>
          </nav>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm">Login</Button>
            <Button variant="primary" size="sm" className="gap-2">
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col justify-center pointer-events-none mt-10 md:mt-0">
          <div className="w-full lg:w-[60%] xl:w-[55%] pointer-events-auto space-y-6">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 border border-green-400/20 text-green-400 text-[10px] font-bold uppercase tracking-widest backdrop-blur-md"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_#00ff9d]"></span>
              Investment Intelligence Platform
            </motion.div>

            {/* Headline */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="space-y-1"
            >
              <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-white leading-[1.1] tracking-tight drop-shadow-xl">
                BUILDING THE FUTURE<br />OF <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-300 to-green-500">INVESTMENT INTELLIGENCE</span>
              </h1>
            </motion.div>

            {/* Paragraph */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-base sm:text-lg font-normal text-white/70 tracking-wide max-w-2xl leading-relaxed drop-shadow-md"
            >
              Bridging institutional quantitative finance with modern AI to create investment intelligence that's powerful underneath, simple on the surface. NXTvue transforms complex financial data into clear, actionable insights.
            </motion.p>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="grid grid-cols-2 gap-4 max-w-xl pt-4"
            >
              {stats.map((stat, i) => (
                <Card key={i} variant="default" padding="md" className="bg-black/40 border-white/5 hover:border-green-400/30 transition duration-500 group">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-green-400/20 flex items-center justify-center">
                      <stat.icon className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <p className="font-heading text-2xl font-bold text-white">{stat.value}</p>
                      <p className="text-xs text-white/50 uppercase tracking-wider">{stat.label}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </motion.div>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-wrap items-center gap-5 pt-4"
            >
              <Button variant="primary" className="gap-3 pl-6 pr-3 py-3 rounded-full text-base">
                Explore Platform
                <span className="w-8 h-8 rounded-full bg-white/90 text-black flex items-center justify-center">
                  <ArrowRight className="w-4 h-4" />
                </span>
              </Button>
              <Button variant="outline" className="gap-2 px-6 py-3 rounded-full">
                <BookOpen className="w-4 h-4" />
                Read Our Story
              </Button>
            </motion.div>
          </div>
        </main>

        {/* Footer */}
        <footer className="flex flex-col md:flex-row items-center md:items-end justify-between pointer-events-auto gap-6">
          <div className="flex items-center gap-4">
            <a href="#" className="text-white/50 hover:text-green-400 transition"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg></a>
            <a href="#" className="text-white/50 hover:text-green-400 transition"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.057-1.266.07-1.645.07-4.85 0-3.259-.014-3.667-.072-4.947-.198-4.354-2.617-6.78-6.979-6.98C15.667.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg></a>
            <a href="#" className="text-white/50 hover:text-green-400 transition"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"/></svg></a>
            <a href="#" className="text-white/50 hover:text-green-400 transition"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></a>
          </div>

          <div className="hidden md:flex flex-col items-center gap-2">
            <span className="text-[10px] font-mono text-green-400 tracking-widest uppercase">Scroll</span>
            <div className="w-[22px] h-[36px] rounded-full border-2 border-white/30 flex justify-center p-1">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce shadow-[0_0_5px_#00ff9d]"></div>
            </div>
          </div>

          <div className="font-mono text-xs text-green-400 flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded border border-green-400/20">
            <span className="animate-pulse">●</span> MASK ACTIVE
          </div>
        </footer>
      </div>

      {/* Values Section */}
      <section id="values" className="relative z-30 py-24 px-6 md:px-10">
        <div className="max-w-[1400px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-green-400 text-xs font-mono uppercase tracking-widest">Our Principles</span>
            <h2 className="font-heading text-4xl md:text-5xl font-bold text-white mt-4 mb-6">What We Believe</h2>
            <p className="text-white/60 max-w-2xl mx-auto text-lg">Four principles that guide every decision we make.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 * i }}
                className="group"
              >
                <Card variant="strong" padding="lg" className="h-full bg-black/40 border-white/5 hover:border-green-400/30 transition duration-500">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-green-400/20 flex items-center justify-center group-hover:bg-green-400/30 transition-colors">
                      <value.icon className="w-6 h-6 text-green-400" />
                    </div>
                    <div>
                      <span className="font-mono text-green-400 text-lg font-bold">{value.number}</span>
                      <h3 className="font-heading text-xl font-semibold text-white mt-2 mb-2">{value.title}</h3>
                      <p className="text-white/60">{value.desc}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section id="team" className="relative z-30 py-24 px-6 md:px-10 bg-black/50">
        <div className="max-w-[1400px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-green-400 text-xs font-mono uppercase tracking-widest">Leadership</span>
            <h2 className="font-heading text-4xl md:text-5xl font-bold text-white mt-4 mb-6">The Minds Behind NXTvue</h2>
            <p className="text-white/60 max-w-2xl mx-auto text-lg">Deep expertise across quantitative finance, AI research, and institutional technology.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {team.map((member, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 * i }}
              >
                <Card variant="default" padding="lg" className="bg-black/40 border-white/5 text-center group">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-400/30 to-emerald-500/30 mx-auto mb-4 flex items-center justify-center border border-green-400/30 group-hover:border-green-400/50 transition-colors">
                    <span className="font-heading text-2xl font-bold text-white">{member.name.charAt(0)}{member.name.split(' ')[1]?.charAt(0) || ''}</span>
                  </div>
                  <h3 className="font-heading text-lg font-semibold text-white">{member.name}</h3>
                  <p className="text-green-400 text-sm font-medium mb-2">{member.role}</p>
                  <p className="text-white/50 text-xs">{member.background}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Approach Section */}
      <section id="approach" className="relative z-30 py-24 px-6 md:px-10">
        <div className="max-w-[1400px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-green-400 text-xs font-mono uppercase tracking-widest">Our Methodology</span>
            <h2 className="font-heading text-4xl md:text-5xl font-bold text-white mt-4 mb-6">How We Build Intelligence</h2>
            <p className="text-white/60 max-w-2xl mx-auto text-lg">Python calculates. AI interprets. This principle guides everything.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Brain, title: 'Quantitative Analyzer', desc: 'Risk models, factor analysis, regime detection, scenario analyzers — all built in Python with institutional rigor.', features: ['Sharpe, Sortino, VaR, CVaR', 'Factor models & regression', 'Monte Carlo simulations', 'Regime detection'] },
              { icon: Zap, title: 'AI Interpretation', desc: 'NXTvue AI doesn\'t just chat. It analyzes your portfolio like an analyst — explaining what happened, why it matters, and what to watch.', features: ['Contextual narratives', 'Risk explanations', 'Scenario interpretations', 'Actionable insights'] },
              { icon: Shield, title: 'Trust & Transparency', desc: 'Every number is traceable. Every assumption documented. No black boxes. You always know how we reached our conclusions.', features: ['Calculation audit trail', 'Data source attribution', 'Methodology docs', 'Confidence scores'] },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 * i }}
              >
                <Card variant="strong" padding="lg" className="h-full bg-black/40 border-white/5 hover:border-green-400/30 transition duration-500">
                  <div className="w-12 h-12 rounded-xl bg-green-400/20 flex items-center justify-center mb-6">
                    <item.icon className="w-6 h-6 text-green-400" />
                  </div>
                  <h3 className="font-heading text-xl font-semibold text-white mb-3">{item.title}</h3>
                  <p className="text-white/60 mb-6">{item.desc}</p>
                  <ul className="space-y-2">
                    {item.features.map((feature, j) => (
                      <li key={j} className="flex items-center gap-2 text-white/70 text-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-30 py-24 px-6 md:px-10">
        <div className="max-w-[1400px] mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Card variant="premium" padding="xl" className="max-w-3xl mx-auto">
              <h2 className="font-heading text-3xl md:text-4xl font-bold text-white mb-6">Ready to Experience Institutional Intelligence?</h2>
              <p className="text-white/60 text-lg mb-8">Join thousands of investors who trust NXTvue for their investment decisions.</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button variant="primary" size="lg" className="gap-2">
                  Start Free Trial
                  <ArrowRight className="w-5 h-5" />
                </Button>
                <Button variant="outline" size="lg">Schedule Demo</Button>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>
    </div>
  )
}