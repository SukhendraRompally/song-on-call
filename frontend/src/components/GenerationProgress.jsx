import { Loader2, CheckCircle2, XCircle, Music } from 'lucide-react'
import useStore from '../store/useStore'

const steps = [
  { key: 'queued',     label: 'Queued' },
  { key: 'generating', label: 'Composing with Lyria AI' },
  { key: 'done',       label: 'Ready to play!' },
]

export default function GenerationProgress() {
  const { generationStatus, generationMessage } = useStore()

  if (!generationStatus || generationStatus === 'not_found') return null

  const isFailed = generationStatus === 'failed'
  const isDone = generationStatus === 'done'

  return (
    <div className="bg-card border border-border rounded-2xl p-5 animate-slide-up">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isFailed ? 'bg-red-500/20' : 'bg-accent/20'
        }`}>
          {isFailed
            ? <XCircle size={18} className="text-red-400" />
            : isDone
              ? <CheckCircle2 size={18} className="text-green-400" />
              : <Music size={18} className="text-accent animate-pulse-slow" />
          }
        </div>
        <div>
          <p className="text-sm font-semibold text-white">
            {isFailed ? 'Generation failed' : isDone ? 'Song ready!' : 'Generating your song…'}
          </p>
          <p className="text-xs text-muted">{generationMessage}</p>
        </div>
      </div>

      {/* Step progress */}
      {!isFailed && (
        <div className="space-y-2">
          {steps.map((step, i) => {
            const stepIdx = steps.findIndex(s => s.key === generationStatus)
            const past    = i < stepIdx
            const current = i === stepIdx
            const future  = i > stepIdx

            return (
              <div key={step.key} className="flex items-center gap-2.5">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                  past    ? 'bg-green-500/20 border border-green-500/30'  :
                  current ? 'bg-accent/20 border border-accent/30'        :
                            'bg-border/40 border border-border'
                }`}>
                  {past    && <CheckCircle2 size={12} className="text-green-400" />}
                  {current && <Loader2 size={11} className="text-accent animate-spin" />}
                  {future  && <div className="w-1.5 h-1.5 rounded-full bg-muted" />}
                </div>
                <span className={`text-xs ${
                  past ? 'text-green-400' : current ? 'text-white font-medium' : 'text-muted'
                }`}>{step.label}</span>
              </div>
            )
          })}
        </div>
      )}

      {isFailed && (
        <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
          {generationMessage}
        </p>
      )}
    </div>
  )
}
