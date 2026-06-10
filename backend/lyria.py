"""
Google Lyria 3 music generation via Gemini API.
One call returns a complete song (vocals + instrumentation) as MP3 bytes.
"""
import os
from pathlib import Path
from google import genai
from groq import Groq


_POETICIZE_SYSTEM = """You are preparing song lyrics for an AI music generator that requires poetic, non-explicit language.

Rewrite the lyrics using these rules:
1. Replace direct romantic/physical terms with poetic metaphors:
   - "kiss" / "kissed" → "our worlds collided", "that breathless moment", "time stood still"
   - "dating app" / "Hinge" / "Tinder" → "fate's strange hand", "a digital spark", "across the screen"
   - "girlfriend" / "boyfriend" → "my heart", "my person", "the one I found"
   - "unmatched" / "matched" → "slipped away", "found again", "came back"
   - "sad and lonely" → "searching", "adrift", "lost in the quiet"
   - "fell in love" → "my world shifted", "something clicked", "I found my home"
2. Keep ALL specific places, objects, and unique story details exactly as-is (Paris Baguette, Mountain View, Dumbo, etc.)
3. Keep the exact song structure ([Verse], [Chorus], [Bridge], etc.)
4. Keep the same number of lines in each section
5. Do NOT add or remove lines — only change word choices

Output ONLY the rewritten lyrics. No explanations, no preamble."""


def _poeticize(lyrics: str) -> str:
    """Rewrite lyrics in poetic language to pass Lyria's content filter."""
    client = Groq(api_key=os.environ["GROQ_API_KEY"])
    resp = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": _POETICIZE_SYSTEM},
            {"role": "user", "content": lyrics},
        ],
        temperature=0.3,
        max_tokens=800,
    )
    return resp.choices[0].message.content.strip()


def _client() -> genai.Client:
    return genai.Client(api_key=os.environ["GEMINI_API_KEY"])


def generate_song(
    lyrics: str,
    style_prompt: str = "pop, upbeat, heartfelt, male or female vocal",
    output_path: Path | None = None,
    full_length: bool = True,
) -> tuple[bytes, Path | None]:
    """
    Generate a complete song from lyrics + style prompt.
    Returns (mp3_bytes, saved_path).
    full_length=True uses lyria-3-pro-preview (~2-3 min song).
    full_length=False uses lyria-3-clip-preview (30-second clip, faster).
    """
    model = "lyria-3-pro-preview" if full_length else "lyria-3-clip-preview"

    # Poeticize lyrics before sending — Lyria blocks explicit romantic/intimate language
    safe_lyrics = _poeticize(lyrics)

    prompt = f"{style_prompt}\n\n{safe_lyrics}"

    client = _client()
    response = client.models.generate_content(
        model=model,
        contents=prompt,
    )

    # Check for safety filter blocks
    if response.prompt_feedback and response.prompt_feedback.block_reason:
        raise RuntimeError(
            f"Content blocked by safety filter: {response.prompt_feedback.block_reason.name}."
        )

    if not response.candidates:
        raise RuntimeError("Lyria returned no candidates — content may have been blocked.")

    candidate = response.candidates[0]

    # Candidate-level finish reason check (catches SAFETY blocks that bypass prompt_feedback)
    finish_reason = getattr(candidate, "finish_reason", None)
    if finish_reason and str(finish_reason) not in ("FinishReason.STOP", "STOP", "1"):
        raise RuntimeError(
            f"Lyria declined to generate audio (finish_reason={finish_reason}). "
            "Try adjusting the lyrics or style."
        )

    mp3_bytes = None
    parts = candidate.content.parts if candidate.content else []
    for part in parts:
        if hasattr(part, "inline_data") and part.inline_data is not None:
            mp3_bytes = part.inline_data.data
            break

    if not mp3_bytes:
        raise RuntimeError("Lyria returned no audio data")

    if output_path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(mp3_bytes)

    return mp3_bytes, output_path
