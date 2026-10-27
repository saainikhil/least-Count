// Sound Manager for Least Count Card Game
// Handles realistic audio playback, preloading, audio unlocking, and sound settings persistence.

export type SoundEffect =
  | 'card-select'
  | 'card-drop'
  | 'card-draw'
  | 'card-pick'
  | 'card-shuffle'
  | 'win'
  | 'lose';

const SOUND_ASSETS: Record<SoundEffect, string> = {
  'card-select': '/sounds/card-select.wav',
  'card-drop': '/sounds/card-drop.wav',
  'card-draw': '/sounds/card-draw.wav',
  'card-pick': '/sounds/card-pick.wav',
  'card-shuffle': '/sounds/card-shuffle.wav',
  'win': '/sounds/win.wav',
  'lose': '/sounds/lose.wav',
};

class SoundManager {
  private enabled: boolean = true;
  private audioCtx: AudioContext | null = null;
  private bufferCache: Map<SoundEffect, AudioBuffer> = new Map();
  private isUnlocked: boolean = false;
  private listeners: Set<(enabled: boolean) => void> = new Set();
  private activeSources: Set<AudioBufferSourceNode> = new Set();

  constructor() {
    // Load persisted sound setting (default ON)
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('lc_sound_enabled');
      if (stored !== null) {
        this.enabled = stored === 'true';
      }

      // Initialize unlock listeners
      this.setupUnlockListeners();

      // Preload assets asynchronously
      this.preload();
    }
  }

  private setupUnlockListeners() {
    const unlock = () => {
      this.initAudioContext();
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      this.isUnlocked = true;
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('click', unlock);
    };

    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true, passive: true });
    window.addEventListener('click', unlock, { once: true, passive: true });
  }

  private initAudioContext(): AudioContext | null {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        try {
          this.audioCtx = new AudioContextClass();
        } catch {
          // AudioContext not supported or restricted
        }
      }
    }
    return this.audioCtx;
  }

  // Preload and cache all audio assets for instantaneous zero-latency playback
  public async preload(): Promise<void> {
    const ctx = this.initAudioContext();
    const effects = Object.keys(SOUND_ASSETS) as SoundEffect[];

    for (const effect of effects) {
      if (this.bufferCache.has(effect)) continue;
      const url = SOUND_ASSETS[effect];

      try {
        const response = await fetch(url);
        if (!response.ok) continue;
        const arrayBuffer = await response.arrayBuffer();

        if (ctx) {
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
          this.bufferCache.set(effect, audioBuffer);
        }
      } catch {
        // Fallback gracefully to HTMLAudio on playback if decode fails
      }
    }
  }

  public isSoundEnabled(): boolean {
    return this.enabled;
  }

  public setSoundEnabled(enabled: boolean): void {
    this.enabled = enabled;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('lc_sound_enabled', String(enabled));
      }
    } catch {
      // LocalStorage unavailable
    }

    // If turned off, immediately stop any currently playing Web Audio sources
    if (!enabled) {
      for (const source of this.activeSources) {
        try {
          source.stop();
        } catch {
          // Already stopped
        }
      }
      this.activeSources.clear();
    }

    for (const listener of this.listeners) {
      listener(this.enabled);
    }
  }

  public toggleSound(): boolean {
    this.setSoundEnabled(!this.enabled);
    return this.enabled;
  }

  public subscribe(listener: (enabled: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Play a sound effect with safe error handling and customizable volume
  public play(sound: SoundEffect, volume: number = 1.0): void {
    if (!this.enabled) return;

    try {
      const ctx = this.initAudioContext();

      // If Web Audio is supported and unlocked or can be resumed
      if (ctx) {
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }

        const buffer = this.bufferCache.get(sound);
        if (buffer) {
          const source = ctx.createBufferSource();
          source.buffer = buffer;

          const gainNode = ctx.createGain();
          gainNode.gain.value = Math.max(0, Math.min(1, volume));

          source.connect(gainNode);
          gainNode.connect(ctx.destination);

          this.activeSources.add(source);
          source.onended = () => {
            this.activeSources.delete(source);
          };

          source.start(0);
          return;
        }
      }

      // Fallback: HTML5 Audio
      const audioUrl = SOUND_ASSETS[sound];
      if (audioUrl) {
        const audio = new Audio(audioUrl);
        audio.volume = Math.max(0, Math.min(1, volume));
        audio.play().catch(() => {
          // Playback error safely caught (e.g. autoplay policy)
        });
      }
    } catch {
      // Safely ignore audio errors so gameplay is never interrupted
    }
  }

  // Convenience methods matching prompt requirements

  // 1. Subtle, quick card-handling sound when selecting a card from hand
  public playCardSelect(): void {
    this.play('card-select', 0.45);
  }

  // 2. Realistic playing-card slap/placement on table when dropping/discarding
  public playCardDrop(isOpponent: boolean = false): void {
    this.play('card-drop', isOpponent ? 0.35 : 0.7);
  }

  // 3. Short card-drawing / card-sliding sound from face-down deck
  public playCardDraw(isOpponent: boolean = false): void {
    this.play('card-draw', isOpponent ? 0.3 : 0.6);
  }

  // 3b. Card pickup sound from discard pile
  public playCardPick(isOpponent: boolean = false): void {
    this.play('card-pick', isOpponent ? 0.3 : 0.6);
  }

  // 4. Realistic deck-shuffling sound for round start and deck recycling
  public playShuffle(): void {
    this.play('card-shuffle', 0.75);
  }

  // 5. Pleasant, celebratory victory jingle when officially winning
  public playWin(): void {
    this.play('win', 0.85);
  }

  // 6. Short, gentle losing tone when officially losing
  public playLose(): void {
    this.play('lose', 0.75);
  }
}

export const soundManager = new SoundManager();
