import React from 'react';

interface SettingsPageProps {
  theme: string;
  font: string;
  cardStyle: string;
  soundEnabled?: boolean;
  onThemeChange: (t: string) => void;
  onFontChange: (f: string) => void;
  onCardStyleChange: (c: string) => void;
  onSoundChange?: (enabled: boolean) => void;
  onBack: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  theme,
  font,
  cardStyle,
  soundEnabled = true,
  onThemeChange,
  onFontChange,
  onCardStyleChange,
  onSoundChange,
  onBack,
}) => {
  return (
    <main className="app simple-screen">
      <button className="back-link" onClick={onBack}>
        ← Back to Main Menu
      </button>

      <div className="simple-card settings-card">
        <h2>Settings</h2>

        {/* Sound Effects */}
        <label className="toggle-label settings-toggle-label">
          <input
            type="checkbox"
            checked={soundEnabled}
            onChange={e => onSoundChange?.(e.target.checked)}
            className="toggle-checkbox"
            aria-label="Sound Effects"
          />
          <span className="toggle-text">
            Sound Effects
            <small>{soundEnabled ? 'Enabled — will play when implemented' : 'Disabled'}</small>
          </span>
        </label>

        <label>
          THEME
          <select value={theme} onChange={e => onThemeChange(e.target.value)}>
            <option value="Green">Card Table Green (Default)</option>
            <option value="Light">Light Felt</option>
            <option value="Dark">Midnight Dark</option>
          </select>
        </label>

        <label>
          FONT
          <select value={font} onChange={e => onFontChange(e.target.value)}>
            <option value="DM Sans">DM Sans</option>
            <option value="Inter">Inter</option>
            <option value="Poppins">Poppins</option>
            <option value="Roboto">Roboto</option>
            <option value="System">System Default</option>
          </select>
        </label>

        <label>
          CARD STYLE
          <select value={cardStyle} onChange={e => onCardStyleChange(e.target.value)}>
            <option value="Classic">Classic Traditional</option>
            <option value="Modern">Modern Rounded</option>
            <option value="Minimal">Minimal Flat</option>
          </select>
        </label>
      </div>
    </main>
  );
};
