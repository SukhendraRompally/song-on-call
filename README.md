# Song On Call

Turn a personal story into a real, full-length song — vocals, music, and all.

You chat with an AI about a memory, a person, or a moment. It writes lyrics tailored to your story. You refine them until every line feels right, choose how you want the song to sound, and get a professionally generated track in under a minute.

---

## How It Works

1. **Share your story** — Chat with the AI about whatever moment you want to capture. The more personal and specific, the better the song.
2. **Shape your lyrics** — The AI drafts lyrics from your story. Revise lines, shift the tone, change details — until it feels exactly right.
3. **Choose your sound** — Pick a genre, mood, or vibe. Acoustic folk, emotional piano, indie pop, soft R&B — or describe something custom.
4. **Generate your song** — A full song with real vocals and instrumentation is produced and ready to play or download.

---

## Tech Stack

**Backend**
- Python / FastAPI
- SQLite (persistent local database)
- AI conversation and lyric writing
- Music generation via Google's generative audio API

**Frontend**
- React 18 + Vite
- Tailwind CSS
- Zustand (state management)

---

## Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- API keys (see `.env.example`)

### Backend

```bash
cd song-on-call
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in your API keys
cd backend
uvicorn main:app --port 8000 --reload
```

### Frontend

```bash
cd frontend
npm install
echo "VITE_API_URL=http://localhost:8000" > .env.local
npm run dev
```

Visit `http://localhost:5173`.

---

## Environment Variables

See `.env.example` for the full list. Required:

| Variable | Description |
|---|---|
| `GROQ_API_KEY` | Groq API key (free tier at console.groq.com) |
| `GEMINI_API_KEY` | Google AI Studio key (for music generation) |
| `JWT_SECRET` | A long random string for signing auth tokens |
| `CORS_ORIGINS` | Comma-separated list of allowed frontend origins |

---

## Features

- Conversational story capture — the AI listens and knows when it has enough to write
- Iterative lyric editing — revise as many times as you want before generating
- Smart style selection — quick-pick presets or describe your own sound
- User accounts with sign up / login
- Rate limiting — 5 songs per user per day
- In-browser audio player with download

---

## Hosting

- **Frontend** — Vercel (connect GitHub repo, set `VITE_API_URL` in project settings)
- **Backend** — Any always-on machine, exposed via Cloudflare Tunnel
- **Database** — SQLite file on the backend machine, persists across restarts
