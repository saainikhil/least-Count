import { describe, it, expect, beforeEach } from 'vitest';
import { soundManager } from './soundManager';

describe('SoundManager', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => mockStorage[k] ?? null,
      setItem: (k: string, v: string) => { mockStorage[k] = String(v); },
      removeItem: (k: string) => { delete mockStorage[k]; },
      clear: () => { mockStorage = {}; },
    };
  });

  it('defaults to enabled', () => {
    expect(soundManager.isEnabled()).toBe(true);
  });

  it('updates state and persists to storage', () => {
    soundManager.setSoundEnabled(false);
    expect(soundManager.isEnabled()).toBe(false);
    expect(mockStorage['lc_sound_enabled']).toBe('false');

    soundManager.setSoundEnabled(true);
    expect(soundManager.isEnabled()).toBe(true);
    expect(mockStorage['lc_sound_enabled']).toBe('true');
  });

  it('notifies subscribers on change', () => {
    let notifiedState: boolean | null = null;
    const unsubscribe = soundManager.subscribe((val) => {
      notifiedState = val;
    });

    soundManager.setSoundEnabled(false);
    expect(notifiedState).toBe(false);

    soundManager.setSoundEnabled(true);
    expect(notifiedState).toBe(true);

    unsubscribe();
    soundManager.setSoundEnabled(false);
    // Should not have updated after unsubscribe
    expect(notifiedState).toBe(true);
  });
});

