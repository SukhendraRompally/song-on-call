import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({ baseURL: API_URL })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const auth = {
  signup: (email, password, anonThreadId) => api.post('/auth/signup', { email, password, anon_thread_id: anonThreadId || null }),
  login:  (email, password, anonThreadId) => api.post('/auth/login',  { email, password, anon_thread_id: anonThreadId || null }),
  me:     ()                              => api.get('/auth/me'),
  verify: (token)                         => api.get(`/auth/verify?token=${token}`),
}

export const threads = {
  list:   ()          => api.get('/threads'),
  get:    (id)        => api.get(`/threads/${id}`),
  create: ()          => api.post('/threads'),
  rename: (id, title) => api.put(`/threads/${id}`, { title }),
}

export const chat = {
  send:          (thread_id, message)     => api.post('/chat',           { thread_id, message }),
  revise:        (thread_id, instruction) => api.post('/revise',         { thread_id, instruction }),
  convertArtist: (artist_name)            => api.post('/convert-artist', { artist_name }),
}

export const songs = {
  generate:    (thread_id)         => api.post('/generate',           { thread_id }),
  status:      (thread_id)         => api.get(`/status/${thread_id}`),
  streamUrl:   (song_id)           => `${API_URL}/stream/${song_id}?token=${localStorage.getItem('token')}`,
  downloadUrl: (song_id)           => `${API_URL}/download/${song_id}`,
}

export const anon = {
  createSession: () => api.post('/session'),
}

export default api
