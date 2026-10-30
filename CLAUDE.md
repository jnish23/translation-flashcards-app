# Project: Japanese SRS Translator

## What this is
A personal Japanese learning tool. English input returns three natural Japanese
options with nuance notes. Japanese attempts receive an interpreted meaning, grammar
and naturalness feedback, corrections, and a breakdown of one recommended version.
Both tasks can save results as SRS flashcards. Auto routes kana/kanji to checking;
for Latin input the same tutor call distinguishes English from Japanese in romaji.
Explicit Translate and Check Japanese modes override routing. One optional Context /
what I mean box accepts situation notes, intended English, or both. Audience/register
notes alone are not an intended meaning. Explanations are in English.

## Stack (do not change mid-project)
- React with localStorage for persistence (single-user, personal use)
- Translation provider is picked from the user's API key prefix:
  - DeepSeek (`sk-`), model: deepseek-flash — primary; prepaid credits
  - Anthropic (`sk-ant-`), model: claude-sonnet-4-6
  - Google Gemini (anything else), model: gemini-3.1-flash-lite
- No backend. API key entered by the user in a settings screen, stored in localStorage.

## Card schema (canonical — never deviate without updating this file)
Card {
  id: uuid
  prompt: string        // English source phrase or recommendation's English meaning
  context: string       // context supplied, or default "parental casual"
  kanji: string
  reading: string       // kana, used for furigana render
  romaji: string
  register: string
  nuance: string        // short usage note; detailed feedback is not persisted
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

## LLM response formats

The English translation call returns this JSON shape:
{
  "options": [
    {
      "kanji": "食べたいです",
      "reading": "たべたいです",
      "romaji": "tabetai desu",
      "register": "polite",
      "nuance": "Safe for most contexts with people you don't know well"
    }
  ]
}
Return 3 options. Return ONLY the JSON, no preamble, no markdown fences.

Japanese checking uses the separate `JapaneseCheckResponse` in `src/types.ts`:
- `originalJapanese` transcribes the attempt into Japanese script without correcting it; the UI shows it when different from the input.
- `interpretation` and `interpretationNote` state the original meaning and any uncertainty.
- `grammar`, `naturalness`, and `meaningMatch` contain separate verdicts and explanations. An absent or unexplained optional meaning comparison is hidden rather than rejecting otherwise usable feedback.
- `corrections` distinguishes actual errors, naturalness improvements, and optional style.
- `recommendation` contains the translation-option fields plus `english` for the card front.
- `breakdown` contains ordered Japanese chunks, readings, and teaching explanations.

Auto requests return a `{ task: "translate" | "check", response: ... }` envelope
using the chosen task’s response format. Script checking and explicit modes retain
their existing response formats. Detection does not require an additional API call.

Preserve already-natural wording when it matches the supplied intent. Use an empty
corrections array when no change is needed. Both tasks share provider adapters and
fallback behavior. Prompts and runtime response validation live in `src/learning.ts`.
Do not store the detailed teaching response in cards or change the persisted card
schema. No migration is needed for cards created before Japanese checking existed.

## Working rules for Claude Code
- Read this file before writing any code each session.
- Do not change the stack, schema, or SM-2 constants without me confirming.
- Before fixing a bug in SM-2 or due-date logic, explain what is happening first.
- At the end of each session, summarize the current state of the schema and flag
  any deviation from this file.