import asyncio
import os
import uuid
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, BackgroundTasks, HTTPException, Depends
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from sqlalchemy.orm.attributes import flag_modified
from db import init_db, get_db, Thread, Song, new_id, now
from auth import (
    signup, login, get_current_user, get_current_user_optional,
    check_rate_limit, increment_song_count, User
)
from conversation import (
    chat_turn, generate_lyrics, revise_lyrics,
    build_wondera_prompt, convert_artist_to_style, process_user_style
)
from lyria import generate_song

load_dotenv()

JOBS_DIR = Path(__file__).parent.parent / "jobs"
JOBS_DIR.mkdir(exist_ok=True)

# in-memory generation status (thread_id → status dict)
generation_status: dict[str, dict] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Song On Call", lifespan=lifespan)
_cors_origins = [o.strip() for o in os.environ.get(
    "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
).split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic request schemas ──────────────────────────────────────────────────

class AuthRequest(BaseModel):
    email: str
    password: str

class ChatRequest(BaseModel):
    thread_id: str
    message: str

class ReviseRequest(BaseModel):
    thread_id: str
    instruction: str

class GenerateRequest(BaseModel):
    thread_id: str

class ConvertArtistRequest(BaseModel):
    artist_name: str

class UpdateThreadRequest(BaseModel):
    title: str


# ── Auth routes ───────────────────────────────────────────────────────────────

@app.post("/auth/signup")
async def auth_signup(req: AuthRequest, db: Session = Depends(get_db)):
    user, token = signup(req.email, req.password, db)
    return {"user_id": user.id, "email": user.email, "token": token, "email_verified": user.email_verified}


@app.post("/auth/login")
async def auth_login(req: AuthRequest, db: Session = Depends(get_db)):
    user, token = login(req.email, req.password, db)
    return {"user_id": user.id, "email": user.email, "token": token, "email_verified": user.email_verified}


@app.get("/auth/verify")
async def auth_verify(token: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.verification_token == token).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired verification link")
    user.email_verified = True
    user.verification_token = None
    db.commit()
    return {"message": "Email verified successfully"}


@app.get("/auth/me")
async def auth_me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {
        "user_id": user.id,
        "email_verified": user.email_verified,
        "email": user.email,
        "songs_today": user.songs_generated_today,
        "daily_limit": 5,
    }


# ── Thread routes ─────────────────────────────────────────────────────────────

@app.post("/threads")
async def create_thread(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    thread = Thread(id=new_id(), user_id=user.id, chat_history=[])
    db.add(thread)
    db.commit()
    db.refresh(thread)
    return _thread_response(thread)


@app.get("/threads")
async def list_threads(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    threads = (
        db.query(Thread)
        .filter(Thread.user_id == user.id)
        .order_by(Thread.updated_at.desc())
        .all()
    )
    return [_thread_response(t, include_history=False) for t in threads]


@app.get("/threads/{thread_id}")
async def get_thread(
    thread_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    thread = _get_user_thread(thread_id, user.id, db)
    song = db.query(Song).filter(Song.thread_id == thread_id).first()
    return {**_thread_response(thread), "song": _song_response(song) if song else None}


@app.put("/threads/{thread_id}")
async def update_thread(
    thread_id: str,
    req: UpdateThreadRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    thread = _get_user_thread(thread_id, user.id, db)
    thread.title = req.title
    thread.updated_at = now()
    db.commit()
    return _thread_response(thread)


# ── Artist conversion ─────────────────────────────────────────────────────────

@app.post("/convert-artist")
async def convert_artist(req: ConvertArtistRequest):
    loop = asyncio.get_event_loop()
    description = await loop.run_in_executor(None, convert_artist_to_style, req.artist_name)
    return {"artist": req.artist_name, "description": description}


# ── Chat route ────────────────────────────────────────────────────────────────

@app.post("/chat")
async def chat(
    req: ChatRequest,
    user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    # allow anonymous chat via session_id if not logged in
    if user:
        thread = _get_user_thread(req.thread_id, user.id, db)
    else:
        thread = db.query(Thread).filter(Thread.id == req.thread_id).first()
        if not thread:
            raise HTTPException(status_code=404, detail="Thread not found")

    history = thread.chat_history or []
    msg_lower = req.message.lower()

    # detect artist reference
    artist_triggers = ["sounds like", "style of", "feel like", "similar to", "like the song", "like the artist"]
    if any(t in msg_lower for t in artist_triggers) and not thread.reference_song:
        thread.reference_song = req.message

    history.append({"role": "user", "content": req.message})

    loop = asyncio.get_event_loop()

    if thread.status == "gathering":
        # pass full history (already includes user message at end)
        reply, ready = await loop.run_in_executor(None, chat_turn, history, req.message)
        history.append({"role": "assistant", "content": reply})

        if ready:
            thread.status = "lyrics_draft"
            lyrics = await loop.run_in_executor(None, generate_lyrics, history)
            thread.lyrics = lyrics

            # auto-generate title from first user message
            if thread.title == "New Song":
                first_msg = next((m["content"] for m in history if m["role"] == "user"), "")
                thread.title = first_msg[:40] + ("..." if len(first_msg) > 40 else "")

            thread.chat_history = list(history)
            flag_modified(thread, "chat_history")
            thread.updated_at = now()
            db.commit()

            return {
                "reply": reply,  # use the AI's natural wrap-up message
                "stage": "lyrics_draft",
                "lyrics": lyrics,
                "thread": _thread_response(thread),
            }

        thread.chat_history = list(history)
        flag_modified(thread, "chat_history")
        thread.updated_at = now()
        db.commit()

        return {"reply": reply, "stage": "gathering", "thread": _thread_response(thread)}

    if thread.status == "lyrics_draft":
        approve_signals = ["looks good", "generate", "perfect", "love it", "go ahead", "yes", "ready", "great", "awesome", "approve"]
        if any(sig in msg_lower for sig in approve_signals):
            # Lyrics approved → move to style gathering
            thread.status = "style_gathering"
            thread.chat_history = list(history)
            flag_modified(thread, "chat_history")
            thread.updated_at = now()
            db.commit()
            style_prompt = (
                "Your lyrics are locked in — they're beautiful! 🎵\n\n"
                "Last step: how do you want the song to **sound**? Tell me anything that feels right — for example:\n"
                "- A singer or artist whose style you love (*we'll capture the vibe, not copy them*)\n"
                "- A genre or mood: *'upbeat pop'*, *'slow emotional ballad'*, *'indie folk'*\n"
                "- An instrument: *'piano-driven'*, *'acoustic guitar'*, *'full orchestral'*\n"
                "- Just a feeling: *'cinematic'*, *'intimate'*, *'something that makes you cry'*\n\n"
                "Or say **'surprise me'** and I'll choose something that fits your story."
            )
            return {
                "reply": style_prompt,
                "stage": "style_gathering",
                "lyrics": thread.lyrics,
                "thread": _thread_response(thread),
            }

        # Not an approval — treat as revision
        revised = await loop.run_in_executor(None, revise_lyrics, thread.lyrics, req.message, thread.chat_history)
        thread.lyrics = revised
        history.append({"role": "assistant", "content": "Updated! Here are your revised lyrics."})
        thread.chat_history = list(history)
        flag_modified(thread, "chat_history")
        thread.updated_at = now()
        db.commit()
        return {
            "reply": "Done! Here are the updated lyrics. Any other changes, or shall we go ahead?",
            "stage": "lyrics_draft",
            "lyrics": revised,
            "thread": _thread_response(thread),
        }

    if thread.status == "style_gathering":
        loop = asyncio.get_event_loop()

        # "surprise me" → use auto-generated style
        if "surprise" in msg_lower or "you choose" in msg_lower or "up to you" in msg_lower:
            style = build_wondera_prompt(thread.chat_history or [], None)
            reply = "I love that! I'll craft a style that feels true to your story. Hit **Generate Song** whenever you're ready!"
        else:
            style = await loop.run_in_executor(None, process_user_style, req.message)
            if style:
                reply = f"Perfect — I've got the sound locked in. Hit **Generate Song** whenever you're ready!"
            else:
                # Input was too vague — fall back to auto style but still proceed
                style = build_wondera_prompt(thread.chat_history or [], req.message)
                reply = "I'll blend that into something that feels right for your story. Hit **Generate Song** whenever you're ready!"

        thread.music_style = style
        thread.status = "lyrics_confirm"
        history.append({"role": "assistant", "content": reply})
        thread.chat_history = list(history)
        flag_modified(thread, "chat_history")
        thread.updated_at = now()
        db.commit()
        return {
            "reply": reply,
            "stage": "lyrics_confirm",
            "lyrics": thread.lyrics,
            "thread": _thread_response(thread),
        }

    if thread.status == "lyrics_confirm":
        # Style is locked — any message here is a no-op, just remind them
        return {
            "reply": "Everything's set! Hit **Generate Song** to bring your lyrics to life. 🎶",
            "stage": "lyrics_confirm",
            "lyrics": thread.lyrics,
            "thread": _thread_response(thread),
        }

    raise HTTPException(status_code=400, detail=f"Cannot chat in stage: {thread.status}")


# ── Revise route ──────────────────────────────────────────────────────────────

@app.post("/revise")
async def revise(
    req: ReviseRequest,
    user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    if user:
        thread = _get_user_thread(req.thread_id, user.id, db)
    else:
        thread = db.query(Thread).filter(Thread.id == req.thread_id).first()
        if not thread:
            raise HTTPException(status_code=404, detail="Thread not found")

    if not thread.lyrics:
        raise HTTPException(status_code=400, detail="No lyrics to revise yet")

    loop = asyncio.get_event_loop()
    revised = await loop.run_in_executor(None, revise_lyrics, thread.lyrics, req.instruction, thread.chat_history)
    thread.lyrics = revised
    thread.updated_at = now()
    db.commit()
    return {"lyrics": revised, "stage": "lyrics_draft"}


# ── Generate route ────────────────────────────────────────────────────────────

async def _run_generation(thread_id: str, user_id: str) -> None:
    from db import SessionLocal
    db = SessionLocal()
    try:
        thread = db.query(Thread).filter(Thread.id == thread_id).first()
        user = db.query(User).filter(User.id == user_id).first()
        if not thread or not user:
            generation_status[thread_id] = {"status": "failed", "message": "Thread not found"}
            return

        generation_status[thread_id] = {"status": "generating", "message": "Composing your song with Lyria..."}

        # Build style prompt — convert artist if present
        # Use style locked in during style_gathering, fall back to auto-generated
        if thread.music_style:
            style = thread.music_style
        else:
            style = build_wondera_prompt(thread.chat_history or [], thread.reference_song)

        # Destination
        user_jobs = JOBS_DIR / user_id
        user_jobs.mkdir(parents=True, exist_ok=True)
        song_id = new_id()
        mp3_path = user_jobs / f"{song_id}.mp3"

        _, _ = generate_song(
            lyrics=thread.lyrics,
            style_prompt=style,
            output_path=mp3_path,
            full_length=True,
        )

        # Save to DB
        # Extract title from lyrics first line or thread title
        song_title = thread.title if thread.title != "New Song" else "My Song"
        song = Song(
            id=song_id,
            thread_id=thread_id,
            user_id=user_id,
            title=song_title,
            lyrics=thread.lyrics,
            audio_filename=str(mp3_path.relative_to(JOBS_DIR.parent)),
            music_style=style,
        )
        db.add(song)
        thread.status = "done"
        thread.updated_at = now()
        increment_song_count(user, db)
        db.commit()

        generation_status[thread_id] = {
            "status": "done",
            "message": "Your song is ready!",
            "song_id": song_id,
        }

    except Exception as e:
        generation_status[thread_id] = {"status": "failed", "message": str(e)}
        if 'thread' in dir() and thread:
            thread.status = "lyrics_confirm"  # rollback so user can retry
            db.commit()
    finally:
        db.close()


@app.post("/generate")
async def generate(
    req: GenerateRequest,
    bg: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    thread = _get_user_thread(req.thread_id, user.id, db)
    if not thread.lyrics:
        raise HTTPException(status_code=400, detail="No lyrics to generate from")
    if thread.status == "generating":
        raise HTTPException(status_code=409, detail="Already generating")

    if not user.email_verified:
        raise HTTPException(status_code=403, detail="Please verify your email before generating songs. Check your inbox.")

    check_rate_limit(user, db)

    thread.status = "generating"
    thread.updated_at = now()
    db.commit()

    generation_status[req.thread_id] = {"status": "queued", "message": "Queued..."}
    bg.add_task(_run_generation, req.thread_id, user.id)

    return {"status": "queued", "message": "Song generation started. This takes about 36 seconds."}


@app.get("/status/{thread_id}")
async def status(
    thread_id: str,
    user: User = Depends(get_current_user),
):
    s = generation_status.get(thread_id, {"status": "not_found", "message": "No job found"})
    return s


@app.get("/download/{song_id}")
async def download(
    song_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    song = db.query(Song).filter(Song.id == song_id, Song.user_id == user.id).first()
    if not song or not song.audio_filename:
        raise HTTPException(status_code=404, detail="Song not found")
    mp3_path = Path(__file__).parent.parent / song.audio_filename
    if not mp3_path.exists():
        raise HTTPException(status_code=404, detail="Audio file missing")
    return FileResponse(str(mp3_path), media_type="audio/mpeg", filename=f"{song.title or 'song'}.mp3")


@app.get("/stream/{song_id}")
async def stream(
    song_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Stream audio for in-browser playback."""
    song = db.query(Song).filter(Song.id == song_id, Song.user_id == user.id).first()
    if not song or not song.audio_filename:
        raise HTTPException(status_code=404, detail="Song not found")
    mp3_path = Path(__file__).parent.parent / song.audio_filename
    if not mp3_path.exists():
        raise HTTPException(status_code=404, detail="Audio file missing")
    return FileResponse(
        str(mp3_path), media_type="audio/mpeg",
        headers={"Accept-Ranges": "bytes"},
    )


# ── Anon session (for pre-auth chat) ─────────────────────────────────────────

@app.post("/session")
async def new_session(db: Session = Depends(get_db)):
    """Create anonymous thread (for pre-auth chat). Linked to user on signup."""
    thread = Thread(id=new_id(), user_id="anon", chat_history=[])
    db.add(thread)
    db.commit()
    return {"thread_id": thread.id}


@app.get("/")
async def root():
    return {"status": "Song On Call API running"}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_user_thread(thread_id: str, user_id: str, db: Session) -> Thread:
    thread = db.query(Thread).filter(
        Thread.id == thread_id,
        (Thread.user_id == user_id) | (Thread.user_id == "anon"),
    ).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    return thread


def _thread_response(thread: Thread, include_history: bool = True) -> dict:
    return {
        "id": thread.id,
        "title": thread.title,
        "status": thread.status,
        "lyrics": thread.lyrics,
        "reference_song": thread.reference_song,
        "chat_history": thread.chat_history if include_history else [],
        "created_at": thread.created_at.isoformat() if thread.created_at else None,
        "updated_at": thread.updated_at.isoformat() if thread.updated_at else None,
    }


def _song_response(song: Song) -> dict:
    return {
        "id": song.id,
        "title": song.title,
        "lyrics": song.lyrics,
        "music_style": song.music_style,
        "generated_at": song.generated_at.isoformat() if song.generated_at else None,
    }
