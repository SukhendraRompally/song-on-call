import { useState } from 'react'
import { Plus, Music2, ChevronRight, LogOut, User, Disc3 } from 'lucide-react'
import useStore from '../store/useStore'
import { threads as threadsApi } from '../lib/api'

export default function Sidebar({ onSelectThread, onNewThread }) {
  const { user, threads, activeThread, logout, openAuthModal } = useStore()
  const [hoveredId, setHoveredId] = useState(null)

  const handleNewThread = async () => {
    if (!user) { openAuthModal(onNewThread); return }
    onNewThread()
  }

  const statusDot = (status) => {
    const map = {
      gathering:      'bg-muted',
      lyrics_draft:   'bg-yellow-400',
      lyrics_confirm: 'bg-blue-400',
      generating:     'bg-purple-400 animate-pulse',
      done:           'bg-green-400',
    }
    return map[status] || 'bg-muted'
  }

  return (
    <aside className="w-64 flex-shrink-0 bg-surface border-r border-border flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent2 flex items-center justify-center glow-sm">
            <Disc3 size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Song On Call</p>
            <p className="text-xs text-muted">Turn stories into songs</p>
          </div>
        </div>
      </div>

      {/* New Song button */}
      <div className="p-3">
        <button
          onClick={handleNewThread}
          className="w-full flex items-center gap-2 bg-accent/10 hover:bg-accent/20 border border-accent/20 hover:border-accent/40 text-accent rounded-xl px-3 py-2.5 text-sm font-medium transition-all group"
        >
          <Plus size={16} className="group-hover:rotate-90 transition-transform duration-200" />
          New Song
        </button>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-2 pb-2">
        {threads.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <Music2 size={24} className="text-muted mx-auto mb-2" />
            <p className="text-muted text-xs">No songs yet.<br />Start your first one!</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {threads.map(thread => (
              <button
                key={thread.id}
                onClick={() => onSelectThread(thread.id)}
                onMouseEnter={() => setHoveredId(thread.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-sm ${
                  activeThread?.id === thread.id
                    ? 'bg-accent/15 border border-accent/20 text-white'
                    : 'hover:bg-card text-muted hover:text-white'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot(thread.status)}`} />
                <span className="flex-1 truncate font-medium">{thread.title || 'New Song'}</span>
                {(hoveredId === thread.id || activeThread?.id === thread.id) && (
                  <ChevronRight size={14} className="text-muted flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* User footer */}
      <div className="p-3 border-t border-border">
        {user ? (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent to-accent2 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {user.email[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white font-medium truncate">{user.email}</p>
            </div>
            <button onClick={logout} className="text-muted hover:text-white transition-colors p-1 rounded" title="Log out">
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => openAuthModal()}
            className="w-full flex items-center gap-2 text-muted hover:text-white px-2 py-1.5 rounded-lg hover:bg-card transition-all text-xs"
          >
            <User size={14} />
            Sign in to save songs
          </button>
        )}
      </div>
    </aside>
  )
}
