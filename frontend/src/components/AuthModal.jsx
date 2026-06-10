import { useState } from 'react'
import { X, Music, Mail, Lock, Loader2 } from 'lucide-react'
import { auth } from '../lib/api'
import useStore from '../store/useStore'

export default function AuthModal({ anonThreadId }) {
  const { closeAuthModal, setUser, setToken, authPendingAction } = useStore()
  const [mode, setMode] = useState('signup') // signup | login
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = mode === 'signup'
        ? await auth.signup(email, password, anonThreadId)
        : await auth.login(email, password, anonThreadId)
      setToken(res.data.token)
      setUser({ id: res.data.user_id, email: res.data.email, email_verified: res.data.email_verified })
      closeAuthModal()
      if (authPendingAction) authPendingAction()
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeAuthModal} />

      {/* modal */}
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-2xl animate-slide-up">
        <button onClick={closeAuthModal} className="absolute top-4 right-4 text-muted hover:text-white transition-colors">
          <X size={20} />
        </button>

        {/* logo */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent2 flex items-center justify-center">
            <Music size={16} className="text-white" />
          </div>
          <span className="font-semibold text-white">Song On Call</span>
        </div>

        <h2 className="text-xl font-semibold text-white mb-1">
          {mode === 'signup' ? 'Create your account' : 'Welcome back'}
        </h2>
        <p className="text-muted text-sm mb-6">
          {mode === 'signup'
            ? 'Sign up to generate and save your songs'
            : 'Log in to access your songs'}
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm text-muted mb-1.5">Email</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-surface border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-muted focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-muted mb-1.5">Password</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                required
                className="w-full bg-surface border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-muted focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-accent to-accent2 hover:opacity-90 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-all flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {mode === 'signup' ? 'Create Account' : 'Log In'}
          </button>
        </form>

        <p className="text-center text-sm text-muted mt-5">
          {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}
          {' '}
          <button
            onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError('') }}
            className="text-accent hover:text-white transition-colors font-medium"
          >
            {mode === 'signup' ? 'Log in' : 'Sign up'}
          </button>
        </p>
      </div>
    </div>
  )
}
