import { useEffect, useRef, useState } from 'react'
import { Play, Pause, Download, Music2, Loader2 } from 'lucide-react'

export default function Player({ song }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [blobUrl, setBlobUrl] = useState(null)

  useEffect(() => {
    let url = null
    const token = localStorage.getItem('token')
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/stream/${song.id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => {
        if (!r.ok) throw new Error(`${r.status}`)
        return r.blob()
      })
      .then(blob => {
        url = URL.createObjectURL(blob)
        setBlobUrl(url)
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })

    return () => { if (url) URL.revokeObjectURL(url) }
  }, [song.id])

  const togglePlay = () => {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setPlaying(!playing)
  }

  const handleDownload = async () => {
    const token = localStorage.getItem('token')
    const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/download/${song.id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${song.title || 'song'}.mp3`
    a.click()
    URL.revokeObjectURL(url)
  }

  const fmt = (s) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  return (
    <div className="animate-slide-up">
      {/* Ready banner */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent2 flex items-center justify-center flex-shrink-0 glow-sm">
          <Music2 size={18} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{song.title || 'Your Song'}</p>
          <p className="text-xs text-green-400 font-medium">✓ Song ready!</p>
        </div>
      </div>

      {/* Hidden audio element */}
      {blobUrl && (
        <audio
          ref={audioRef}
          src={blobUrl}
          onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
          onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
          onEnded={() => setPlaying(false)}
        />
      )}

      {/* Progress bar */}
      {!error && (
        <div
          className="w-full h-2 bg-border rounded-full mb-1 cursor-pointer overflow-hidden"
          onClick={(e) => {
            if (!audioRef.current || !duration) return
            const rect = e.currentTarget.getBoundingClientRect()
            const ratio = (e.clientX - rect.left) / rect.width
            audioRef.current.currentTime = ratio * duration
          }}
        >
          <div
            className="h-full bg-gradient-to-r from-accent to-accent2 transition-all"
            style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
          />
        </div>
      )}

      {/* Time */}
      {!error && (
        <div className="flex justify-between text-xs text-muted mb-4">
          <span>{fmt(currentTime)}</span>
          <span>{duration ? fmt(duration) : '--:--'}</span>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3">
        {!error && (
          <button
            onClick={togglePlay}
            disabled={loading}
            className="w-12 h-12 rounded-full bg-gradient-to-br from-accent to-accent2 flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition-all glow flex-shrink-0"
          >
            {loading
              ? <Loader2 size={18} className="text-white animate-spin" />
              : playing
                ? <Pause size={20} className="text-white" fill="white" />
                : <Play  size={20} className="text-white" fill="white" style={{ marginLeft: 2 }} />
            }
          </button>
        )}

        <button
          onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-2 bg-card border border-border hover:border-accent/40 text-muted hover:text-white rounded-xl py-3 text-sm font-medium transition-all"
        >
          <Download size={15} />
          Download MP3
        </button>
      </div>
    </div>
  )
}
