import React, { useState } from 'react';
import { validateDisplayName } from '../services/playerProfile';

interface ProfileModalProps {
  currentName?: string;
  isFirstTime?: boolean;
  onSave: (newName: string) => void;
  onClose?: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  currentName = '',
  isFirstTime = false,
  onSave,
  onClose,
}) => {
  const [nameInput, setNameInput] = useState(currentName);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    setErrorMsg('');
    const validation = validateDisplayName(nameInput);
    if (!validation.valid) {
      setErrorMsg(validation.error || 'Please enter a valid display name.');
      return;
    }

    setIsSubmitting(true);
    try {
      onSave(validation.cleanName);
    } catch {
      setErrorMsg('Failed to save profile. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={!isFirstTime ? onClose : undefined}>
      <div className="simple-card profile-modal-card" onClick={e => e.stopPropagation()}>
        <div className="profile-modal-badge">
          {isFirstTime ? '★ WELCOME TO LEAST COUNT' : '👤 PLAYER PROFILE'}
        </div>

        <h2>{isFirstTime ? 'Choose Display Name' : 'Edit Profile'}</h2>
        <p className="profile-modal-subtitle">
          {isFirstTime
            ? 'Enter your name to start playing with the bot or online with friends. Your name will be remembered for future visits.'
            : 'Update your display name for game rooms and tables. Your player identity and active games are preserved.'}
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="player-profile-name-input">
            YOUR DISPLAY NAME
            <input
              id="player-profile-name-input"
              type="text"
              autoFocus
              maxLength={20}
              placeholder="e.g. AceOfSpades, Nikhil"
              value={nameInput}
              onChange={e => {
                setNameInput(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              disabled={isSubmitting}
            />
          </label>

          {errorMsg && <p className="profile-error-msg">{errorMsg}</p>}

          <div className="profile-actions">
            {!isFirstTime && onClose && (
              <button
                type="button"
                className="cta secondary"
                onClick={onClose}
                disabled={isSubmitting}
              >
                CANCEL
              </button>
            )}
            <button
              type="submit"
              className="cta"
              disabled={isSubmitting || !nameInput.trim()}
            >
              {isSubmitting ? 'SAVING...' : isFirstTime ? 'CONTINUE →' : 'SAVE CHANGES'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
