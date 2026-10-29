// ─── Settings & Profile Page ──────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  User as UserIcon,
  Sliders,
  Bell,
  Shield,
  Database,
  Save,
  Check,
  RefreshCw,
  Lock,
  Globe,
  Coins,
  Calendar,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useToast } from '@/context/NotificationContext'
import { Button } from '@/components/ui/Button'
import { cn } from '@/utils/cn'

interface UserSettings {
  default_market: string
  default_currency: string
  default_year: number
  risk_profile: string
  theme: string
  email_alerts: boolean
  price_alerts: boolean
  rebalance_alerts: boolean
  live_indices_interval: number
}

const DEFAULT_SETTINGS: UserSettings = {
  default_market: 'india',
  default_currency: 'INR',
  default_year: 2026,
  risk_profile: 'moderate',
  theme: 'dark',
  email_alerts: true,
  price_alerts: true,
  rebalance_alerts: true,
  live_indices_interval: 5,
}

export function SettingsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'notifications' | 'integrations' | 'security'>('profile')
  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      const stored = localStorage.getItem('nxtvue_user_settings')
      if (stored) return JSON.parse(stored)
    } catch {}
    return DEFAULT_SETTINGS
  })
  const [isSaving, setIsSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)

  // Fetch settings from server if available
  useEffect(() => {
    fetch('/api/v1/user/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setSettings((prev) => ({ ...prev, ...data }))
        }
      })
      .catch(() => {})
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    setIsSaved(false)
    try {
      localStorage.setItem('nxtvue_user_settings', JSON.stringify(settings))
      await fetch('/api/v1/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      setIsSaved(true)
      toast.success('Your preferences have been saved successfully.', 'Settings Updated')
      setTimeout(() => setIsSaved(false), 3000)
    } catch (e) {
      toast.error('Failed to sync settings with server, saved locally.', 'Saved Locally')
    } finally {
      setIsSaving(false)
    }
  }

  const handleClearCache = () => {
    try {
      localStorage.removeItem('nxtvue_watchlist')
      localStorage.removeItem('nxtvue_notifications')
      toast.info('Local cache and cached assets cleared.', 'Cache Purged')
    } catch {
      toast.error('Failed to clear cache.', 'Error')
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary pt-8 pb-20 px-6 lg:px-12">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <h1 className="font-heading text-3xl font-bold text-text-primary">Settings & Profile</h1>
            <p className="text-text-secondary text-sm mt-1">
              Manage your investor profile, valuation parameters, and notification alerts
            </p>
          </div>

          <Button
            variant="primary"
            onClick={handleSave}
            disabled={isSaving}
            className="w-full md:w-auto shadow-lg shadow-blue-500/20"
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : isSaved ? (
              <Check className="w-4 h-4 mr-2 text-green-600" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {isSaving ? 'Saving...' : isSaved ? 'Saved!' : 'Save Changes'}
          </Button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200">
          {[
            { id: 'profile', label: 'Profile', icon: UserIcon },
            { id: 'preferences', label: 'Investment Preferences', icon: Sliders },
            { id: 'notifications', label: 'Notifications & Alerts', icon: Bell },
            { id: 'integrations', label: 'Data & AI Integrations', icon: Database },
            { id: 'security', label: 'Security & Sessions', icon: Shield },
          ].map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200',
                  isActive
                    ? 'bg-blue-600/15 border border-blue-500/30 text-blue-600 shadow-sm'
                    : 'text-text-muted hover:text-text-primary hover:bg-slate-50'
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Tab Contents */}
        <div className="space-y-6">
          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="glass-card p-6 space-y-6">
                <h3 className="font-heading font-semibold text-lg text-text-primary">Investor Profile</h3>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-heading font-bold text-2xl shadow-xl border border-slate-300">
                    {user?.name ? user.name.slice(0, 2).toUpperCase() : 'NV'}
                  </div>
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-heading font-bold text-text-primary text-xl">{user?.name || 'Investor'}</h4>
                      <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-600 border border-blue-500/30">
                        {user?.is_family_head ? 'Family Head' : 'Pro Investor'}
                      </span>
                    </div>
                    <p className="text-text-muted text-sm">{user?.email || 'user@example.com'}</p>
                    <p className="text-xs text-text-secondary pt-1">Member since 2026 • Verified Institutional Tier</p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-muted">Display Name</label>
                    <input
                      type="text"
                      defaultValue={user?.name || 'Test User'}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-blue-400"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-muted">Email Address</label>
                    <input
                      type="email"
                      defaultValue={user?.email || 'user@example.com'}
                      disabled
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-text-muted cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* PREFERENCES TAB */}
          {activeTab === 'preferences' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="glass-card p-6 space-y-6">
                <h3 className="font-heading font-semibold text-lg text-text-primary">Market & Valuation Defaults</h3>

                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-primary flex items-center gap-2">
                      <Globe className="w-4 h-4 text-blue-600" /> Default Market Focus
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {['india', 'us'].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setSettings({ ...settings, default_market: m })}
                          className={cn(
                            'p-3 rounded-xl border text-sm font-medium transition-all capitalize',
                            settings.default_market === m
                              ? 'bg-blue-600/20 border-blue-500/50 text-blue-600'
                              : 'bg-white border-slate-200 text-text-muted hover:text-text-primary'
                          )}
                        >
                          {m === 'india' ? '🇮🇳 India (NSE/BSE)' : '🇺🇸 US (NASDAQ/NYSE)'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-primary flex items-center gap-2">
                      <Coins className="w-4 h-4 text-amber-600" /> Display Currency
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {['INR', 'USD'].map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setSettings({ ...settings, default_currency: c })}
                          className={cn(
                            'p-3 rounded-xl border text-sm font-medium transition-all',
                            settings.default_currency === c
                              ? 'bg-blue-600/20 border-blue-500/50 text-blue-600'
                              : 'bg-white border-slate-200 text-text-muted hover:text-text-primary'
                          )}
                        >
                          {c === 'INR' ? 'INR (₹ Rupee)' : 'USD ($ Dollar)'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-primary flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-indigo-600" /> Default Projection Horizon
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {[2025, 2026, 2027].map((yr) => (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => setSettings({ ...settings, default_year: yr })}
                          className={cn(
                            'p-3 rounded-xl border text-sm font-medium transition-all',
                            settings.default_year === yr
                              ? 'bg-blue-600/20 border-blue-500/50 text-blue-600'
                              : 'bg-white border-slate-200 text-text-muted hover:text-text-primary'
                          )}
                        >
                          {yr}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-primary flex items-center gap-2">
                      <Shield className="w-4 h-4 text-emerald-600" /> Risk Tolerance Model
                    </label>
                    <select
                      value={settings.risk_profile}
                      onChange={(e) => setSettings({ ...settings, risk_profile: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-blue-400"
                    >
                      <option value="conservative" className="bg-white">Conservative (Capital Preservation)</option>
                      <option value="moderate" className="bg-white">Moderate (Balanced Growth & Divs)</option>
                      <option value="aggressive" className="bg-white">Aggressive (High Equity Beta)</option>
                      <option value="ultra_growth" className="bg-white">High Growth (Small Cap & Tech Focus)</option>
                    </select>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* NOTIFICATIONS TAB */}
          {activeTab === 'notifications' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="glass-card p-6 space-y-6">
                <h3 className="font-heading font-semibold text-lg text-text-primary">Alert Preferences</h3>

                <div className="space-y-4">
                  {[
                    {
                      key: 'email_alerts',
                      label: 'Email Summaries',
                      desc: 'Receive morning market regime digests and high-conviction breakout signals.',
                    },
                    {
                      key: 'price_alerts',
                      label: 'Price Threshold & Breakout Alerts',
                      desc: 'Real-time notifications when watchlist stocks hit key resistance/support levels.',
                    },
                    {
                      key: 'rebalance_alerts',
                      label: 'Portfolio Concentration & Rebalance Alerts',
                      desc: 'Instant alert when a single sector or asset exceeds your predefined risk bounds.',
                    },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl"
                    >
                      <div className="pr-4">
                        <p className="font-medium text-text-primary text-sm">{item.label}</p>
                        <p className="text-xs text-text-muted mt-0.5">{item.desc}</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={(settings as any)[item.key]}
                        onChange={(e) => setSettings({ ...settings, [item.key]: e.target.checked })}
                        className="w-5 h-5 accent-blue-500 rounded cursor-pointer"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* INTEGRATIONS TAB */}
          {activeTab === 'integrations' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="glass-card p-6 space-y-6">
                <h3 className="font-heading font-semibold text-lg text-text-primary">AI & Data Providers</h3>

                <div className="grid gap-4">
                  <div className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium text-text-primary text-sm">Bob LLM Financial Model</p>
                        <p className="text-xs text-text-muted">Institutional report generation engine</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                      Connected
                    </span>
                  </div>

                  <div className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600">
                        <Database className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium text-text-primary text-sm">Live Yahoo Finance / INDmoney Sync</p>
                        <p className="text-xs text-text-muted">Real-time quotes, financials, and multi-asset ratios</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                      Active
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200">
                  <h4 className="text-sm font-semibold text-text-primary mb-2">Local Data & Offline Cache</h4>
                  <p className="text-xs text-text-secondary mb-4">
                    Clear local watchlist and cache storage to force a full re-sync with market servers.
                  </p>
                  <Button variant="outline" onClick={handleClearCache}>
                    Purge Local Cache
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* SECURITY TAB */}
          {activeTab === 'security' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="glass-card p-6 space-y-6">
                <h3 className="font-heading font-semibold text-lg text-text-primary">Security & Active Sessions</h3>

                <div className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-600">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium text-text-primary text-sm">Session Authentication</p>
                      <p className="text-xs text-text-muted">Secured via HTTP-only encrypted JWT session cookies</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 text-xs font-semibold bg-green-500/20 text-green-600 rounded-full">
                    Active
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
