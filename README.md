# Japanese SRS Translator

A personal Japanese learning tool: translate English into natural Japanese, check your own Japanese attempts, and save useful phrases as SRS flashcards.

It runs as a web/PWA app or a bundled Capacitor Android app. There's no backend, no account, and nothing leaves your machine except the translation request to the LLM provider you choose.

## Why I built it

Translation apps give you *a* translation, but they can often be overly literal and unnatural to how a native speaker would actually say it. This is because context is often critical. Further, they don't give you a way to practice so often times you forget what you looked up and have to look it up again.

I wanted a tool where the context is part of the question, and where the answer goes straight into a study system instead of getting lost in a chat window. I use it for the phrases I actually need, like talking to my son, and that makes it a much better study deck than anything pre-made.

## What it does

- **Japanese feedback.** Enter your own Japanese and get its interpreted English meaning, separate grammar and naturalness assessments, explanations of corrections, and a chunk-by-chunk breakdown of one recommended version. Already-natural wording is confirmed and preserved. Use the optional Context / what I mean box for audience, situation, intended English meaning, or any combination. If it only describes audience/register, the tutor does not invent a meaning comparison.
- **Automatic input routing.** The Learn tab defaults to Auto: kana or kanji selects Japanese checking immediately. For Latin input, the same tutor request distinguishes English from romanized Japanese (romaji) on submission. Romaji attempts are shown in Japanese script alongside the feedback, without rewriting your input as you type. For ambiguous short phrases, Auto prefers English; choose Translate or Check Japanese to override.
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

Tests mock provider responses; they do not send phrases or keys to live providers. They cover task routing, response validation (including incomplete optional meaning comparisons), all three provider adapters, Auto responses, fallback, and saved-card compatibility. The representative feedback fixtures are UI contracts, not a linguistic evaluation of the models.

## What I'd do next

- Broader unit tests for the scheduler
- A small eval set of phrase + context pairs to compare models on register accuracy and naturalness
- Review analytics: retention rate, ease-factor drift, and cards that keep failing
- Optional sync so the deck survives a cleared browser
- Apple app

## Install on your Android phone

1. Install [Android Studio](https://developer.android.com/studio) 2025.2.1 or newer. Let its setup wizard install the Android SDK and bundled JDK. This project uses Capacitor 8.6, Java 21, compile/target SDK 36, minimum SDK 24 (Android 7).
2. In Android Studio → Settings → Android SDK, install Android SDK Platform 36, SDK Build Tools, and Platform Tools. Set Gradle JDK to the bundled JDK (21 or newer).
3. In this project, run `npm ci` then `npm run android:open`. This builds the Android interface, syncs plugins/assets, and opens the native project. Let Gradle finish syncing.
4. On your phone, enable Developer options (tap Build number seven times in Settings → About phone), then enable USB debugging. Connect by USB and accept the debugging authorization on your phone.
5. Choose your phone in Android Studio's device selector and press Run. The app installs with its own launcher icon.

For a transferable debug APK, run `npm run android:debug`. The file is `android/app/build/outputs/apk/debug/app-debug.apk`. On macOS command-line builds may need:

```sh
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$PATH"
npm run android:debug
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Alternatively copy the APK to your phone, open it, and allow installation from that source if Android requests it. USB/Android Studio installation is the recommended development route. Device-managed installation restrictions may vary.

## Move your existing cards

Open the updated web app on the **same URL/browser where your cards are stored**. Settings → Export card backup. Transfer that JSON file to your phone, then in the Android app choose Settings → Import card backup. Every card field, including scheduling history, is preserved. Existing IDs win; duplicates are skipped and counts are shown. Invalid files are rejected before saving. Anki export remains available but is not a full backup.

Browser and Android storage are separate. Enter your provider keys again in Android Settings. Keys are kept in localStorage and sent directly to providers; this is not encrypted secure storage. JSON card backups exclude credentials. Android automatic app backup is disabled to avoid backing up keys. Keep your JSON backups safe: uninstalling or clearing application storage removes local cards and keys.

## Personal release and updates

For a durable personal release, run `npm run android:open`, then Android Studio → Build → Generate Signed App Bundle / APK → APK. Create a keystore **outside this repository**, store its passwords safely, and choose the release build. Keep the keystore backed up: future APKs must use the same application ID and signing key. Increment `versionCode` and `versionName` in `android/app/build.gradle` before releasing an update. Never commit keys, signing passwords, or `local.properties`.

Install signed updates with `adb install -r /absolute/path/to/release.apk`. Debug and release signatures differ, so a first switch from debug to release may require uninstalling the debug app: export your cards first and import them afterward. Android updates require rebuilding and reinstalling; web/PWA service-worker updates do not update the native app.

## Android checks

```sh
npm run android:sync
npx playwright install chromium
npm run test:ui
```

Native HTTP, external links, Back, keyboard insets, offline cold launch and file sharing still require Android device testing.
