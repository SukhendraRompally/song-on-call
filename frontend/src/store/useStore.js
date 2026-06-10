import { create } from 'zustand'

const useStore = create((set, get) => ({
  // Auth
  user: null,
  token: localStorage.getItem('token') || null,
  setUser: (user) => set({ user }),
  setToken: (token) => {
    localStorage.setItem('token', token)
    set({ token })
  },
  logout: () => {
    localStorage.removeItem('token')
    set({ user: null, token: null, threads: [], activeThread: null })
  },

  // Auth modal
  showAuthModal: false,
  authPendingAction: null,
  openAuthModal: (pendingAction = null) => set({ showAuthModal: true, authPendingAction: pendingAction }),
  closeAuthModal: () => set({ showAuthModal: false, authPendingAction: null }),

  // Threads
  threads: [],
  activeThread: null,
  setThreads: (threads) => set({ threads }),
  setActiveThread: (thread) => set({ activeThread: thread }),
  upsertThread: (thread) => {
    const threads = get().threads
    const idx = threads.findIndex(t => t.id === thread.id)
    if (idx >= 0) {
      const updated = [...threads]
      updated[idx] = { ...updated[idx], ...thread }
      set({ threads: updated })
    } else {
      set({ threads: [thread, ...threads] })
    }
  },

  // Chat state
  messages: [],     // [{role, content, lyrics?}]
  addMessage: (msg) => set(s => ({ messages: [...s.messages, msg] })),
  setMessages: (messages) => set({ messages }),
  clearMessages: () => set({ messages: [] }),

  // Lyrics
  currentLyrics: null,
  setCurrentLyrics: (lyrics) => set({ currentLyrics: lyrics }),

  // Song generation
  generationStatus: null,  // null | 'queued' | 'generating' | 'done' | 'failed'
  generationMessage: '',
  currentSong: null,       // { id, title, lyrics, music_style }
  setGenerationStatus: (status, message = '') => set({ generationStatus: status, generationMessage: message }),
  setCurrentSong: (song) => set({ currentSong: song }),
}))

export default useStore
