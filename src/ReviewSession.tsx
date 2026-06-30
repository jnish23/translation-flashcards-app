import { useState } from 'react';
import type { Card } from './types';
import { applyRating, getDueCards, type Rating } from './sm2';

function RubyText({ kanji, reading }: { kanji: string; reading: string }) {
  return (
    <ruby>
      {kanji}
      <rt>{reading}</rt>
    </ruby>
  );
}

function JapaneseAnswer({
  card,
  showFurigana,
  onToggleFurigana,
}: {
  card: Card;
  showFurigana: boolean;
  onToggleFurigana: () => void;
}) {
  return (
    <>
      <div className="review-card__japanese">
        {showFurigana ? (
          <RubyText kanji={card.kanji} reading={card.reading} />
        ) : (
          card.kanji
        )}
      </div>
      <button className="furigana-toggle" onClick={onToggleFurigana}>
        {showFurigana ? 'hide furigana' : 'show furigana'}
      </button>
      <p className="review-card__romaji">{card.romaji}</p>
      <span className="review-card__register">{card.register}</span>
      <p className="review-card__nuance">{card.nuance}</p>
    </>
  );
}

export function ReviewSession({
  cards,
  onUpdate,
}: {
  cards: Card[];
  onUpdate: (card: Card) => void;
}) {
  const [queue] = useState<Card[]>(() => getDueCards(cards));
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showFurigana, setShowFurigana] = useState(false);

  const remaining = queue.length - index;

  if (remaining === 0) {
    return (
      <div className="review-empty">
        <div className="review-empty__icon">✓</div>
        <h2>All caught up!</h2>
        <p>No cards due right now.</p>
        {cards.length === 0 && (
          <p className="review-empty__hint">
            Save cards from the Translate tab to start reviewing.
          </p>
        )}
      </div>
    );
  }

  const card = queue[index];
  const isProduction = card.card_type === 'production';

  function handleRate(rating: Rating) {
    onUpdate(applyRating(card, rating));
    setShowAnswer(false);
    setShowFurigana(false);
    setIndex((i) => i + 1);
  }

  return (
    <div className="review-session">
      <div className="review-header">
        <span className={`card-row__type card-row__type--${card.card_type}`}>
          {card.card_type}
        </span>
        <span className="review-counter">{remaining} remaining</span>
      </div>

      <div className="review-card">
        <div className="review-card__front">
          {isProduction ? (
            <>
              <p className="review-card__label">English</p>
              <p className="review-card__prompt">{card.prompt}</p>
              {card.context && (
                <p className="review-card__context">{card.context}</p>
              )}
            </>
          ) : (
            <>
              <p className="review-card__label">Japanese</p>
              <p className="review-card__kanji-front">{card.kanji}</p>
            </>
          )}
        </div>

        {!showAnswer ? (
          <div className="review-card__action">
            <button
              className="show-answer-btn"
              onClick={() => setShowAnswer(true)}
            >
              Show answer
            </button>
          </div>
        ) : (
          <>
            <hr className="review-card__divider" />

            <div className="review-card__back">
              {isProduction ? (
                <JapaneseAnswer
                  card={card}
                  showFurigana={showFurigana}
                  onToggleFurigana={() => setShowFurigana((f) => !f)}
                />
              ) : (
                <>
                  <p className="review-card__prompt">{card.prompt}</p>
                  {card.context && (
                    <p className="review-card__context">{card.context}</p>
                  )}
                  <hr className="review-card__inner-divider" />
                  <JapaneseAnswer
                    card={card}
                    showFurigana={showFurigana}
                    onToggleFurigana={() => setShowFurigana((f) => !f)}
                  />
                </>
              )}
            </div>

            <div className="review-rating">
              <button
                className="rating-btn rating-btn--again"
                onClick={() => handleRate('again')}
              >
                Again
              </button>
              <button
                className="rating-btn rating-btn--good"
                onClick={() => handleRate('good')}
              >
                Good
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
