import { useEffect, useState, useCallback, useRef } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Sidebar from './components/Sidebar'
import ChatBox from './components/ChatBox'
import LyricsPanel from './components/LyricsPanel'
import Player from './components/Player'
import GenerationProgress from './components/GenerationProgress'
import AuthModal from './components/AuthModal'
import useStore from './store/useStore'
import { auth, threads as threadsApi, songs as songsApi, anon, chat } from './lib/api'
import { Disc3, Sparkles } from 'lucide-react'
import LandingPage from './components/LandingPage'

const queryClient = new QueryClient()

function App() {
  const {
    user, token, setUser, setToken,
    showAuthModal, openAuthModal,
    threads, setThreads, activeThread, setActiveThread, upsertThread,
    messages, setMessages, clearMessages,
    currentLyrics, setCurrentLyrics,
    generationStatus, generationMessage, setGenerationStatus,
    currentSong, setCurrentSong,
  } = useStore()

  const [stage, setStage] = useState('gathering')
  const [anonThreadId, setAnonThreadId] = useState(null)
  const [pollInterval, setPollInterval] = useState(null)
  const [verifyState, setVerifyState] = useState(null) // null | 'verifying' | 'success' | 'error'

  // Handle email verification link: /verify?token=xxx
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (!token) return
    setVerifyState('verifying')
    auth.verify(token)
      .then(() => {
        setVerifyState('success')
        window.history.replaceState({}, '', '/')
        // Refresh user so email_verified updates
        auth.me().then(r => setUser(r.data)).catch(() => {})
      })
      .catch(() => setVerifyState('error'))
  }, [])

  useEffect(() => {
    if (token && !user) {
      auth.me().then(r => setUser(r.data)).catch(() => {
        localStorage.removeItem('token')
        setToken(null)
      })
    }
  }, [token])

  useEffect(() => {
    if (user) {
      // Small delay so claim_anon_thread has time to commit before listing
      setTimeout(() => {
        threadsApi.list().then(r => setThreads(r.data)).catch(console.error)
      }, 500)
    }
  }, [user])

  useEffect(() => {
    if (!user && !anonThreadId) {
      anon.createSession().then(r => setAnonThreadId(r.data.thread_id)).catch(console.error)
    }
  }, [user])

  const activeThreadId = activeThread?.id || anonThreadId

  const startPolling = useCallback((threadId) => {
    const id = setInterval(async () => {
      try {
        const r = await songsApi.status(threadId)
        const { status, message, song_id } = r.data
        setGenerationStatus(status, message || '')
        if (status === 'done') {
          clearInterval(id)
          setPollInterval(null)
          threadsApi.get(threadId).then(r => {
            const t = r.data
            setActiveThread(t)
            upsertThread(t)
            if (t.song) setCurrentSong(t.song)
          })
        } else if (status === 'failed') {
          clearInterval(id)
          setPollInterval(null)
        }
      } catch {}
    }, 2000)
    setPollInterval(id)
  }, [])

  useEffect(() => () => { if (pollInterval) clearInterval(pollInterval) }, [pollInterval])

  const handleNewThread = async () => {
    try {
      const r = await threadsApi.create()
      const thread = r.data
      setActiveThread(thread)
      upsertThread(thread)
      clearMessages()
      setCurrentLyrics(null)
      setCurrentSong(null)
      setGenerationStatus(null)
      setStage('gathering')
    } catch (err) { console.error(err) }
  }

  const handleSelectThread = async (threadId) => {
    try {
      const r = await threadsApi.get(threadId)
      const t = r.data
      setActiveThread(t)
      setStage(t.status)
      setCurrentLyrics(t.lyrics || null)
      setCurrentSong(t.song || null)
      setGenerationStatus(null)
      setMessages((t.chat_history || []).map(m => ({ role: m.role, content: m.content })))
    } catch (err) { console.error(err) }
  }

  const handleGenerate = async () => {
    const threadId = activeThread?.id || anonThreadId
    if (!threadId) return
    if (!user) {
      openAuthModal(() => handleGenerate())
      return
    }
    try {
      setGenerationStatus('queued', 'Queued...')
      await songsApi.generate(threadId)
      startPolling(threadId)
    } catch (err) {
      const detail = err.response?.data?.detail
      const msg = typeof detail === 'object' ? detail?.message : detail
      setGenerationStatus('failed', msg || 'Generation failed')
    }
  }

  const handleLyrics = (lyrics) => {
    setCurrentLyrics(lyrics)
    if (activeThread) {
      const updated = { ...activeThread, lyrics }
      setActiveThread(updated)
      upsertThread(updated)
    }
  }

  const handleRevised = (lyrics) => {
    setCurrentLyrics(lyrics)
    if (activeThread) {
      const updated = { ...activeThread, lyrics }
      setActiveThread(updated)
      upsertThread(updated)
    }
  }

  const [approving, setApproving] = useState(false)
  const [approveError, setApproveError] = useState('')

  const handleApprove = async () => {
    const threadId = activeThread?.id || anonThreadId
    if (!threadId) {
      setApproveError('No active session — please refresh and try again.')
      return
    }
    setApproving(true)
    setApproveError('')
    try {
      const res = await chat.send(threadId, "Looks good, let's go")
      const { stage: newStage } = res.data
      if (newStage) {
        handleStageChange(newStage)
        // Reload thread to get updated chat history
        const threadRes = await threadsApi.get(threadId)
        const t = threadRes.data
        setMessages((t.chat_history || []).map(m => ({ role: m.role, content: m.content })))
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Something went wrong'
      setApproveError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setApproving(false)
    }
  }

  const handleStyleSelect = async (styleValue) => {
    const threadId = activeThread?.id || anonThreadId
    if (!threadId) return
    try {
      const res = await chat.send(threadId, styleValue)
      const { stage: newStage } = res.data
      if (newStage) {
        handleStageChange(newStage)
        const threadRes = await threadsApi.get(threadId)
        const t = threadRes.data
        setMessages((t.chat_history || []).map(m => ({ role: m.role, content: m.content })))
      }
    } catch (err) {
      console.error('Style select error:', err)
    }
  }

  const handleStageChange = (newStage) => {
    setStage(newStage)
    if (activeThread) {
      const updated = { ...activeThread, status: newStage }
      setActiveThread(updated)
      upsertThread(updated)
    }
  }

  const showLyrics   = !!currentLyrics
  const showPlayer   = currentSong && generationStatus === 'done'
  const showProgress = generationStatus && !['done', null].includes(generationStatus)

  const showLanding = !user && messages.length === 0

  // Email verification screen
  if (verifyState === 'verifying' || verifyState === 'success' || verifyState === 'error') {
    return (
      <div className="h-screen bg-base flex items-center justify-center">
        <div className="text-center max-w-sm px-6">
          {verifyState === 'verifying' && (
            <>
              <div className="w-12 h-12 rounded-full border-2 border-accent border-t-transparent animate-spin mx-auto mb-4" />
              <p className="text-white font-semibold">Verifying your email…</p>
            </>
          )}
          {verifyState === 'success' && (
            <>
              <div className="text-4xl mb-4">🎵</div>
              <h2 className="text-white text-xl font-bold mb-2">You're verified!</h2>
              <p className="text-muted text-sm mb-6">Your account is ready. Start turning your stories into songs.</p>
              <button onClick={() => setVerifyState(null)} className="bg-gradient-to-r from-accent to-accent2 text-white font-semibold px-6 py-3 rounded-xl glow">
                Open Song On Call
              </button>
            </>
          )}
          {verifyState === 'error' && (
            <>
              <div className="text-4xl mb-4">⚠️</div>
              <h2 className="text-white text-xl font-bold mb-2">Link expired or invalid</h2>
              <p className="text-muted text-sm mb-6">Try signing in — if your email is already verified you're good to go.</p>
              <button onClick={() => setVerifyState(null)} className="bg-gradient-to-r from-accent to-accent2 text-white font-semibold px-6 py-3 rounded-xl">
                Go to app
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  if (showLanding) {
    return (
      <div className="h-screen bg-base overflow-hidden">
        {showAuthModal && <AuthModal anonThreadId={anonThreadId} />}
        <LandingPage onStart={() => {
          // scroll chat into view — just focus the input
          document.querySelector('textarea')?.focus()
          // Force show chat by creating an anon session if needed
          setMessages([{ role: 'assistant', content: "Hey! Tell me about the story or moment you want to turn into a song. It can be about anyone — a person you love, a memory, a milestone. The more specific, the better the song. 🎵" }])
        }} />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-base overflow-hidden">
      {user && <Sidebar onSelectThread={handleSelectThread} onNewThread={handleNewThread} />}
      {user && !user.email_verified && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-center gap-2 text-xs text-amber-400">
          <span>📧</span>
          <span>Check your inbox to verify your email — required before generating songs.</span>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Chat panel */}
        <div className={`flex flex-col ${showLyrics ? 'w-1/2 border-r border-border' : 'flex-1'} h-full transition-all`}>
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2">
              {!user && (
                <>
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-accent2 flex items-center justify-center">
                    <Disc3 size={14} className="text-white" />
                  </div>
                  <span className="text-sm font-semibold text-white">Song On Call</span>
                </>
              )}
              {user && (
                <span className="text-sm text-muted truncate">
                  {activeThread?.title || 'Select or start a conversation'}
                </span>
              )}
            </div>
            {!user && (
              <button onClick={() => openAuthModal()} className="text-xs bg-accent/10 hover:bg-accent/20 border border-accent/20 text-accent px-3 py-1.5 rounded-lg transition-all font-medium">
                Sign in
              </button>
            )}
          </div>


          {activeThreadId
            ? <ChatBox threadId={activeThreadId} onLyrics={handleLyrics} onStageChange={handleStageChange} />
            : (
              <div className="flex-1 flex items-center justify-center">
                <Disc3 size={32} className="text-muted opacity-30 animate-spin" style={{ animationDuration: '3s' }} />
              </div>
            )
          }
        </div>

        {/* Right panel: Lyrics + Player/Progress */}
        {showLyrics && (
          <div className="w-1/2 flex flex-col h-full overflow-hidden">
            <div className={showPlayer || showProgress ? 'flex-1 overflow-hidden' : 'h-full'}>
              <LyricsPanel
                threadId={activeThread?.id || anonThreadId}
                lyrics={currentLyrics}
                stage={stage}
                onGenerate={handleGenerate}
                onRevised={handleRevised}
                onApprove={handleApprove}
                approving={approving}
                approveError={approveError}
                onStyleSelect={handleStyleSelect}
              />
            </div>
            {(showProgress || showPlayer) && (
              <div className="border-t border-border p-4 flex-shrink-0 space-y-4 bg-surface/50">
                {showProgress && <GenerationProgress />}
                {showPlayer   && <Player song={currentSong} />}
              </div>
            )}
          </div>
        )}
      </div>

      {showAuthModal && <AuthModal anonThreadId={anonThreadId} />}
    </div>
  )
}

export default function Root() {
  return (
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  )
}
