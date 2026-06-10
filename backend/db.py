"""
SQLite database setup via SQLAlchemy.
Tables: users, threads, songs
Run directly to initialize: python3 db.py
"""
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import (
    create_engine, Column, String, Integer, Text, DateTime, JSON, ForeignKey, Boolean
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session

DB_PATH = Path(__file__).parent.parent / "songs.db"
ENGINE = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=ENGINE, autocommit=False, autoflush=False)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def new_id() -> str:
    return str(uuid.uuid4())


def now() -> datetime:
    return datetime.now(timezone.utc)


# ── Models ────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=new_id)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=now)
    email_verified = Column(Boolean, default=False)
    verification_token = Column(String, nullable=True, index=True)
    songs_generated_today = Column(Integer, default=0)
    reset_at = Column(DateTime, nullable=True)


class Thread(Base):
    __tablename__ = "threads"

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, default="New Song")
    status = Column(String, default="gathering")   # gathering|lyrics_draft|lyrics_confirm|generating|done
    chat_history = Column(JSON, default=list)
    lyrics = Column(Text, nullable=True)
    reference_song = Column(String, nullable=True)  # artist/song user mentioned
    music_style = Column(String, nullable=True)     # converted style description
    created_at = Column(DateTime, default=now)
    updated_at = Column(DateTime, default=now, onupdate=now)


class Song(Base):
    __tablename__ = "songs"

    id = Column(String, primary_key=True, default=new_id)
    thread_id = Column(String, ForeignKey("threads.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=True)
    lyrics = Column(Text, nullable=True)
    audio_filename = Column(String, nullable=True)   # relative: jobs/{user_id}/{song_id}.mp3
    music_style = Column(String, nullable=True)
    generated_at = Column(DateTime, default=now)


# ── Init ──────────────────────────────────────────────────────────────────────

def init_db():
    Base.metadata.create_all(bind=ENGINE)
    print(f"Database initialized at {DB_PATH}")


if __name__ == "__main__":
    init_db()
