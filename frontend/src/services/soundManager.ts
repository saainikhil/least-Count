/**
 * SoundManager — Least Count Sound Infrastructure
 *
 * Actual audio files are not yet implemented.
 * This module manages the sound enabled/disabled preference and provides
 * a clean interface that future sound implementations must use.
 *
 * All future audio calls must check `soundManager.isEnabled()` before playing.
 */

const STORAGE_KEY = 'lc_sound_enabled';

class SoundManager {
  private enabled: boolean;
  private listeners: Array<(enabled: boolean) => void> = [];

  constructor() {
    // Load persisted preference; default to true for new users
    let stored: string | null = null;
    try {
      if (typeof localStorage !== 'undefined') {
        stored = localStorage.getItem(STORAGE_KEY);
      }
    } catch {
      // storage unavailable
    }
    this.enabled = stored !== null ? stored === 'true' : true;
  }

  /** Returns whether sound effects are currently allowed to play. */
  isEnabled(): boolean {
    return this.enabled;
  }

  /** Enable or disable sound effects. Persists to localStorage. */
  setSoundEnabled(enabled: boolean): void {
    this.enabled = enabled;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
      }
    } catch {
      // storage unavailable
    }
    this.listeners.forEach(fn => fn(enabled));
  }

  /** Subscribe to changes. Returns an unsubscribe function. */
  subscribe(fn: (enabled: boolean) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  // ─── Placeholder audio methods ───────────────────────────────────────────
  // When sounds are implemented, each method must check isEnabled() first.

  /** Play card shuffle sound. */
  playShuffle(): void {
    if (!this.enabled) return;
    // TODO: implement audio playback
  }

  /** Play card draw sound. */
  playCardDraw(_fromEmpty?: boolean): void {
    if (!this.enabled) return;
    // TODO: implement audio playback
  }

  /** Play card drop sound. */
  playCardDrop(_matching?: boolean): void {
    if (!this.enabled) return;
    // TODO: implement audio playback
  }

  /** Play card pick (from discard) sound. */
  playCardPick(_fromEmpty?: boolean): void {
    if (!this.enabled) return;
    // TODO: implement audio playback
  }

  /** Play card select/tap sound. */
  playCardSelect(): void {
    if (!this.enabled) return;
    // TODO: implement audio playback
  }

  /** Play Least Count call sound. */
  playLeastCount(_success?: boolean): void {
    if (!this.enabled) return;
    // TODO: implement audio playback
  }

  /** Play round win sound. */
  playRoundWin(): void {
    if (!this.enabled) return;
    // TODO: implement audio playback
  }

  /** Play round lose/penalty sound. */
  playRoundLose(): void {
    if (!this.enabled) return;
    // TODO: implement audio playback
  }
}

export const soundManager = new SoundManager();

