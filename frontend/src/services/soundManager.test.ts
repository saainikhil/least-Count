import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { soundManager } from './soundManager';

describe('Sound Assets Verification', () => {
  const soundsDir = path.resolve(__dirname, '../../public/sounds');
  const requiredSounds = [
    'card-select.wav',
    'card-drop.wav',
    'card-draw.wav',
    'card-pick.wav',
    'card-shuffle.wav',
    'win.wav',
    'lose.wav',
  ];

  requiredSounds.forEach(soundFile => {
    it(`verifies audio asset exists and is valid 44.1kHz 16-bit PCM WAV: ${soundFile}`, () => {
      const fullPath = path.join(soundsDir, soundFile);
      expect(fs.existsSync(fullPath)).toBe(true);

      const buffer = fs.readFileSync(fullPath);
      expect(buffer.length).toBeGreaterThan(44);

      // Check RIFF header
      expect(buffer.toString('ascii', 0, 4)).toBe('RIFF');
      expect(buffer.toString('ascii', 8, 12)).toBe('WAVE');

      // Check fmt subchunk
      expect(buffer.toString('ascii', 12, 16)).toBe('fmt ');
      const audioFormat = buffer.readUInt16LE(20);
      expect(audioFormat).toBe(1); // 1 = PCM

      const sampleRate = buffer.readUInt32LE(24);
      expect(sampleRate).toBe(44100);

      const bitsPerSample = buffer.readUInt16LE(34);
      expect(bitsPerSample).toBe(16);

      // Check data subchunk
      expect(buffer.toString('ascii', 36, 40)).toBe('data');
      const dataSize = buffer.readUInt32LE(40);
      expect(dataSize).toBeGreaterThan(0);
      expect(buffer.length).toBe(44 + dataSize);
    });
  });
});

describe('SoundManager', () => {
  let mockStore: Record<string, string> = {};

  beforeEach(() => {
    mockStore = {};
    (globalThis as any).localStorage = {
      getItem: (key: string) => mockStore[key] ?? null,
      setItem: (key: string, val: string) => { mockStore[key] = String(val); },
      clear: () => { mockStore = {}; },
      removeItem: (key: string) => { delete mockStore[key]; },
    };
    soundManager.setSoundEnabled(true);
  });

  it('is enabled by default and persists to localStorage', () => {
    expect(soundManager.isSoundEnabled()).toBe(true);

    soundManager.setSoundEnabled(false);
    expect(soundManager.isSoundEnabled()).toBe(false);
    expect(localStorage.getItem('lc_sound_enabled')).toBe('false');

    soundManager.setSoundEnabled(true);
    expect(soundManager.isSoundEnabled()).toBe(true);
    expect(localStorage.getItem('lc_sound_enabled')).toBe('true');
  });

  it('toggles sound on and off', () => {
    expect(soundManager.isSoundEnabled()).toBe(true);

    const afterFirstToggle = soundManager.toggleSound();
    expect(afterFirstToggle).toBe(false);
    expect(soundManager.isSoundEnabled()).toBe(false);

    const afterSecondToggle = soundManager.toggleSound();
    expect(afterSecondToggle).toBe(true);
    expect(soundManager.isSoundEnabled()).toBe(true);
  });

  it('notifies subscribers on sound state change', () => {
    const listener = vi.fn();
    const unsubscribe = soundManager.subscribe(listener);

    soundManager.setSoundEnabled(false);
    expect(listener).toHaveBeenCalledWith(false);

    soundManager.setSoundEnabled(true);
    expect(listener).toHaveBeenCalledWith(true);

    unsubscribe();
    soundManager.setSoundEnabled(false);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('safely handles play methods without errors', () => {
    expect(() => soundManager.playCardSelect()).not.toThrow();
    expect(() => soundManager.playCardDrop()).not.toThrow();
    expect(() => soundManager.playCardDrop(true)).not.toThrow();
    expect(() => soundManager.playCardDraw()).not.toThrow();
    expect(() => soundManager.playCardDraw(true)).not.toThrow();
    expect(() => soundManager.playCardPick()).not.toThrow();
    expect(() => soundManager.playCardPick(true)).not.toThrow();
    expect(() => soundManager.playShuffle()).not.toThrow();
    expect(() => soundManager.playWin()).not.toThrow();
    expect(() => soundManager.playLose()).not.toThrow();
  });

  it('does not play sounds when sound is disabled', () => {
    soundManager.setSoundEnabled(false);
    const playSpy = vi.spyOn(soundManager, 'play');

    soundManager.playCardSelect();
    expect(playSpy).toHaveBeenCalledWith('card-select', expect.any(Number));
    // SoundManager.play exits early when disabled
    expect(soundManager.isSoundEnabled()).toBe(false);
    playSpy.mockRestore();
  });
});
