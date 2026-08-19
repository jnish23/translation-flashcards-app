import { useState } from 'react';
import {
  translate,
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

const API_KEY_STORAGE = 'apiKey';

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

function PhrasesView({ cards, onDelete }: { cards: Card[]; onDelete: (prompt: string, kanji: string) => void }) {
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

  return (
    <div className="phrases-view">
      <p className="deck-count">
        {phrases.length} phrase{phrases.length !== 1 ? 's' : ''}
      </p>
      <ul className="phrase-list">
        {phrases.map((card) => (
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

function SettingsView({
  hasKey,
  onKeyChange,
}: {
  hasKey: boolean;
  onKeyChange: () => void;
}) {
  const [input, setInput] = useState(() => localStorage.getItem(API_KEY_STORAGE) ?? '');
  const [status, setStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const trimmed = input.trim();
  const provider = trimmed ? detectProvider(trimmed) : null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setStatus('checking');
    setMessage('');

    try {
      await validateApiKey(trimmed);
      localStorage.setItem(API_KEY_STORAGE, trimmed);
      onKeyChange();
      setStatus('ok');
      setMessage(`${PROVIDER_LABEL[detectProvider(trimmed)]} key verified and saved.`);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }

  function handleRemove() {
    localStorage.removeItem(API_KEY_STORAGE);
    setInput('');
    setStatus('idle');
    setMessage('');
    onKeyChange();
  }

  return (
    <div className="settings-view">
      <h2 className="settings-heading">Settings</h2>

      <form className="settings-form" onSubmit={handleSave}>
        <label htmlFor="api-key" className="input-label">
          API Key
          {provider && (
            <span className="provider-badge">{PROVIDER_LABEL[provider]}</span>
          )}
        </label>

        <p className="settings-hint">
          Translations run on your own API key, so you'll need one of these. The
          key is stored only in this browser and goes straight to the provider —
          it is never sent anywhere else.
        </p>

        <ul className="key-sources">
          <li>
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
              Google AI Studio
            </a>
            <span className="key-sources__note">
              Free tier, no credit card. Easiest place to start.
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

        <input
          id="api-key"
          type="password"
          className="settings-input"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setStatus('idle');
            setMessage('');
          }}
          placeholder="Paste a Gemini or Anthropic key"
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
          {hasKey && (
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
  const [hasKey, setHasKey] = useState(() => !!localStorage.getItem(API_KEY_STORAGE));
  // What the options on screen were actually generated from. Kept separate
  // from the inputs, which are cleared for the next phrase while the results
  // are still on screen and savable.
  const [submitted, setSubmitted] = useState<{ phrase: string; context: string } | null>(null);

  async function handleTranslate() {
    if (!phrase.trim()) return;

    const apiKey = localStorage.getItem(API_KEY_STORAGE);
    if (!apiKey) {
      setView('settings');
      return;
    }

    setLoading(true);
    setError(null);
    setOptions([]);

    try {
      const result = await translate(phrase, context, apiKey);
      setOptions(result.options);
      setSubmitted({ phrase: phrase.trim(), context: context.trim() });
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
                  Translations run on your own API key. A Google Gemini key is
                  free and takes about a minute to create.
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
                placeholder="e.g. email to my boss · casual chat with a friend · formal written document"
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
          <SettingsView
            hasKey={hasKey}
            onKeyChange={() => setHasKey(!!localStorage.getItem(API_KEY_STORAGE))}
          />
        )}
      </main>
    </div>
  );
}
