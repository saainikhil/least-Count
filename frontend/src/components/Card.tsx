import React from 'react';
import { Card as CardType, Rank } from '../types/game';

interface CardProps {
  card?: CardType;
  isBack?: boolean;
  selected?: boolean;
  isJoker?: boolean;
  isJokerDisplay?: boolean;
  jokerRank?: Rank;
  disabled?: boolean;
  onClick?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
}

const SUIT_GLYPHS: Record<string, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

const SUIT_COLORS: Record<string, string> = {
  spades: 'black',
  clubs: 'black',
  hearts: 'red',
  diamonds: 'red',
};

export const Card: React.FC<CardProps> = ({
  card,
  isBack = false,
  selected = false,
  isJoker = false,
  isJokerDisplay = false,
  jokerRank,
  disabled = false,
  onClick,
  onDragStart,
}) => {
  if (isJokerDisplay) {
    return (
      <div className="card joker-display-card" onClick={disabled ? undefined : onClick}>
        <div className="card-corner top-left">
          <span className="card-rank">{jokerRank || '?'}</span>
          <span className="card-suit">★</span>
        </div>
        <div className="card-center-joker">
          <span className="joker-star">★</span>
          <span className="joker-title">JOKER</span>
        </div>
        <div className="card-corner bottom-right">
          <span className="card-rank">{jokerRank || '?'}</span>
          <span className="card-suit">★</span>
        </div>
        <span className="joker-badge">0 PTS</span>
      </div>
    );
  }

  if (isBack) {
    return (
      <div className="card card-back" onClick={disabled ? undefined : onClick}>
        <div className="card-back-pattern">
          <span>LC</span>
        </div>
      </div>
    );
  }

  if (!card) {
    return <div className="card card-placeholder">Empty</div>;
  }

  const isRed = SUIT_COLORS[card.suit] === 'red';

  return (
    <div
      className={`card ${isRed ? 'red' : 'black'} ${selected ? 'selected' : ''} ${isJoker ? 'joker-card' : ''
        } ${disabled ? 'disabled' : ''}`}
      onClick={disabled ? undefined : onClick}
      draggable={!disabled && !!onDragStart}
      onDragStart={onDragStart}
    >
      <div className="card-corner top-left">
        <span className="card-rank">{card.rank}</span>
        <span className="card-suit">{SUIT_GLYPHS[card.suit]}</span>
      </div>
      <div className="card-center-suit">{SUIT_GLYPHS[card.suit]}</div>
      <div className="card-corner bottom-right">
        <span className="card-rank">{card.rank}</span>
        <span className="card-suit">{SUIT_GLYPHS[card.suit]}</span>
      </div>
      {isJoker && <span className="joker-badge">0 PTS</span>}
    </div>
  );
};
