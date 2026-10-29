import React, { useState, useRef, useEffect } from 'react'
import { X, Send } from 'lucide-react'
import { useAIChat } from '@/hooks/useAIChat'

export function NxtVueChatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const {
    messages,
    isLoading,
    sendMessage,
  } = useAIChat()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isOpen) {
      scrollToBottom()
    }
  }, [messages, isLoading, isOpen])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userText = input.trim()
    setInput('')
    await sendMessage(userText)
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="mb-4 w-[calc(100vw-3rem)] sm:w-[400px] h-[500px] max-h-[70vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 transition-all duration-300 transform origin-bottom-right">
          {/* Header */}
          <div className="bg-slate-50 px-5 py-4 flex items-center justify-between border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 border border-slate-300">
                <span className="text-[15px] select-none text-slate-900 absolute">✳︎</span>
                {isLoading && (
                  <div className="absolute inset-0 rounded-full border border-slate-400 animate-ping opacity-20" />
                )}
              </div>
              <div>
                <h3 className="text-slate-900 font-medium text-sm">A.R.I.A (Gemini)</h3>
                <p className="text-slate-500 text-[10px] uppercase tracking-widest font-heading">Financial Analyst</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-500 hover:text-slate-900 transition-colors p-1"
              aria-label="Close chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Chat Area */}
          <div className="flex-1 p-5 overflow-y-auto bg-white flex flex-col gap-4 custom-report-scrollbar">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center mr-2 shrink-0 mt-1">
                    <span className="text-[12px] select-none text-slate-900">✳︎</span>
                  </div>
                )}
                <div
                  className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-slate-900 text-white rounded-br-sm'
                      : 'bg-slate-100 border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start items-end">
                <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center mr-2 shrink-0">
                  <span className="text-[12px] select-none text-slate-900">✳︎</span>
                </div>
                <div className="bg-slate-100 border border-slate-200 p-4 rounded-2xl rounded-bl-sm shadow-sm flex items-center gap-1">
                  <div
                    className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  />
                  <div
                    className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <div
                    className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form
            onSubmit={handleSend}
            className="p-4 bg-slate-50 border-t border-slate-200 flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about stocks, portfolio, markets..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-4 py-2.5 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:bg-white transition-all"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-900 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-transform"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Toggle Button with Reports ✳︎ Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full flex items-center justify-center bg-slate-100 backdrop-blur-xl border border-slate-300 text-slate-900 shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:bg-slate-100 hover:scale-110 transition-all duration-300 z-50 cursor-pointer ${
          isOpen ? 'bg-slate-100' : ''
        }`}
        aria-label={isOpen ? 'Close AI chat assistant' : 'Open AI chat assistant'}
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <X className="w-5 h-5 text-slate-900" aria-hidden="true" />
        ) : (
          <span className="text-xs font-bold tracking-wide text-slate-900" aria-hidden="true">AI</span>
        )}
      </button>
    </div>
  )
}
