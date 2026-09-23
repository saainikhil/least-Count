import React from 'react';
import { PlayerInfo } from '../types/game';

interface ScoreModalProps {
  players: PlayerInfo[];
  completedScores: Record<string, number>[];
  totalRounds?: number;
  onClose: () => void;
}

export const ScoreModal: React.FC<ScoreModalProps> = ({
  players,
  completedScores,
  totalRounds = 10,
  onClose,
}) => {
  const roundCount = Math.max(totalRounds, completedScores.length);
  const roundIndices = Array.from({ length: roundCount }, (_, i) => i);
  const isGameFinished = completedScores.length >= roundCount;

  const totals: Record<string, number> = {};
  for (const p of players) {
    totals[p.id] = 0;
  }
  for (const round of completedScores) {
    for (const p of players) {
      totals[p.id] = (totals[p.id] || 0) + (round[p.id] || 0);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="score-modal" onClick={e => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>
          ✕
        </button>
        <h2>SCOREBOARD</h2>
        <p className="subtitle">
          Completed Rounds History ({completedScores.length}/{roundCount})
        </p>

        <div className="table-wrapper">
          <table className="score-table">
            <thead>
              <tr>
                <th className="round-col-header">ROUND</th>
                {players.map(p => (
                  <th key={p.id} className="player-col-header">
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roundIndices.map(i => (
                <tr key={i}>
                  <td className="round-name">ROUND {i + 1}</td>
                  {players.map(p => {
                    const roundScore = completedScores[i]?.[p.id];
                    return (
                      <td key={p.id} className={roundScore === undefined ? 'empty-round' : ''}>
                        {roundScore !== undefined ? roundScore : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="total-row">
                <td className="total-label">TOTAL</td>
                {players.map(p => (
                  <td key={p.id} className="total-score">
                    {isGameFinished ? totals[p.id] : '—'}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
