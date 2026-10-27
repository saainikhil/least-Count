import { describe, it, expect, beforeEach } from 'vitest';
import { playerProfileManager, validateDisplayName } from './playerProfile';

describe('playerProfileManager & validateDisplayName', () => {
  let mockLocal: Record<string, string> = {};
  let mockSession: Record<string, string> = {};

  beforeEach(() => {
    mockLocal = {};
    mockSession = {};

    (globalThis as any).window = globalThis;

    (globalThis as any).localStorage = {
      getItem: (key: string) => mockLocal[key] ?? null,
      setItem: (key: string, val: string) => { mockLocal[key] = String(val); },
      clear: () => { mockLocal = {}; },
      removeItem: (key: string) => { delete mockLocal[key]; },
    };

    (globalThis as any).sessionStorage = {
      getItem: (key: string) => mockSession[key] ?? null,
      setItem: (key: string, val: string) => { mockSession[key] = String(val); },
      clear: () => { mockSession = {}; },
      removeItem: (key: string) => { delete mockSession[key]; },
    };

    // Reset manager state for clean test run
    playerProfileManager.clearProfile();
  });

  it('validates display names correctly', () => {
    expect(validateDisplayName('').valid).toBe(false);
    expect(validateDisplayName('a').valid).toBe(false);
    expect(validateDisplayName('   ').valid).toBe(false);
    expect(validateDisplayName('ValidName').valid).toBe(true);
    expect(validateDisplayName('Valid Name 123').valid).toBe(true);
    expect(validateDisplayName('A'.repeat(21)).valid).toBe(false);
    expect(validateDisplayName('<script>').valid).toBe(false);
    expect(validateDisplayName('User\nName').valid).toBe(false);
  });

  it('generates and persists a stable identity', () => {
    const id1 = playerProfileManager.getOrCreateIdentity();
    expect(id1.id).toBeDefined();
    expect(id1.id.startsWith('p_')).toBe(true);
    expect(id1.token).toBeDefined();
    expect(id1.token.startsWith('tok_')).toBe(true);

    // Calling it again returns identical stable ID and secret token
    const id2 = playerProfileManager.getOrCreateIdentity();
    expect(id2.id).toBe(id1.id);
    expect(id2.token).toBe(id1.token);
  });

  it('saves and restores player profile', () => {
    expect(playerProfileManager.hasProfile()).toBe(false);
    expect(playerProfileManager.getProfile()).toBeNull();

    const saveRes = playerProfileManager.saveProfile('CardMaster');
    expect(saveRes.ok).toBe(true);
    expect(saveRes.profile?.name).toBe('CardMaster');
    expect(playerProfileManager.hasProfile()).toBe(true);

    const retrieved = playerProfileManager.getProfile();
    expect(retrieved).not.toBeNull();
    expect(retrieved?.name).toBe('CardMaster');
  });

  it('updates display name without altering player identifier or token', () => {
    playerProfileManager.saveProfile('InitialName');
    const firstIdentity = playerProfileManager.getOrCreateIdentity();

    playerProfileManager.saveProfile('UpdatedName');
    const secondIdentity = playerProfileManager.getOrCreateIdentity();

    expect(secondIdentity.id).toBe(firstIdentity.id);
    expect(secondIdentity.token).toBe(firstIdentity.token);
    expect(playerProfileManager.getProfile()?.name).toBe('UpdatedName');
  });
});
