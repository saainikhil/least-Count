import React from 'react';

interface SettingsPageProps {
  theme: string;
  font: string;
  cardStyle: string;
  // soundEnabled?: boolean; // [SOUND_FEATURE_DISABLED]
  onThemeChange: (t: string) => void;
  onFontChange: (f: string) => void;
  onCardStyleChange: (c: string) => void;
  // onSoundChange?: (enabled: boolean) => void; // [SOUND_FEATURE_DISABLED]
  onBack: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  theme,
  font,
  cardStyle,
  // soundEnabled, // [SOUND_FEATURE_DISABLED]
  onThemeChange,
  onFontChange,
  onCardStyleChange,
  // onSoundChange, // [SOUND_FEATURE_DISABLED]
  onBack,
}) => {
  return (
    <main className="app simple-screen">
      <button className="back-link" onClick={onBack}>
        ← Back to Main Menu
      </button>

      <div className="simple-card settings-card">
        <h2>Settings</h2>

        {/* [SOUND_FEATURE_DISABLED]
        <label>
          SOUND EFFECTS
          <select value={soundEnabled ? 'ON' : 'OFF'} onChange={e => onSoundChange?.(e.target.value === 'ON')}>
            <option value="ON">ON (Default)</option>
            <option value="OFF">OFF</option>
          </select>
        </label>
        */}

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
