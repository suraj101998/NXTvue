// ─── useAIChat Hook ────────────────────────────────────────────────────────────

import { useState, useCallback, useRef } from 'react'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

export function useAIChat(initialMessages?: ChatMessage[]) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    initialMessages || [
      {
        id: 'initial',
        role: 'assistant',
        content:
          'Good day! I am NXTvue AI, your institutional portfolio and equity analyst. Ask me about Indian/US equities, portfolio risk allocation, valuation multiples, or market regimes.',
        timestamp: Date.now(),
      },
    ]
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(
    async (userText: string, context?: Record<string, any>) => {
      const trimmed = userText.trim()
      if (!trimmed || isLoading) return

      const userMsgId = 'user_' + Date.now()
      const assistantMsgId = 'assistant_' + (Date.now() + 1)

      const userMessage: ChatMessage = {
        id: userMsgId,
        role: 'user',
        content: trimmed,
        timestamp: Date.now(),
      }

      const assistantPlaceholder: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: Date.now() + 1,
      }

      const updatedMessages = [...messages, userMessage]
      setMessages([...updatedMessages, assistantPlaceholder])
      setIsLoading(true)
      setError(null)

      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      const controller = new AbortController()
      abortControllerRef.current = controller

      try {
        const payload = {
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          context,
        }

        const response = await fetch('/api/v1/chat/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`Chat API responded with status ${response.status}`)
        }

        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let accumulatedText = ''

        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              const trimmedLine = line.trim()
              if (!trimmedLine.startsWith('data:')) continue

              const jsonStr = trimmedLine.slice(5).trim()
              if (!jsonStr) continue

              try {
                const event = JSON.parse(jsonStr)
                if (event.type === 'chunk' && event.chunk) {
                  accumulatedText += event.chunk
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMsgId
                        ? { ...msg, content: accumulatedText }
                        : msg
                    )
                  )
                } else if (event.type === 'done' && event.full_text) {
                  accumulatedText = event.full_text
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMsgId
                        ? { ...msg, content: accumulatedText }
                        : msg
                    )
                  )
                } else if (event.type === 'error') {
                  setError(event.message || 'Error from AI service')
                }
              } catch (e) {
                // Ignore parse errors on individual SSE chunks
              }
            }
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return
        const errMsg = err?.message || 'Failed to get AI response'
        setError(errMsg)
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  content:
                    'Sorry, I encountered an issue connecting to the NXTvue AI stream. Please try again.',
                }
              : msg
          )
        )
      } finally {
        setIsLoading(false)
      }
    },
    [messages, isLoading]
  )

  const clearChat = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setMessages([
      {
        id: 'initial',
        role: 'assistant',
        content:
          'Chat history cleared. How can I assist with your investment strategy today?',
        timestamp: Date.now(),
      },
    ])
    setError(null)
  }, [])

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearChat,
  }
}
