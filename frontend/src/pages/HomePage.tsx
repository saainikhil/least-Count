import React from 'react';

interface HomePageProps {
  onSelectSystem: () => void;
  onSelectFriends: () => void;
  onSelectRules: () => void;
  onSelectSettings: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onSelectSystem,
  onSelectFriends,
  onSelectRules,
  onSelectSettings,
}) => {
  return (
    <main className="app home-screen">
      <div className="home-inner">
        <header className="brand">
          <div className="brand-mark">LC</div>
          <div>
            <p className="eyebrow">ONLINE MULTIPLAYER CARD GAME</p>
            <h1>
              Least<br />
              <em>Count</em>
            </h1>
          </div>
        </header>

        <div className="mode-grid">
          <button className="mode-card featured" onClick={onSelectSystem}>
            <span className="mode-icon">♠</span>
            <b>PLAY WITH SYSTEM</b>
            <small>Single Player vs Smart Bot</small>
            <i>→</i>
          </button>

          <button className="mode-card" onClick={onSelectFriends}>
            <span className="mode-icon">♣</span>
            <b>PLAY WITH FRIENDS</b>
            <small>Create or Join a Private Room</small>
            <i>→</i>
          </button>

          <button className="mode-card compact-card" onClick={onSelectRules}>
            <span className="mode-icon">📖</span>
            <b>RULES</b>
            <small>Game Tutorial & Complete Rules</small>
            <i>→</i>
          </button>

          <button className="mode-card compact-card" onClick={onSelectSettings}>
            <span className="mode-icon">⚙</span>
            <b>SETTINGS</b>
            <small>Theme, Fonts & Card Styles</small>
            <i>→</i>
          </button>
        </div>

        <p className="home-note">
          Original physical rules. Pure strategy & low score target.
        </p>
      </div>
    </main>
  );
};
