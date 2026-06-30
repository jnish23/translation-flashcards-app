# Project: Japanese SRS Translator

## What this is
A personal tool. I ask how to say something in natural Japanese with context, an LLM
returns a few options with nuance notes, and I can save options as SRS flashcards.

## Stack (do not change mid-project)
- React with localStorage for persistence (single-user, personal use)
- Anthropic API for translation, model: claude-sonnet-4-6
- No backend. API key entered by the user in a settings screen, stored in localStorage.

## Card schema (canonical — never deviate without updating this file)
Card {
  id: uuid
  front: string          // English prompt + the context I gave
  back_kanji: string
  back_reading: string   // kana, used for furigana render
  back_romaji: string    // optional
  notes: string          // the nuance explanation from the LLM
  card_type: "production" | "recognition"
  interval: number       // days
  ease_factor: number    // default 2.5
  repetitions: number
  due_date: string       // ISO
  created_at: string     // ISO
}

## SM-2 constants (use exactly these — do not invent values)
- minimum ease factor: 1.3
- after first correct review: interval = 1 day
- after second correct review: interval = 6 days
- subsequent correct reviews: interval = round(previous_interval * ease_factor)
- rating scale maps to SM-2 quality: Again=0, Good=4
- quality < 3 resets repetitions to 0 and interval to 1 day (ease factor still updates)
- ease factor update: EF = EF + (0.1 - (5-q)*(0.08 + (5-q)*0.02)), floored at 1.3

## Due-date rules (decide once, apply everywhere)
- A card is due when due_date <= now (local time, user's timezone)
- A newly created card is due immediately (due_date = created_at)
- Reviews are processed against local midnight boundaries: a card reviewed at
  11pm and due "tomorrow" should NOT reappear until the next calendar day
- The review queue is computed fresh each time the review screen opens

## LLM response format (the translation call must return exactly this JSON)
{
  "options": [
    {
      "kanji": "食べたいです",
      "reading": "たべたいです",
      "romaji": "tabetai desu",
      "register": "polite",
      "notes": "Safe for most contexts with people you don't know well"
    }
  ]
}
Return 3 options. Return ONLY the JSON, no preamble, no markdown fences.

## Working rules for Claude Code
- Read this file before writing any code each session.
- Do not change the stack, schema, or SM-2 constants without me confirming.
- Before fixing a bug in SM-2 or due-date logic, explain what is happening first.
- At the end of each session, summarize the current state of the schema and flag
  any deviation from this file.