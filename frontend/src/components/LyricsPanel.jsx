import { useState } from 'react'
import { FileText, Check, Edit3, RefreshCw, Loader2 } from 'lucide-react'
import { chat as chatApi } from '../lib/api'
import useStore from '../store/useStore'

export default function LyricsPanel({ threadId, lyrics, stage, onGenerate, onRevised, onApprove, approving, approveError, onStyleSelect }) {
  const [editMode, setEditMode] = useState(false)
  const [editedLyrics, setEditedLyrics] = useState(lyrics)
  const [reviseInput, setReviseInput] = useState('')
  const [revising, setRevising] = useState(false)
  const { user, openAuthModal, generationStatus } = useStore()

  const isApproved = ['lyrics_confirm', 'style_gathering', 'generating', 'done'].includes(stage)
  const isStyleGathering = stage === 'style_gathering'
  const isReadyToGenerate = stage === 'lyrics_confirm'
  const isGenerating = generationStatus === 'queued' || generationStatus === 'generating'

  const [reviseError, setReviseError] = useState('')

  const handleRevise = async () => {
    if (!reviseInput.trim() || !threadId) return
    setRevising(true)
    setReviseError('')
    try {
      const res = await chatApi.revise(threadId, reviseInput)
      onRevised(res.data.lyrics)
      setReviseInput('')
    } catch (err) {
      setReviseError(err.response?.data?.detail || 'Revision failed. Please try again.')
    } finally {
      setRevising(false)
    }
  }

  const handleGenerate = () => {
    if (!user) { openAuthModal(onGenerate); return }
    onGenerate()
  }

  const formatLyrics = (text) => {
    if (!text) return null
    return text.split('\n').map((line, i) => {
      if (line.startsWith('[') && line.endsWith(']')) {
        return (
          <div key={i} className="mt-4 first:mt-0">
            <span className="text-xs font-semibold text-accent uppercase tracking-widest">{line}</span>
          </div>
        )
      }
      if (line === '') return <div key={i} className="h-2" />
      return <p key={i} className="text-gray-300 text-sm leading-relaxed">{line}</p>
    })
  }

  if (!lyrics) return null

  return (
    <div className="flex flex-col h-full animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <FileText size={15} className="text-accent" />
          <span className="text-sm font-semibold text-white">Lyrics</span>
          {isApproved && (
            <span className="text-xs bg-green-400/10 text-green-400 border border-green-400/20 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Check size={10} /> Approved
            </span>
          )}
        </div>
        {!isApproved && (
          <button
            onClick={() => setEditMode(!editMode)}
            className="text-muted hover:text-white transition-colors p-1 rounded"
          >
            <Edit3 size={14} />
          </button>
        )}
      </div>

      {/* Lyrics content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4">
        {editMode ? (
          <textarea
            value={editedLyrics}
            onChange={e => setEditedLyrics(e.target.value)}
            className="w-full h-full bg-surface border border-border rounded-xl p-3 text-sm text-gray-300 font-mono leading-relaxed resize-none focus:outline-none focus:border-accent transition-colors"
          />
        ) : (
          <div className="space-y-0.5">{formatLyrics(lyrics)}</div>
        )}
      </div>

      {/* Actions */}
      {!isApproved && (
        <div className="px-4 py-3 border-t border-border space-y-3 flex-shrink-0">
          {/* Revise input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={reviseInput}
              onChange={e => setReviseInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRevise()}
              placeholder='e.g. "make the chorus more upbeat"'
              disabled={revising}
              className="flex-1 bg-surface border border-border rounded-xl px-3 py-2 text-sm text-white placeholder-muted focus:outline-none focus:border-accent/50 transition-colors disabled:opacity-50"
            />
            <button
              onClick={handleRevise}
              disabled={!reviseInput.trim() || revising}
              className="px-3 py-2 bg-card border border-border hover:border-accent/40 rounded-xl text-muted hover:text-white transition-all disabled:opacity-30 flex items-center gap-1.5 text-sm"
            >
              {revising ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              {revising ? 'Revising...' : 'Revise'}
            </button>
          </div>

          {reviseError && (
            <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {reviseError}
            </p>
          )}

          {approveError && (
            <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {approveError}
            </p>
          )}
          {/* Approve button — sends approval to chat, triggers style gathering */}
          <button
            onClick={onApprove}
            disabled={approving}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-accent to-accent2 hover:opacity-90 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-all glow text-sm"
          >
            {approving
              ? <><Loader2 size={15} className="animate-spin" /> Confirming...</>
              : <>✓ Lyrics look good — next step →</>
            }
          </button>
          <p className="text-muted text-xs text-center">You'll choose the music style next</p>
        </div>
      )}

      {/* Style gathering — quick-pick buttons + guidance */}
      {isStyleGathering && (
        <div className="px-4 py-3 border-t border-border flex-shrink-0 space-y-3">
          <p className="text-xs text-white font-medium">🎨 What should it sound like?</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: '🎸 Acoustic Folk', value: 'acoustic folk, fingerpicked guitar, warm and intimate' },
              { label: '🎹 Emotional Piano', value: 'slow emotional ballad, piano-driven, cinematic strings' },
              { label: '✨ Indie Pop', value: 'indie pop, upbeat, catchy, guitar and synth' },
              { label: '🌙 Soft R&B', value: 'soft R&B, soulful vocals, smooth, late night vibes' },
            ].map(({ label, value }) => (
              <button
                key={value}
                onClick={() => onStyleSelect && onStyleSelect(value)}
                className="text-left text-xs bg-card border border-border hover:border-accent/50 hover:text-white text-muted rounded-xl px-3 py-2.5 transition-all"
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted/70 text-center">or describe your own style in the chat →</p>
        </div>
      )}

      {/* Ready to generate — style is locked */}
      {isReadyToGenerate && (
        <div className="px-4 py-3 border-t border-border flex-shrink-0">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-accent to-accent2 hover:opacity-90 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all glow text-sm"
          >
            {isGenerating
              ? <><Loader2 size={16} className="animate-spin" /> Generating your song...</>
              : <>🎵 Generate Song</>
            }
          </button>
          {!isGenerating && <p className="text-muted text-xs text-center mt-1.5">~36 seconds · Uses 1 of your 5 daily songs</p>}
        </div>
      )}
    </div>
  )
}
