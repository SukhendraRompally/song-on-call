import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Music, Sparkles } from 'lucide-react'
import useStore from '../store/useStore'
import { chat as chatApi } from '../lib/api'

export default function ChatBox({ threadId, onLyrics, onStageChange }) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const { messages, addMessage, user, openAuthModal } = useStore()
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!loading) inputRef.current?.focus()
  }, [loading])

  const send = async (text) => {
    const msg = text.trim()
    if (!msg || loading) return
    setInput('')
    setLoading(true)

    addMessage({ role: 'user', content: msg })

    try {
      const res = await chatApi.send(threadId, msg)
      const { reply, stage, lyrics } = res.data

      addMessage({ role: 'assistant', content: reply, stage, lyrics })

      if (lyrics) onLyrics(lyrics)
      if (stage) onStageChange(stage)
    } catch (err) {
      addMessage({ role: 'assistant', content: "Sorry, something went wrong. Please try again.", isError: true })
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-12">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-accent2 flex items-center justify-center glow">
              <Sparkles size={28} className="text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg mb-1">Tell me your story</h3>
              <p className="text-muted text-sm max-w-xs">
                I'll ask a few questions, write your lyrics, and generate a professional song — just for you.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {["A song for my wedding", "Our love story", "For my best friend", "My first year abroad"].map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs bg-card border border-border hover:border-accent/40 text-muted hover:text-white px-3 py-1.5 rounded-full transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 animate-slide-up ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {/* Avatar */}
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent to-accent2 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Music size={13} className="text-white" />
              </div>
            )}

            <div className={`max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
              <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-accent text-white rounded-tr-sm'
                  : msg.isError
                    ? 'bg-red-500/10 border border-red-500/20 text-red-300 rounded-tl-sm'
                    : 'bg-card border border-border text-gray-200 rounded-tl-sm'
              }`}>
                {msg.content.split('**').map((part, j) =>
                  j % 2 === 1
                    ? <strong key={j} className="text-white font-semibold">{part}</strong>
                    : part
                )}
              </div>

              {/* Stage badge */}
              {msg.stage === 'lyrics_draft' && (
                <span className="text-xs text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded-full">
                  ✨ Lyrics ready
                </span>
              )}
              {msg.stage === 'lyrics_confirm' && (
                <span className="text-xs text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full">
                  ✓ Approved
                </span>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 animate-fade-in">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent to-accent2 flex items-center justify-center flex-shrink-0">
              <Music size={13} className="text-white" />
            </div>
            <div className="bg-card border border-border px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-accent" />
              <span className="text-muted text-sm">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2 items-end bg-card border border-border rounded-2xl px-4 py-3 focus-within:border-accent/50 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tell me your story…"
            rows={1}
            disabled={loading}
            className="flex-1 bg-transparent text-sm text-white placeholder-muted resize-none outline-none max-h-32 leading-relaxed disabled:opacity-50"
            style={{ height: 'auto' }}
            onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent to-accent2 flex items-center justify-center flex-shrink-0 hover:opacity-90 disabled:opacity-30 transition-all"
          >
            <Send size={14} className="text-white" />
          </button>
        </div>
        <p className="text-muted text-xs text-center mt-2">Press Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  )
}
