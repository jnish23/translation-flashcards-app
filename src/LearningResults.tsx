import { useState } from 'react';
import type { TranslationOption, JapaneseCheckResponse } from './types';

export function OptionCard({
  option,
  onSave,
  english,
}: {
  option: TranslationOption;
  onSave: (option: TranslationOption, addRecognition: boolean) => void;
  english?: string;
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
      {english && <p className="option-card__english">{english}</p>}
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

const VERDICTS = {
  correct: 'Correct',
  natural: 'Natural in this context',
  needs_work: 'Needs work',
  uncertain: 'Uncertain',
  matches: 'Matches your intended meaning',
  differs: 'Different from your intended meaning',
  not_provided: 'No intended meaning supplied',
};

const CORRECTION_LABELS = {
  error: 'Correction',
  naturalness: 'More natural phrasing',
  style: 'Optional style choice',
};

export function JapaneseFeedback({ response, onSave }: {
  response: JapaneseCheckResponse;
  onSave: (option: TranslationOption, addRecognition: boolean) => void;
}) {
  return (
    <div className="japanese-feedback">
      <section className="feedback-panel">
        <h3>What your Japanese conveys</h3>
        <p>{response.interpretation}</p>
        {response.interpretationNote && <p className="feedback-note">{response.interpretationNote}</p>}
      </section>

      <section className="feedback-panel">
        <h3>Grammar: {VERDICTS[response.grammar.verdict]}</h3>
        <p>{response.grammar.explanation}</p>
        <h3>Naturalness: {VERDICTS[response.naturalness.verdict]}</h3>
        <p>{response.naturalness.explanation}</p>
        {response.meaningMatch.verdict !== 'not_provided' && (
          <>
            <h3>{VERDICTS[response.meaningMatch.verdict]}</h3>
            <p>{response.meaningMatch.explanation}</p>
          </>
        )}
      </section>

      {response.corrections.length > 0 && (
        <section className="feedback-panel">
          <h3>What changes and why</h3>
          <ul className="feedback-list">
            {response.corrections.map((correction, i) => (
              <li key={i}>
                <span className="feedback-label">{CORRECTION_LABELS[correction.kind]}</span>
                <p className="feedback-change"><span lang="ja">{correction.original}</span> → <span lang="ja">{correction.replacement}</span></p>
                <p>{correction.explanation}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Recommended Japanese">
        <h3 className="feedback-heading">Recommended version</h3>
        <OptionCard option={response.recommendation} english={response.recommendation.english} onSave={onSave} />
      </section>

      <section className="feedback-panel">
        <h3>How this phrase works</h3>
        <ol className="feedback-list">
          {response.breakdown.map((chunk, i) => (
            <li key={i}>
              <p className="feedback-chunk"><strong lang="ja">{chunk.text}</strong> <span lang="ja">{chunk.reading}</span></p>
              <p>{chunk.explanation}</p>
            </li>
          ))}
        </ol>
      </section>
      <p className="input-hint">Saving keeps the English meaning, Japanese, and short usage note. Detailed feedback stays here until your next request.</p>
    </div>
  );
}

