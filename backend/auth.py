"""
Authentication: signup, login, JWT, rate limiting.
5 songs per user per day.
"""
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
import bcrypt as _bcrypt
from sqlalchemy.orm import Session

from db import User, get_db, new_id, now

SECRET_KEY = os.environ.get("JWT_SECRET")
if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET environment variable is not set")
ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 30
DAILY_LIMIT = 5

bearer_scheme = HTTPBearer(auto_error=False)


# ── Password ──────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode(), hashed.encode())


# ── JWT ───────────────────────────────────────────────────────────────────────

def create_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": user_id, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None


# ── Dependencies ──────────────────────────────────────────────────────────────

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    user_id = decode_token(credentials.credentials)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user

def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Optional[User]:
    if not credentials:
        return None
    user_id = decode_token(credentials.credentials)
    if not user_id:
        return None
    return db.query(User).filter(User.id == user_id).first()


# ── Rate Limiting ─────────────────────────────────────────────────────────────

def check_rate_limit(user: User, db: Session) -> None:
    """Reset counter if it's a new day, then enforce limit."""
    from datetime import timezone
    utc_now = now()
    reset_at = user.reset_at
    if reset_at is not None and reset_at.tzinfo is None:
        reset_at = reset_at.replace(tzinfo=timezone.utc)
    if reset_at is None or utc_now >= reset_at:
        # reset daily counter
        user.songs_generated_today = 0
        # next reset: midnight UTC tomorrow
        tomorrow = (utc_now + timedelta(days=1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        user.reset_at = tomorrow
        db.commit()

    if user.songs_generated_today >= DAILY_LIMIT:
        reset_str = user.reset_at.strftime("%H:%M UTC") if user.reset_at else "midnight"
        raise HTTPException(
            status_code=429,
            detail={
                "error": "Daily limit reached",
                "limit": DAILY_LIMIT,
                "reset_at": user.reset_at.isoformat() if user.reset_at else None,
                "message": f"You've reached your {DAILY_LIMIT} songs/day limit. Resets at {reset_str}.",
            }
        )

def increment_song_count(user: User, db: Session) -> None:
    user.songs_generated_today += 1
    db.commit()


# ── Signup / Login ────────────────────────────────────────────────────────────

def signup(email: str, password: str, db: Session) -> tuple[User, str]:
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    existing = db.query(User).filter(User.email == email.lower()).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(
        id=new_id(),
        email=email.lower(),
        password_hash=hash_password(password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_token(user.id)
    return user, token

def login(email: str, password: str, db: Session) -> tuple[User, str]:
    user = db.query(User).filter(User.email == email.lower()).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user.id)
    return user, token
