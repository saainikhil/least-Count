import React from 'react';
import { Card } from '../components/Card';
import { Card as CardType } from '../types/game';

interface RulesPageProps {
  onBack: () => void;
}

export const RulesPage: React.FC<RulesPageProps> = ({ onBack }) => {
  const cardA: CardType = { id: 'r_a', rank: 'A', suit: 'spades', deckId: 1 };
  const card4: CardType = { id: 'r_4', rank: '4', suit: 'hearts', deckId: 1 };
  const card8: CardType = { id: 'r_8', rank: '8', suit: 'diamonds', deckId: 1 };
  const cardJ: CardType = { id: 'r_j', rank: 'J', suit: 'clubs', deckId: 1 };
  const cardQ: CardType = { id: 'r_q', rank: 'Q', suit: 'spades', deckId: 1 };
  const cardK: CardType = { id: 'r_k', rank: 'K', suit: 'hearts', deckId: 1 };
  const card6: CardType = { id: 'r_6', rank: '6', suit: 'clubs', deckId: 1 };
  const card3: CardType = { id: 'r_3', rank: '3', suit: 'diamonds', deckId: 1 };
  const card9: CardType = { id: 'r_9', rank: '9', suit: 'spades', deckId: 1 };
  const card7: CardType = { id: 'r_7', rank: '7', suit: 'hearts', deckId: 1 };
  const cardQ2: CardType = { id: 'r_q2', rank: 'Q', suit: 'diamonds', deckId: 1 };

  return (
    <main className="app simple-screen rules-screen">
      <button className="back-link" onClick={onBack}>
        ← Back to Main Menu
      </button>

      <div className="friends-heading">
        <h2>Game Rules & Tutorial</h2>
        <span className="connection online">
          <i></i> Comprehensive Least Count Guide
        </span>
      </div>

      <div className="rules-content-wrapper">
        {/* Section 1: How the Game Works */}
        <section className="simple-card rules-card">
          <div className="rules-section-header">
            <span className="rule-badge">1</span>
            <h3>How the Game Works</h3>
          </div>
          <p>
            <strong>Least Count</strong> is a classic strategy card game where the objective is to achieve the
            <strong> LOWEST TOTAL SCORE</strong> at the end of the game. Points in Least Count represent penalties — the player with the lowest cumulative score after all configured rounds wins the game!
          </p>
        </section>

        {/* Section 2: Cards & Point Values */}
        <section className="simple-card rules-card">
          <div className="rules-section-header">
            <span className="rule-badge">2</span>
            <h3>Cards & Point Values</h3>
          </div>
          <p>Each card in the deck carries a point value:</p>
          <ul className="rules-bullets">
            <li><strong>Ace (A)</strong> = 1 Point</li>
            <li><strong>Cards 2 to 9</strong> = Face Value (2 to 9 Points)</li>
            <li><strong>10, Jack (J), Queen (Q), King (K)</strong> = 10 Points each</li>
          </ul>

          <div className="rules-card-demo-row">
            <div className="demo-card-item">
              <Card card={cardA} />
              <span>A = 1 Pt</span>
            </div>
            <div className="demo-card-item">
              <Card card={card4} />
              <span>4 = 4 Pts</span>
            </div>
            <div className="demo-card-item">
              <Card card={card8} />
              <span>8 = 8 Pts</span>
            </div>
            <div className="demo-card-item">
              <Card card={cardJ} />
              <span>J = 10 Pts</span>
            </div>
            <div className="demo-card-item">
              <Card card={cardQ} />
              <span>Q = 10 Pts</span>
            </div>
            <div className="demo-card-item">
              <Card card={cardK} />
              <span>K = 10 Pts</span>
            </div>
          </div>
          <p className="rules-note">
            <em>Important:</em> Although 10, J, Q, and K are all worth 10 points, they are distinct card identities for matching. A Jack matches a Jack, but does NOT match a Queen! Suits (Spades, Hearts, Diamonds, Clubs) do not affect card values or matching.
          </p>
        </section>

        {/* Section 3: Five-Card Hand */}
        <section className="simple-card rules-card">
          <div className="rules-section-header">
            <span className="rule-badge">3</span>
            <h3>Five-Card Hand Example</h3>
          </div>
          <p>Every player starts each round with exactly <strong>5 cards</strong> dealt to their hand.</p>
          <div className="rules-hand-demo">
            <div className="rules-hand-cards">
              <Card card={cardA} />
              <Card card={card4} />
              <Card card={card8} />
              <Card card={cardJ} />
              <Card card={cardQ} />
            </div>
            <div className="rules-calculation">
              <span>Hand Total Calculation:</span>
              <strong>1 + 4 + 8 + 10 + 10 = 33 Points</strong>
            </div>
          </div>
        </section>

        {/* Section 4: The Joker Rule */}
        <section className="simple-card rules-card">
          <div className="rules-section-header">
            <span className="rule-badge">4</span>
            <h3>The Joker Rule</h3>
          </div>
          <p>
            At the start of each round, a <strong>Joker Rank</strong> is randomly drawn (e.g. 6). Every card in the game matching the Joker rank counts as <strong>0 Points</strong>!
          </p>

          <div className="rules-hand-demo">
            <div className="demo-joker-badge">
              <span>ROUND JOKER:</span>
              <Card isJokerDisplay jokerRank="6" />
            </div>
            <div className="rules-hand-cards">
              <Card card={cardA} />
              <Card card={card3} />
              <Card card={card6} isJoker />
              <Card card={card9} />
              <Card card={cardJ} />
            </div>
            <div className="rules-calculation">
              <span>Calculation (Joker = 6):</span>
              <strong>1 + 3 + 0 + 9 + 10 = 23 Points</strong>
            </div>
          </div>
          <p className="rules-note">
            Joker cards retain their rank identity for matching drops (e.g., 6 matches 6).
          </p>
        </section>

        {/* Section 5: The Open Card */}
        <section className="simple-card rules-card">
          <div className="rules-section-header">
            <span className="rule-badge">5</span>
            <h3>The Open Card</h3>
          </div>
          <p>
            A single card is drawn face-up to start the <strong>Discard Pile</strong>. Players can pick the top card of the discard pile on their turn if they choose.
          </p>
          <div className="rules-card-demo-row">
            <div className="demo-card-item">
              <Card card={card9} />
              <span>INITIAL OPEN CARD</span>
            </div>
          </div>
        </section>

        {/* Section 6: Initial Game Setup Sequence */}
        <section className="simple-card rules-card">
          <div className="rules-section-header">
            <span className="rule-badge">6</span>
            <h3>Game Setup Sequence</h3>
          </div>
          <p>Before every round, the designated setup player performs 3 sequential actions:</p>
          <div className="rules-sequence-flow">
            <div className="sequence-step">
              <span className="seq-num">STEP 1</span>
              <b>🔀 SHUFFLE & DISTRIBUTE</b>
              <small>Deals 5 cards per player from 2 standard decks (104 cards)</small>
            </div>
            <div className="seq-arrow">↓</div>
            <div className="sequence-step">
              <span className="seq-num">STEP 2</span>
              <b>🃏 PICK OPEN CARD</b>
              <small>Reveals the initial face-up card for the Discard Pile</small>
            </div>
            <div className="seq-arrow">↓</div>
            <div className="sequence-step">
              <span className="seq-num">STEP 3</span>
              <b>🌟 PICK JOKER CARD</b>
              <small>Draws the card determining the 0-point Joker rank</small>
            </div>
            <div className="seq-arrow">↓</div>
            <div className="sequence-step active-step">
              <b>🚀 ROUND STARTS</b>
            </div>
          </div>
        </section>

        {/* Section 7 & 8: Player Order & Setup Rotation */}
        <section className="simple-card rules-card">
          <div className="rules-section-header">
            <span className="rule-badge">7</span>
            <h3>Player Order & Setup Rotation</h3>
          </div>
          <p>
            Players are assigned a fixed order based on the <strong>original room join order</strong>:
          </p>
          <div className="rules-rotation-box">
            <div className="rotation-item"><strong>Round 1:</strong> Player 1 performs ALL 3 setup steps $\rightarrow$ Plays Round 1</div>
            <div className="rotation-item"><strong>Round 2:</strong> Player 2 performs ALL 3 setup steps $\rightarrow$ Plays Round 2</div>
            <div className="rotation-item"><strong>Round 3:</strong> Player 3 performs ALL 3 setup steps $\rightarrow$ Plays Round 3</div>
            <div className="rotation-item"><strong>Round N:</strong> Rotates to the next player, wrapping around to Player 1!</div>
          </div>
        </section>

        {/* Section 9 & 10: Turn Direction & Starting Player */}
        <section className="simple-card rules-card">
          <div className="rules-section-header">
            <span className="rule-badge">8</span>
            <h3>Turn Direction & First Player</h3>
          </div>
          <p>
            Turns ALWAYS move in clockwise right-side direction:
          </p>
          <div className="rules-turn-diagram">
            <span>Player 1</span> → <span>Player 2</span> → <span>Player 3</span> → <span>Player 4</span> → <span>Player 1</span>
          </div>
          <p>
            After setup finishes, gameplay begins with the player <strong>immediately next to the distributor</strong> according to right turn direction.
          </p>
        </section>

        {/* Section 11 & 12: Discarding & Multiple Matching Drops */}
        <section className="simple-card rules-card">
          <div className="rules-section-header">
            <span className="rule-badge">9</span>
            <h3>Discarding & Multiple Matching Drops</h3>
          </div>
          <p>On your turn, you must drop 1 or more cards of matching rank:</p>
          <div className="rules-hand-demo">
            <div className="rules-hand-cards">
              <Card card={cardA} />
              <Card card={card4} />
              <Card card={cardQ} selected />
              <Card card={cardQ2} selected />
            </div>
            <div className="rules-calculation">
              <span>Drop Action:</span>
              <strong>Drop [Q, Q] together in a single turn!</strong>
            </div>
          </div>
        </section>

        {/* Section 13: Matching Previous Drop Rule */}
        <section className="simple-card rules-card">
          <div className="rules-section-header">
            <span className="rule-badge">10</span>
            <h3>Matching Previous Drop Rule</h3>
          </div>
          <p>
            If the previous player dropped a card (e.g. <strong>Jack</strong>) and you also hold a <strong>Jack</strong>, you can drop your matching Jack immediately without needing to pick up a card!
          </p>
        </section>

        {/* Section 14 & 15: Draw Deck vs Top Discard */}
        <section className="simple-card rules-card">
          <div className="rules-section-header">
            <span className="rule-badge">11</span>
            <h3>Drawing from Deck or Top Discard</h3>
          </div>
          <p>When a pickup is required, you may choose to:</p>
          <div className="rules-piles-demo">
            <div className="demo-pile-item">
              <Card isBack />
              <span>DRAW FROM DECK</span>
              <small>Draw 1 unknown face-down card</small>
            </div>
            <div className="demo-pile-item">
              <Card card={card7} />
              <span>PICK TOP DISCARD</span>
              <small>Pick the legal top face-up card</small>
            </div>
          </div>
        </section>

        {/* Section 16, 17, 18: Least Count Calling, Wrong Call Penalty & Ties */}
        <section className="simple-card rules-card">
          <div className="rules-section-header">
            <span className="rule-badge">12</span>
            <h3>Calling Least Count & Penalties</h3>
          </div>
          <p>
            When your hand total is <strong>5 Points or less</strong>, you can declare <strong>⚡ LEAST COUNT</strong> on your turn!
          </p>

          <div className="rules-outcome-table">
            <div className="outcome-row win">
              <b>✓ CORRECT CALL (LOWEST HAND)</b>
              <p>You have the lowest score. You get <strong>0 Points</strong>! Opponents receive their hand scores.</p>
            </div>
            <div className="outcome-row penalty">
              <b>✕ WRONG CALL (PENALTY)</b>
              <p>If an opponent has an equal or lower score, you get a <strong>50 POINT PENALTY</strong>! Opponents receive their hand scores.</p>
            </div>
            <div className="outcome-row tie">
              <b>🤝 TIE FOR LOWEST</b>
              <p>If another player ties your score, the round continues until a clear winner emerges.</p>
            </div>
          </div>
        </section>

        {/* Section 19: Scoreboard & Final Result */}
        <section className="simple-card rules-card">
          <div className="rules-section-header">
            <span className="rule-badge">13</span>
            <h3>Scoreboard & Final Game Result</h3>
          </div>
          <p>The scoreboard tracks completed rounds (rows) for all players (columns):</p>

          <div className="rules-scoreboard-demo">
            <table>
              <thead>
                <tr>
                  <th>ROUND</th>
                  <th>PLAYER 1</th>
                  <th>PLAYER 2</th>
                  <th>PLAYER 3</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>ROUND 1</td>
                  <td>10</td>
                  <td>5</td>
                  <td>0</td>
                </tr>
                <tr>
                  <td>ROUND 2</td>
                  <td>3</td>
                  <td>7</td>
                  <td>4</td>
                </tr>
                <tr>
                  <td>ROUND 3</td>
                  <td>2</td>
                  <td>8</td>
                  <td>5</td>
                </tr>
                <tr className="total-row">
                  <td>TOTAL</td>
                  <td>15 Pts</td>
                  <td>20 Pts</td>
                  <td className="winner-cell">9 Pts 🏆 (WINNER!)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="rules-note">
            When all configured rounds finish, the player with the <strong>LOWEST CUMULATIVE SCORE WINS THE GAME!</strong>
          </p>
        </section>

        {/* Section 20: Game Modes */}
        <section className="simple-card rules-card">
          <div className="rules-section-header">
            <span className="rule-badge">14</span>
            <h3>Game Modes</h3>
          </div>
          <ul className="rules-bullets">
            <li><strong>PLAY WITH SYSTEM:</strong> Single Player mode against the smart System Bot using 2 standard decks (104 cards).</li>
            <li><strong>PLAY WITH FRIENDS:</strong> Private online multiplayer rooms supporting 2+ players with custom round counts and shareable room links.</li>
          </ul>
        </section>
      </div>

      <div className="rules-footer">
        <button className="cta secondary" onClick={onBack}>
          ✕ CLOSE RULES
        </button>
      </div>
    </main>
  );
};
