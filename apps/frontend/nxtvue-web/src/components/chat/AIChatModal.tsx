// ─── AIChatModal Component ───────────────────────────────────────────────────

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, X, Send, Trash2, ArrowUpRight } from 'lucide-react'
import { useAIChat } from '@/hooks/useAIChat'
import { cn } from '@/utils/cn'

interface AIChatModalProps {
  isOpen: boolean
  onClose: () => void
  initialContext?: Record<string, any>
}

export function AIChatModal({ isOpen, onClose, initialContext }: AIChatModalProps) {
  const { messages, isLoading, error, sendMessage, clearChat } = useAIChat()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isLoading, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    const text = input
    setInput('')
    await sendMessage(text, initialContext)
  }

  const suggestedQuestions = [
    'How should I rebalance my technology concentration?',
    'What is the current technical regime of NIFTY 50?',
    'Evaluate RELIANCE vs TCS on FY26 P/E multiples',
    'Explain optimal SIP allocation across market caps',
  ]

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-6 right-6 z-[500] w-[calc(100vw-3rem)] sm:w-[440px] h-[580px] max-h-[82vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col bg-[rgba(6,10,24,0.96)] backdrop-blur-3xl border border-white/[0.14]"
        >
          {/* Header */}
          <div className="px-5 py-4 bg-white/[0.04] border-b border-white/[0.08] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-heading font-semibold text-text-primary text-sm flex items-center gap-2">
                  NXTvue AI Copilot
                  <span className="px-1.5 py-0.5 text-[10px] font-mono bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
                    Live
                  </span>
                </h3>
                <p className="text-[11px] text-text-muted">Real-time financial intelligence & portfolio analysis</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={clearChat}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-colors"
                title="Clear history"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-colors"
                title="Close chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages list */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 divide-transparent">
            {messages.map((msg) => {
              const isUser = msg.role === 'user'
              return (
                <div
                  key={msg.id}
                  className={cn('flex flex-col', isUser ? 'items-end' : 'items-start')}
                >
                  <div
                    className={cn(
                      'max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm break-words whitespace-pre-wrap',
                      isUser
                        ? 'bg-blue-600 text-white rounded-br-sm'
                        : 'bg-white/[0.06] border border-white/[0.08] text-text-primary rounded-bl-sm font-sans'
                    )}
                  >
                    {!isUser && msg.content === '' && (
                      <div className="flex items-center gap-1.5 py-1 text-text-muted">
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                        <span className="text-xs">Analyzing financial data...</span>
                      </div>
                    )}
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-text-muted mt-1 px-1">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )
            })}

            {/* Quick Suggestions when conversation is young */}
            {messages.length <= 2 && (
              <div className="pt-2">
                <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Suggested Questions
                </p>
                <div className="flex flex-col gap-1.5">
                  {suggestedQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => sendMessage(q, initialContext)}
                      disabled={isLoading}
                      className="text-left text-xs px-3 py-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] text-text-secondary hover:text-text-primary transition-colors flex items-center justify-between group"
                    >
                      <span>{q}</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-text-muted group-hover:text-blue-400 shrink-0 ml-1" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <form
            onSubmit={handleSubmit}
            className="p-3 bg-white/[0.03] border-t border-white/[0.08] flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask NXTvue AI anything..."
              className="flex-1 bg-white/[0.05] border border-white/[0.1] rounded-2xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-blue-400 transition-colors"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="p-2.5 rounded-2xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 shadow-lg shadow-blue-600/30"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
