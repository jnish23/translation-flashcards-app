import { useRef, useState } from 'react';
import {
  translateWithFallback,
  validateApiKey,
  detectProvider,
  PROVIDER_LABEL,
} from './translate';
import type { TranslationOption, Card } from './types';
import { loadCards, persistCard, removeCard, updateCard } from './storage';
import { getDueCards } from './sm2';
import { ReviewSession } from './ReviewSession';
import { exportToAnki } from './exportAnki';
import './App.css';

// The primary key keeps the original storage name, so a key saved before
// backups existed carries over as the primary.
const API_KEY_STORAGE = 'apiKey';
const BACKUP_KEY_STORAGE = 'apiKeyBackup';

// Used whenever the context box is left empty. Applied when translating rather
// than pre-filled, so clearing the box still falls back to it.
const DEFAULT_CONTEXT = 'parental casual';

function readKeys(): { primary: string | null; backup: string | null } {
  const primary = localStorage.getItem(API_KEY_STORAGE);
  const backup = localStorage.getItem(BACKUP_KEY_STORAGE);
  // With only a backup saved, it does the primary's job.
  return primary ? { primary, backup } : { primary: backup, backup: null };
}

function makeCard(
  option: TranslationOption,
  prompt: string,
  context: string,
  card_type: 'production' | 'recognition',
): Card {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    card_type,
    prompt,
    context,
    kanji: option.kanji,
    reading: option.reading,
    romaji: option.romaji,
    register: option.register,
    nuance: option.nuance,
    repetitions: 0,
    ease_factor: 2.5,
    interval: 0,
    due_date: now,
    created_at: now,
  };
}

function OptionCard({
  option,
  onSave,
}: {
  option: TranslationOption;
  onSave: (option: TranslationOption, addRecognition: boolean) => void;
}) {
  const [addRecognition, setAddRecognition] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  function handleSave() {
    onSave(option, addRecognition);
    setFlash(addRecognition ? 'Saved 2 cards!' : 'Saved!');
    setTimeout(() => setFlash(null), 1800);
  }

  return (
    <div className="option-card">
      <div className="option-card__japanese">
        <span className="option-card__kanji">{option.kanji}</span>
        <span className="option-card__reading">{option.reading}</span>
      </div>
      <div className="option-card__romaji">{option.romaji}</div>
      <span className="option-card__register">{option.register}</span>
      <p className="option-card__nuance">{option.nuance}</p>
      <div className="option-card__actions">
        <label className="recognition-check">
          <input
            type="checkbox"
            checked={addRecognition}
            onChange={(e) => setAddRecognition(e.target.checked)}
          />
          also add recognition card
        </label>
        <button className="save-btn" onClick={handleSave} disabled={flash !== null}>
          {flash ?? 'Save'}
        </button>
      </div>
    </div>
  );
}

function DeckView({
  cards,
  onDelete,
}: {
  cards: Card[];
  onDelete: (id: string) => void;
}) {
  if (cards.length === 0) {
    return (
      <div className="deck-empty">
        <p>No cards saved yet.</p>
        <p className="deck-empty__hint">Translate a phrase and hit Save to add your first card.</p>
      </div>
    );
  }

  return (
    <div className="deck-view">
      <div className="deck-header">
        <p className="deck-count">
          {cards.length} card{cards.length !== 1 ? 's' : ''}
        </p>
        <button className="export-btn" onClick={() => exportToAnki(cards)}>
          Export to Anki
        </button>
      </div>
      <ul className="card-list">
        {cards.map((card) => (
          <li key={card.id} className="card-row">
            <div className="card-row__main">
              <span
                className={`card-row__type card-row__type--${card.card_type}`}
              >
                {card.card_type}
              </span>
              <span className="card-row__kanji">{card.kanji}</span>
              <span className="card-row__prompt">{card.prompt}</span>
            </div>
            <button
              className="card-row__delete"
              onClick={() => onDelete(card.id)}
              aria-label={`Delete card for ${card.kanji}`}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Lowercased and NFKC-normalised so full-width and half-width forms, and
// letter case, don't stop a search from matching.
function normalizeForSearch(text: string): string {
  return text.normalize('NFKC').toLowerCase();
}

function phraseMatches(card: Card, tokens: string[]): boolean {
  const haystack = normalizeForSearch(
    [card.prompt, card.kanji, card.reading, card.romaji, card.context].join('\n'),
  );
  // Every word must appear somewhere, in any order.
  return tokens.every((t) => haystack.includes(t));
}

function PhrasesView({ cards, onDelete }: { cards: Card[]; onDelete: (prompt: string, kanji: string) => void }) {
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const seen = new Map<string, Card>();
  for (const card of cards) {
    const key = `${card.prompt}|||${card.kanji}`;
    const existing = seen.get(key);
    if (!existing || card.created_at < existing.created_at) {
      seen.set(key, card);
    }
  }

  const phrases = Array.from(seen.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  if (phrases.length === 0) {
    return (
      <div className="deck-empty">
        <p>No phrases saved yet.</p>
        <p className="deck-empty__hint">Translate a phrase and hit Save to add your first card.</p>
      </div>
    );
  }

  const tokens = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  const visible = tokens.length ? phrases.filter((card) => phraseMatches(card, tokens)) : phrases;

  return (
    <div className="phrases-view">
      <div className="phrase-search">
        <input
          ref={searchRef}
          type="search"
          className="phrase-search__input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setQuery('');
          }}
          placeholder="Search English, Japanese, romaji, or context"
          aria-label="Search phrases"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
        />
        {query && (
          <button
            type="button"
            className="phrase-search__clear"
            onClick={() => {
              setQuery('');
              // The next thing after clearing is typing a new search.
              searchRef.current?.focus();
            }}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      <p className="deck-count">
        {tokens.length
          ? `${visible.length} of ${phrases.length} phrase${phrases.length !== 1 ? 's' : ''}`
          : `${phrases.length} phrase${phrases.length !== 1 ? 's' : ''}`}
      </p>

      {visible.length === 0 && (
        <div className="deck-empty">
          <p>No phrases match “{query.trim()}”.</p>
        </div>
      )}

      <ul className="phrase-list">
        {visible.map((card) => (
          <li key={`${card.prompt}|||${card.kanji}`} className="phrase-row">
            <span className="phrase-row__english">{card.prompt}</span>
            <div className="phrase-row__japanese">
              <span className="phrase-row__kanji">{card.kanji}</span>
              <span className="phrase-row__reading">{card.reading}</span>
            </div>
            <button
              className="card-row__delete"
              onClick={() => onDelete(card.prompt, card.kanji)}
              aria-label={`Delete phrase ${card.prompt}`}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function KeyField({
  id,
  label,
  optional,
  hint,
  placeholder,
  storageKey,
  otherStorageKey,
  otherLabel,
  onKeyChange,
}: {
  id: string;
  label: string;
  optional?: boolean;
  hint?: string;
  placeholder: string;
  storageKey: string;
  otherStorageKey: string;
  otherLabel: string;
  onKeyChange: () => void;
}) {
  const [input, setInput] = useState(() => localStorage.getItem(storageKey) ?? '');
  const [isSaved, setIsSaved] = useState(() => !!localStorage.getItem(storageKey));
  const [status, setStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const trimmed = input.trim();
  const provider = trimmed ? detectProvider(trimmed) : null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (trimmed === localStorage.getItem(otherStorageKey)) {
      setStatus('error');
      setMessage(`This is already saved as your ${otherLabel.toLowerCase()}.`);
      return;
    }

    setStatus('checking');
    setMessage('');
    try {
      await validateApiKey(trimmed);
      localStorage.setItem(storageKey, trimmed);
      setIsSaved(true);
      onKeyChange();
      setStatus('ok');
      setMessage(`${PROVIDER_LABEL[detectProvider(trimmed)]} key verified and saved.`);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }

  function handleRemove() {
    localStorage.removeItem(storageKey);
    setInput('');
    setIsSaved(false);
    setStatus('idle');
    setMessage('');
    onKeyChange();
  }

  return (
    <form className="settings-form settings-key-field" onSubmit={handleSave}>
      <label htmlFor={id} className="input-label">
        {label}
        {optional && <span className="optional-tag">optional</span>}
        {provider && <span className="provider-badge">{PROVIDER_LABEL[provider]}</span>}
      </label>
      {hint && <p className="settings-hint">{hint}</p>}

      <input
        id={id}
        type="password"
        className="settings-input"
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          setStatus('idle');
          setMessage('');
        }}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />

      <div className="settings-actions">
        <button
          className="translate-btn settings-save-btn"
          type="submit"
          disabled={!trimmed || status === 'checking'}
        >
          {status === 'checking' ? 'Checking…' : 'Verify & save'}
        </button>
        {isSaved && (
          <button type="button" className="settings-remove-btn" onClick={handleRemove}>
            Remove key
          </button>
        )}
      </div>

      {message && (
        <p className={`settings-status settings-status--${status}`} role="status">
          {message}
        </p>
      )}
    </form>
  );
}

function SettingsView({ onKeyChange }: { onKeyChange: () => void }) {
  return (
    <div className="settings-view">
      <h2 className="settings-heading">Settings</h2>

      <p className="settings-hint">
        Translations run on your own API key, so you'll need one of these. Keys
        are stored only in this browser and go straight to the provider — they
        are never sent anywhere else.
      </p>

      <ul className="key-sources">
        <li>
          <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer">
            DeepSeek Platform
          </a>
          <span className="key-sources__note">
            Starts with <code>sk-</code>. Prepaid and very cheap — a few dollars
            lasts a long time for this app.
          </span>
        </li>
        <li>
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
            Google AI Studio
          </a>
          <span className="key-sources__note">
            Free tier, no credit card, but often overloaded. A good backup.
          </span>
        </li>
        <li>
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
            Anthropic Console
          </a>
          <span className="key-sources__note">
            Starts with <code>sk-ant-</code>. Pay-as-you-go, needs credit up front.
          </span>
        </li>
      </ul>

      <KeyField
        id="api-key"
        label="Primary key"
        placeholder="Paste a DeepSeek, Gemini, or Anthropic key"
        storageKey={API_KEY_STORAGE}
        otherStorageKey={BACKUP_KEY_STORAGE}
        otherLabel="Backup key"
        onKeyChange={onKeyChange}
      />
      <KeyField
        id="api-key-backup"
        label="Backup key"
        optional
        hint="Used automatically when the primary provider is down, rate-limited, or out of credit."
        placeholder="e.g. a free Gemini key"
        storageKey={BACKUP_KEY_STORAGE}
        otherStorageKey={API_KEY_STORAGE}
        otherLabel="Primary key"
        onKeyChange={onKeyChange}
      />
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<'translate' | 'deck' | 'review' | 'phrases' | 'settings'>('translate');
  const [phrase, setPhrase] = useState('');
  const [context, setContext] = useState('');
  const [options, setOptions] = useState<TranslationOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<Card[]>(() => loadCards());
  const [hasKey, setHasKey] = useState(() => !!readKeys().primary);
  // Set when the backup key answered because the primary provider failed.
  const [fallback, setFallback] = useState<{ from: string; to: string; reason: string } | null>(null);
  // What the options on screen were actually generated from. Kept separate
  // from the inputs, which are cleared for the next phrase while the results
  // are still on screen and savable.
  const [submitted, setSubmitted] = useState<{ phrase: string; context: string } | null>(null);

  async function handleTranslate() {
    if (!phrase.trim()) return;

    const { primary, backup } = readKeys();
    if (!primary) {
      setView('settings');
      return;
    }

    setLoading(true);
    setError(null);
    setOptions([]);
    setFallback(null);

    const effectiveContext = context.trim() || DEFAULT_CONTEXT;

    try {
      const outcome = await translateWithFallback(phrase, effectiveContext, primary, backup);
      setOptions(outcome.response.options);
      setFallback(
        outcome.fallback
          ? {
              from: PROVIDER_LABEL[outcome.fallback.from],
              to: PROVIDER_LABEL[outcome.provider],
              reason: outcome.fallback.reason,
            }
          : null,
      );
      setSubmitted({ phrase: phrase.trim(), context: effectiveContext });
      // Only the phrase is cleared: a run of phrases usually shares one
      // context, so it stays until explicitly cleared.
      setPhrase('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleTranslate();
    }
  }

  function handleSave(option: TranslationOption, addRecognition: boolean) {
    if (!submitted) return;
    let updated = persistCard(
      makeCard(option, submitted.phrase, submitted.context, 'production'),
    );
    if (addRecognition) {
      updated = persistCard(
        makeCard(option, submitted.phrase, submitted.context, 'recognition'),
      );
    }
    setCards(updated);
  }

  function handleDelete(id: string) {
    setCards(removeCard(id));
  }

  function handleDeletePhrase(prompt: string, kanji: string) {
    const ids = cards.filter((c) => c.prompt === prompt && c.kanji === kanji).map((c) => c.id);
    let updated = cards;
    for (const id of ids) {
      updated = removeCard(id);
    }
    setCards(updated);
  }

  function handleUpdate(card: Card) {
    setCards(updateCard(card));
  }

  const dueCount = getDueCards(cards).length;

  return (
    <div className="app">
      <header className="app__header">
        <h1>Japanese Flashcards</h1>
        <nav className="app__nav">
          <button
            className={`nav-tab${view === 'translate' ? ' nav-tab--active' : ''}`}
            onClick={() => setView('translate')}
          >
            Translate
          </button>
          <button
            className={`nav-tab${view === 'deck' ? ' nav-tab--active' : ''}`}
            onClick={() => setView('deck')}
          >
            Deck
            {cards.length > 0 && (
              <span className="nav-tab__badge">{cards.length}</span>
            )}
          </button>
          <button
            className={`nav-tab${view === 'review' ? ' nav-tab--active' : ''}`}
            onClick={() => setView('review')}
          >
            Review
            {dueCount > 0 && (
              <span className="nav-tab__badge nav-tab__badge--due">{dueCount}</span>
            )}
          </button>
          <button
            className={`nav-tab${view === 'phrases' ? ' nav-tab--active' : ''}`}
            onClick={() => setView('phrases')}
          >
            Phrases
          </button>
          <button
            className={`nav-tab${view === 'settings' ? ' nav-tab--active' : ''}`}
            onClick={() => setView('settings')}
          >
            Settings
          </button>
        </nav>
      </header>

      <main className="app__main">
        {view === 'translate' && (
          <>
            {!hasKey && (
              <div className="setup-callout">
                <strong className="setup-callout__title">One-time setup</strong>
                <p className="setup-callout__body">
                  Translations run on your own API key — DeepSeek, Google
                  Gemini, or Anthropic. It takes about a minute to create one.
                </p>
                <button
                  className="setup-callout__btn"
                  onClick={() => setView('settings')}
                >
                  Add API key
                </button>
              </div>
            )}

            <section className="input-section">
              <label htmlFor="phrase" className="input-label">
                What do you want to say?
              </label>
              <textarea
                id="phrase"
                className="input-textarea"
                placeholder="e.g. I'm sorry for the late reply"
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={3}
              />

              <div className="input-label-row">
                <label htmlFor="context" className="input-label">
                  Context{' '}
                  <span className="optional-tag">optional</span>
                </label>
                {context.trim() && (
                  <button
                    type="button"
                    className="clear-context-btn"
                    onClick={() => setContext('')}
                  >
                    Clear
                  </button>
                )}
              </div>
              <textarea
                id="context"
                className="input-textarea input-textarea--context"
                placeholder={`Empty = “${DEFAULT_CONTEXT}”. Or e.g. email to my boss`}
                value={context}
                onChange={(e) => setContext(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
              />

              <div className="translate-row">
                <button
                  className="translate-btn"
                  onClick={handleTranslate}
                  disabled={loading || !phrase.trim()}
                >
                  {loading ? 'Translating…' : 'Translate'}
                </button>
                <span className="keyboard-hint">⌘↵ to translate</span>
              </div>
            </section>

            {error && (
              <div className="error-box" role="alert">
                <strong>Error</strong>
                <pre>{error}</pre>
              </div>
            )}

            {options.length > 0 && submitted && (
              <section className="results-section">
                <h2 className="results-heading">3 Options</h2>
                {/* The phrase box is cleared on submit, so echo back what
                    these options were generated from. */}
                <p className="results-prompt">
                  {submitted.phrase}
                  {submitted.context && (
                    <span className="results-prompt__context">
                      {submitted.context}
                    </span>
                  )}
                </p>
                {fallback && (
                  <p className="fallback-note" role="status">
                    Answered by {fallback.to} (backup) — {fallback.from} was{' '}
                    {fallback.reason}.
                  </p>
                )}
                <div className="options-grid">
                  {options.map((opt, i) => (
                    <OptionCard key={i} option={opt} onSave={handleSave} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {view === 'deck' && (
          <DeckView cards={cards} onDelete={handleDelete} />
        )}

        {view === 'review' && (
          <ReviewSession cards={cards} onUpdate={handleUpdate} />
        )}

        {view === 'phrases' && (
          <PhrasesView cards={cards} onDelete={handleDeletePhrase} />
        )}

        {view === 'settings' && (
          <SettingsView onKeyChange={() => setHasKey(!!readKeys().primary)} />
        )}
      </main>
    </div>
  );
}
