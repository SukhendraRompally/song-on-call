"""
Conversational AI engine.

Manages multi-turn story extraction, lyrics generation, and revision.
Each session keeps its own history + extracted story context.
"""
import os
import json
from groq import Groq


PROBE_SYSTEM = """You are a gifted songwriter and empathetic listener. Your job is to have a real, warm conversation with someone to understand their story deeply enough to write a song that genuinely moves them.

You are NOT filling out a form. You are having a human conversation — the kind where you actually listen, reflect back what you heard, and gently pull on threads that seem emotionally significant.

YOUR APPROACH:
- Always acknowledge what the person just shared before asking anything new. Make them feel heard.
- Ask ONE question at a time. Never list multiple questions.
- Follow the emotional thread. If someone mentions a specific moment, place, or feeling — dig into THAT before moving on.
- Push gently for specifics: "We met at a coffee shop" → "What was happening when you first noticed each other?" Specifics make unforgettable songs.
- Be warm, genuine, occasionally playful — never robotic or clinical.
- Reference earlier details to show you were listening.
- If someone gives a short answer, invite more: "That sounds like it meant a lot — what was going through your mind?"

PRIVACY: If someone says they want to keep it anonymous or doesn't share a name, COMPLETELY RESPECT THAT. Never ask for names again. Use "her", "him", "them", or descriptive phrases instead — "the person who changed everything", etc. Anonymity does not make a song less personal.

WHAT MAKES A GREAT SONG (gather naturally, never as a checklist):
- A specific memory or scene with texture and detail
- The emotional core — what feeling should this song leave someone with?
- At least one concrete, sensory detail — a place, an object, something someone said
- Something unexpected or uniquely theirs — the detail only they would know
- Near the end, casually: "Is there a song or artist that feels like the mood of this story?"

NEVER explain your process. Just be present like a thoughtful friend who happens to write songs.

SPECIAL INSTRUCTION — READINESS SIGNAL:
You will sometimes receive a system note at the end of the conversation that says: [ASSESSMENT: Ready to write]. If you see this, naturally wrap up the conversation by saying something warm like: "I think I have everything I need to write something really special for you. Want me to go ahead and write a first draft of the lyrics? You can always change things after." Do NOT say READY_TO_WRITE. Just make this feel like a natural moment in the conversation."""


LYRICS_SYSTEM = """You are a professional songwriter with a gift for turning personal stories into songs that feel both deeply specific and universally resonant — like Taylor Swift's storytelling or Ed Sheeran's warmth.

Based on the conversation, write a complete, emotionally authentic song. Use the SPECIFIC details from the story — real names, real places, the exact moments mentioned. Generic lyrics are a failure. The person should read these lyrics and immediately think "this is MY story".

Structure:
[Verse]
[Chorus]
[Verse]
[Chorus]
[Bridge]
[Chorus]

Rules:
1. SPECIFICITY over generality — use names, places, objects, exact details from the conversation
2. The chorus should capture the emotional core in a way someone would want to sing over and over
3. Each verse should advance the story — show the journey, not just the feeling
4. Keep lines singable: 6-10 syllables, natural speech rhythm
5. The bridge should offer a shift in perspective or an emotional revelation
6. Output ONLY the lyrics with section labels. No titles, no explanations, nothing else."""


REVISE_SYSTEM = """You are a professional lyricist. You wrote a song based on someone's personal story, and now they want a revision.

You will be given:
1. The original story context (the conversation where the user shared their story)
2. The current lyrics
3. The revision instruction

Apply the requested change while:
- Keeping everything else the same
- Staying true to the original story details
- Using specific names, places, and moments from the story wherever relevant

Output ONLY the complete revised lyrics with section labels. No explanations, no preamble."""


def _groq() -> Groq:
    return Groq(api_key=os.environ["GROQ_API_KEY"])


ASSESS_SYSTEM = """You are evaluating whether a songwriter has gathered enough story details to write a meaningful, specific song.

Review the conversation and return a JSON object with this exact format:
{
  "ready": true or false,
  "confidence": 0-100,
  "has": ["list of what we know — be specific"],
  "missing": ["list of what would make the song better, if anything"]
}

READY means true when ALL of these are present:
1. At least one specific memory, moment, or scene (not just "we met and fell in love")
2. The emotional tone is clear (joyful, bittersweet, funny, romantic, etc.)
3. At least one concrete detail — a place, object, something said, or a person's trait
4. The occasion or purpose is clear

Do NOT require names if the person wants anonymity.
Do NOT require a music style — that's optional.
Respond ONLY with valid JSON. No explanation, no markdown."""


def assess_readiness(history: list[dict]) -> dict:
    """Run a cold analytical assessment of whether we have enough story to write a great song."""
    story_so_far = "\n".join(
        f"{m['role'].upper()}: {m['content']}" for m in history
        if not m['content'].startswith('[ASSESSMENT')
    )
    try:
        resp = _groq().chat.completions.create(
            model="llama-3.1-8b-instant",   # fast cheap model for assessment
            messages=[
                {"role": "system", "content": ASSESS_SYSTEM},
                {"role": "user", "content": f"Conversation so far:\n\n{story_so_far}"},
            ],
            temperature=0.1,
            max_tokens=300,
        )
        import json as _json
        raw = resp.choices[0].message.content.strip()
        # strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return _json.loads(raw.strip())
    except Exception:
        return {"ready": False, "confidence": 0, "has": [], "missing": ["assessment failed"]}


def chat_turn(history: list[dict], user_message: str) -> tuple[str, bool]:
    """
    history already contains the latest user message appended by main.py.
    Returns (reply, ready_to_write).
    Two LLM calls:
      1. assess_readiness — cold analytical JSON evaluation
      2. conversational LLM — warm response, nudged toward wrap-up if ready
    """
    # history already has the user message at the end — use as-is for assessment
    assessment = assess_readiness(history)
    user_turns = sum(1 for m in history if m["role"] == "user")
    confidence = assessment.get("confidence", 0)

    # Text heuristic — only count messages that look like story content (>10 words)
    # Filters out short approval messages like "looks good", "yes", "go ahead"
    story_messages = [
        m["content"] for m in history
        if m["role"] == "user" and len(m["content"].split()) > 10
    ]
    user_text = " ".join(story_messages).lower()
    word_count = len(user_text.split())
    has_relationship = any(w in user_text for w in [
        "she ", "he ", "they ", "her ", "him ", "we ", "our ",
        "wife", "husband", "girlfriend", "boyfriend", "friend", "partner"
    ])
    has_event = any(w in user_text for w in [
        "met", "married", "kissed", "moved", "started", "happened",
        "went ", "first ", "together", "date", "anniversary"
    ])
    story_is_rich = word_count >= 50 and has_relationship and has_event

    # Turn 1: needs both LLM confidence AND rich text (high bar for single-shot)
    # Turn 2-3: LLM confidence OR rich text
    # Turn 4+: rich text alone is enough
    # Turn 7+: always trigger
    if user_turns >= 7:
        ready = True
    elif user_turns >= 4:
        ready = story_is_rich or confidence >= 45
    elif user_turns >= 2:
        ready = story_is_rich or confidence >= 55
    else:
        ready = story_is_rich and confidence >= 50

    # Build conversational messages
    if ready:
        # inject the signal into the last user turn
        modified_history = history[:-1] + [{
            "role": "user",
            "content": history[-1]["content"] + "\n\n[ASSESSMENT: Ready to write]"
        }]
        messages = [{"role": "system", "content": PROBE_SYSTEM}] + modified_history
    else:
        messages = [{"role": "system", "content": PROBE_SYSTEM}] + history

    resp = _groq().chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        temperature=0.85,
        max_tokens=350,
    )
    reply = resp.choices[0].message.content.strip()

    # also detect from the reply text in case LLM naturally signals readiness
    ready_phrases = [
        "write a first draft", "go ahead and write", "write something special",
        "have everything i need", "have what i need", "ready to write",
        "start writing", "write the lyrics", "shall i go ahead",
        "want me to go ahead", "want me to write"
    ]
    if any(p in reply.lower() for p in ready_phrases):
        ready = True

    return reply, ready


def generate_lyrics(history: list[dict]) -> str:
    """Generate lyrics from the full conversation history."""
    # summarise the story from history for the lyrics prompt
    story_context = "\n".join(
        f"{m['role'].upper()}: {m['content']}" for m in history
    )
    messages = [
        {"role": "system", "content": LYRICS_SYSTEM},
        {"role": "user", "content": f"Here is the conversation with all the story details:\n\n{story_context}\n\nWrite the song now."},
    ]
    resp = _groq().chat.completions.create(
        model="llama-3.3-70b-versatile",   # better model for creative writing
        messages=messages,
        temperature=0.85,
        max_tokens=800,
    )
    return resp.choices[0].message.content.strip()


def revise_lyrics(current_lyrics: str, instruction: str, history: list[dict] | None = None) -> str:
    """Apply a user revision instruction to the current lyrics, with full story context."""
    story_context = ""
    if history:
        # Include only the story-gathering part (user messages that contain the actual story)
        story_msgs = [m["content"] for m in history if m["role"] == "user" and len(m["content"].split()) > 5]
        if story_msgs:
            story_context = "Original story shared by the user:\n" + "\n".join(f"- {m}" for m in story_msgs) + "\n\n"

    messages = [
        {"role": "system", "content": REVISE_SYSTEM},
        {"role": "user", "content": (
            f"{story_context}"
            f"Current lyrics:\n\n{current_lyrics}\n\n"
            f"Revision requested: {instruction}"
        )},
    ]
    resp = _groq().chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        temperature=0.75,
        max_tokens=800,
    )
    return resp.choices[0].message.content.strip()


STYLE_PROMPT = """You are a music production expert. A user described how they want their song to sound.
Your job: convert their description into a concise music style prompt for an AI music generator.

Rules:
1. NEVER include real artist or band names — convert them to descriptors instead
   (e.g. "like Ed Sheeran" → "acoustic singer-songwriter, intimate male vocal, fingerpicked guitar")
2. Keep it under 20 words, comma-separated
3. Include: genre, tempo/energy, instrumentation hints, vocal style if mentioned
4. If the input is too vague or nonsensical to extract any style, return exactly: IGNORE
5. Output ONLY the style descriptor or the word IGNORE. Nothing else."""


def process_user_style(user_input: str) -> str | None:
    """
    Convert a user's freeform style description into a Gemini-safe prompt.
    Returns None if the input is too vague to use.
    """
    resp = _groq().chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": STYLE_PROMPT},
            {"role": "user", "content": user_input},
        ],
        temperature=0.2,
        max_tokens=60,
    )
    result = resp.choices[0].message.content.strip()
    if result.upper() == "IGNORE" or len(result) < 3:
        return None
    return result


def convert_artist_to_style(artist_name: str) -> str:
    """
    Convert a real artist name to a generic music style description.
    Avoids passing artist names to Lyria (triggers content filter).
    """
    messages = [
        {
            "role": "system",
            "content": (
                "You are a music expert. Convert an artist name into a concise music style description "
                "that captures their sound WITHOUT mentioning the artist's name or any other real artist names. "
                "Focus on: genre, tempo, instrumentation, vocal style, production feel. "
                "Output only the description, max 15 words, comma-separated."
            ),
        },
        {"role": "user", "content": f"Describe the music style of: {artist_name}"},
    ]
    resp = _groq().chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=messages,
        temperature=0.3,
        max_tokens=60,
    )
    return resp.choices[0].message.content.strip()


def build_wondera_prompt(history: list[dict], reference_song: str | None) -> str:
    """Build a style prompt for Lyria from the conversation context.

    NOTE: Avoids real artist names (triggers content filter with romantic content).
    Uses generic style descriptors instead.
    """
    full_text = " ".join(m["content"] for m in history).lower()

    mood_hints = []
    if any(w in full_text for w in ["happy", "joyful", "fun", "laugh", "funny"]):
        mood_hints.append("upbeat")
    if any(w in full_text for w in ["love", "romantic", "sweet", "heart"]):
        mood_hints.append("romantic")
    if any(w in full_text for w in ["sad", "miss", "lost", "bittersweet"]):
        mood_hints.append("bittersweet, emotional")

    parts = ["pop"]
    if mood_hints:
        parts.extend(mood_hints)

    # Don't reference specific artists — use generic descriptors instead
    # (Lyria's content filter blocks real artist names + romantic content to prevent deepfakes)
    if reference_song:
        # Try to extract genre hints from song name
        if any(x in reference_song.lower() for x in ["perfect", "someone like you", "shape of you"]):
            parts.append("acoustic, singer-songwriter")
        else:
            parts.append("heartfelt, acoustic")

    parts.append("intimate, male or female vocal")

    return ", ".join(parts)
