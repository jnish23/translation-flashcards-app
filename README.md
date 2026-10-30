# Japanese SRS Translator

A personal Japanese learning tool: translate English into natural Japanese, check your own Japanese attempts, and save useful phrases as SRS flashcards.

It runs entirely in the browser, which you can access as an app on Android. There's no backend, no account, and nothing leaves your machine except the translation request to the LLM provider you choose.

## Why I built it

Translation apps give you *a* translation, but they can often be overly literal and unnatural to how a native speaker would actually say it. This is because context is often critical. Further, they don't give you a way to practice so often times you forget what you looked up and have to look it up again.

I wanted a tool where the context is part of the question, and where the answer goes straight into a study system instead of getting lost in a chat window. I use it for the phrases I actually need, like talking to my son, and that makes it a much better study deck than anything pre-made.

## What it does

- **Japanese feedback.** Enter your own Japanese and get its interpreted English meaning, separate grammar and naturalness assessments, explanations of corrections, and a chunk-by-chunk breakdown of one recommended version. Already-natural wording is confirmed and preserved. Optionally provide what you meant in English to check whether your attempt conveys it.
- **Automatic input routing.** The Learn tab defaults to Auto: kana or kanji selects Japanese checking; other input selects translation. Choose Translate or Check Japanese explicitly for romaji or mixed input.
- **Context-aware translation.** Each query takes the phrase plus a context line (who, where, how formal). The default context is "parental casual", since that's my most common situation.
- **Three options, not one.** Options differ in register and nuance on purpose, and each comes with an explanation.
- **Save as flashcards.** Japanese checks save the recommendation’s English meaning on the front and natural Japanese plus a short usage note on the back. Detailed teaching stays in the current result until the next request; it is not stored. Save a translation option as a production card (English → Japanese), and optionally add a recognition card (Japanese → English) for the same phrase.
- **Spaced-repetition review.** Cards are scheduled with SM-2. Furigana renders over kanji and can be toggled off to test yourself.
- **Searchable phrase library.** Search across English, kanji, reading, romaji, and context. Matching is Unicode-normalized, so full-width and half-width input both work.
- **Anki export.** Export the deck as a tab-separated file you can import into Anki.
- **Installable and offline-capable.** It's a PWA, so reviews work offline straight from local storage.
- **Multi-provider with automatic fallback.** Paste a key from DeepSeek, Anthropic, or Google Gemini. The provider is detected from the key prefix. You can add a backup key, and if the primary provider is down, rate-limited, or out of credit, the request retries on the backup.


**Implementing an algorithm from its spec.**
- SM-2 is implemented from scratch in [`src/sm2.ts`](src/sm2.ts) with fixed constants (ease floor of 1.3, 1-day then 6-day first intervals, quality mapped from a two-button Again/Good scale).
- The review queue is recomputed fresh each time the review screen opens, so there's no stale state to drift out of sync.

**Stack:** TypeScript, React 19, Vite, vite-plugin-pwa (Workbox), Anthropic and Google Generative AI SDKs, plain `fetch` for DeepSeek, Oxlint.

## Run it locally

```bash
git clone https://github.com/jnish23/translation-flashcards-app.git
cd translation-flashcards-app
npm install
npm run dev
```

Open the app, go to **Settings**, and paste an API key. The key is stored in your browser's `localStorage` and only sent to the provider it belongs to.

| Key prefix | Provider | Model |
| --- | --- | --- |
| `sk-` | DeepSeek | `deepseek-flash` |
| `sk-ant-` | Anthropic | `claude-sonnet-4-6` |
| anything else | Google Gemini | `gemini-3.1-flash-lite` |

To try the Progressive Web App (PWA) and offline behavior, use a production build, since the service worker is intentionally off in dev:

```bash
npm run build
npm run preview
```

## Project layout

```
src/
  translate.ts     # shared provider adapters and fallback for both learning tasks
  learning.ts      # input routing, tutor prompts, task-specific response validation
  LearningResults.tsx # saveable translation options and Japanese teaching feedback
  cards.ts         # existing card creation format and scheduling defaults
  sm2.ts           # SM-2 scheduling and due-card selection
  storage.ts       # localStorage persistence for cards
  exportAnki.ts    # TSV export for Anki
  App.tsx          # learn / deck / review / phrases / settings views
  ReviewSession.tsx# review flow with furigana rendering
  types.ts         # Card, task, translation, and Japanese-check response types
```

## Checks

Use Node.js 24 or later (the tests use Node’s built-in TypeScript support and test runner):

```bash
npm test
npm run lint
npm run build
```

Tests mock provider responses; they do not send phrases or keys to live providers. They cover task routing, response validation, all three provider adapters, fallback for both tasks, and saved-card compatibility. The representative feedback fixtures are UI contracts, not a linguistic evaluation of the models.

## What I'd do next

- Broader unit tests for the scheduler
- A small eval set of phrase + context pairs to compare models on register accuracy and naturalness
- Review analytics: retention rate, ease-factor drift, and cards that keep failing
- Optional sync so the deck survives a cleared browser
- Android/Apple app 