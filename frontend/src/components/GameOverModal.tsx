import React from 'react';
import { PlayerInfo } from '../types/game';

interface GameOverModalProps {
  players: PlayerInfo[];
  completedScores: Record<string, number>[];
  onReturnToHome: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({ players, completedScores, onReturnToHome }) => {
  const totals: Record<string, number> = {};
  for (const p of players) {
    totals[p.id] = 0;
  }
  for (const round of completedScores) {
    for (const p of players) {
      totals[p.id] = (totals[p.id] || 0) + (round[p.id] || 0);
    }
  }

  // Sort players by total score ascending (lowest score = winner)
  const ranked = [...players].sort((a, b) => (totals[a.id] || 0) - (totals[b.id] || 0));
  const winner = ranked[0];
  const loser = ranked[ranked.length - 1];

  return (
    <div className="modal-backdrop">
      <div className="game-over-modal">
        <div className="trophy-header">🏆</div>
        <h1>GAME COMPLETE</h1>
        <p className="winner-announcement">
          <strong>{winner?.name}</strong> WINS THE GAME!
        </p>

        <div className="final-scoreboard">
          <h3>FINAL CUMULATIVE SCORES</h3>
          <table className="score-table">
            <thead>
              <tr>
                <th>RANK</th>
                <th>PLAYER</th>
                <th>CUMULATIVE SCORE</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((p, index) => (
                <tr key={p.id} className={p.id === winner?.id ? 'winner-row' : p.id === loser?.id ? 'loser-row' : ''}>
                  <td className="rank-col">#{index + 1}</td>
                  <td className="player-name">
                    {p.name} {p.id === winner?.id && '👑 (WINNER)'} {p.id === loser?.id && '💀 (LOSER)'}
                  </td>
                  <td className="total-score">{totals[p.id]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button className="cta" onClick={onReturnToHome}>
          MAIN MENU
        </button>
      </div>
    </div>
  );
};
