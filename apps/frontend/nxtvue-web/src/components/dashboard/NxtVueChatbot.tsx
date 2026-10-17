import React, { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Sparkles, Bot } from 'lucide-react'
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
        <div className="mb-4 w-[calc(100vw-3rem)] sm:w-[400px] h-[500px] max-h-[70vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-black/10 transition-all duration-300 transform origin-bottom-right">
          {/* Header */}
          <div className="bg-black p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 p-2 rounded-full">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-medium text-sm">NxtVue AI</h3>
                <p className="text-white/60 text-xs">Always here to help</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/60 hover:text-white transition-colors"
              aria-label="Close chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Chat Area */}
          <div className="flex-1 p-4 overflow-y-auto bg-[#F9F9F9] flex flex-col gap-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-black flex items-center justify-center mr-2 shrink-0 mt-1">
                    <Bot className="w-3 h-3 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-black text-white rounded-tr-sm'
                      : 'bg-white border border-black/5 text-black/80 rounded-tl-sm shadow-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start items-end">
                <div className="w-6 h-6 rounded-full bg-black flex items-center justify-center mr-2 shrink-0">
                  <Bot className="w-3 h-3 text-white" />
                </div>
                <div className="bg-white border border-black/5 p-4 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-1">
                  <div
                    className="w-1.5 h-1.5 bg-black/40 rounded-full animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  />
                  <div
                    className="w-1.5 h-1.5 bg-black/40 rounded-full animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <div
                    className="w-1.5 h-1.5 bg-black/40 rounded-full animate-bounce"
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
            className="p-4 bg-white border-t border-black/5 flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about stocks, portfolio, USD NxtVue..."
              className="flex-1 bg-[#F5F5F5] rounded-full px-4 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/10"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="bg-black text-white p-2.5 rounded-full hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-black rounded-full shadow-lg flex items-center justify-center hover:bg-gray-800 transition-transform hover:scale-105 active:scale-95 z-50 cursor-pointer"
        aria-label="Open AI chat assistant"
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <MessageCircle className="w-6 h-6 text-white" />
        )}
      </button>
    </div>
  )
}
