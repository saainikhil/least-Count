// Player Profile Service for Least Count
// Manages stable player identity, secret authentication token, and persisted display name.

export interface PlayerProfile {
  id: string;
  token: string;
  name: string;
}

const STORAGE_KEYS = {
  ID: 'lc_player_id',
  TOKEN: 'lc_player_token',
  NAME: 'lc_display_name',
  ACTIVE_ROOM: 'lc_active_room_code',
} as const;

export function validateDisplayName(rawName: string): { valid: boolean; error?: string; cleanName: string } {
  const cleanName = (rawName || '').trim();

  if (!cleanName) {
    return { valid: false, error: 'Please enter a display name.', cleanName: '' };
  }

  if (cleanName.length < 2) {
    return { valid: false, error: 'Name must be at least 2 characters.', cleanName };
  }

  if (cleanName.length > 20) {
    return { valid: false, error: 'Name must be 20 characters or fewer.', cleanName };
  }

  // Reject names with dangerous tags or control characters
  if (/[<>\r\n\t]/.test(cleanName)) {
    return { valid: false, error: 'Name contains invalid characters.', cleanName };
  }

  return { valid: true, cleanName };
}

function generateStableId(): string {
  return `p_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
}

function generateSecureToken(): string {
  return `tok_${Math.random().toString(36).substring(2, 12)}_${Date.now().toString(36)}`;
}

class PlayerProfileManager {
  private currentProfile: PlayerProfile | null = null;
  private listeners: Set<(profile: PlayerProfile | null) => void> = new Set();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;

    try {
      const id = localStorage.getItem(STORAGE_KEYS.ID) || sessionStorage.getItem(STORAGE_KEYS.ID);
      const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
      const name = localStorage.getItem(STORAGE_KEYS.NAME) || sessionStorage.getItem(STORAGE_KEYS.NAME);

      if (id && token && name) {
        this.currentProfile = { id, token, name };
        // Sync to sessionStorage
        sessionStorage.setItem(STORAGE_KEYS.ID, id);
        sessionStorage.setItem(STORAGE_KEYS.NAME, name);
      } else if (id && name) {
        // Migration case: generate missing token for existing player
        const newToken = generateSecureToken();
        localStorage.setItem(STORAGE_KEYS.TOKEN, newToken);
        this.currentProfile = { id, token: newToken, name };
        sessionStorage.setItem(STORAGE_KEYS.ID, id);
        sessionStorage.setItem(STORAGE_KEYS.NAME, name);
      }
    } catch {
      // Storage unavailable
    }
  }

  public getProfile(): PlayerProfile | null {
    if (!this.currentProfile) {
      this.loadFromStorage();
    }
    return this.currentProfile;
  }

  public getOrCreateIdentity(): { id: string; token: string } {
    const existing = this.getProfile();
    if (existing) {
      return { id: existing.id, token: existing.token };
    }

    let id = '';
    let token = '';

    try {
      id = localStorage.getItem(STORAGE_KEYS.ID) || sessionStorage.getItem(STORAGE_KEYS.ID) || '';
      token = localStorage.getItem(STORAGE_KEYS.TOKEN) || '';

      if (!id) {
        id = generateStableId();
        localStorage.setItem(STORAGE_KEYS.ID, id);
        sessionStorage.setItem(STORAGE_KEYS.ID, id);
      }
      if (!token) {
        token = generateSecureToken();
        localStorage.setItem(STORAGE_KEYS.TOKEN, token);
      }
    } catch {
      id = generateStableId();
      token = generateSecureToken();
    }

    return { id, token };
  }

  public saveProfile(rawName: string): { ok: boolean; profile?: PlayerProfile; error?: string } {
    const check = validateDisplayName(rawName);
    if (!check.valid) {
      return { ok: false, error: check.error };
    }

    const { id, token } = this.getOrCreateIdentity();
    const updated: PlayerProfile = { id, token, name: check.cleanName };
    this.currentProfile = updated;

    try {
      localStorage.setItem(STORAGE_KEYS.ID, id);
      localStorage.setItem(STORAGE_KEYS.TOKEN, token);
      localStorage.setItem(STORAGE_KEYS.NAME, check.cleanName);

      sessionStorage.setItem(STORAGE_KEYS.ID, id);
      sessionStorage.setItem(STORAGE_KEYS.NAME, check.cleanName);
    } catch {
      // Storage unavailable
    }

    this.notify();
    return { ok: true, profile: updated };
  }

  public hasProfile(): boolean {
    return Boolean(this.getProfile()?.name);
  }

  public clearProfile(): void {
    this.currentProfile = null;
    try {
      localStorage.removeItem(STORAGE_KEYS.ID);
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
      localStorage.removeItem(STORAGE_KEYS.NAME);
      sessionStorage.removeItem(STORAGE_KEYS.ID);
      sessionStorage.removeItem(STORAGE_KEYS.NAME);
    } catch {
      // Storage unavailable
    }
    this.notify();
  }

  public subscribe(listener: (profile: PlayerProfile | null) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const l of this.listeners) {
      try {
        l(this.currentProfile);
      } catch {
        // Listener error
      }
    }
  }
}

export const playerProfileManager = new PlayerProfileManager();
