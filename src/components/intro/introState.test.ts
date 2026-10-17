import { describe, expect, it } from 'vitest';
import { markIntroSeen, resolveIntroVariant } from './introState';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

class BrokenStorage {
  getItem(_key: string): string | null { throw new Error('storage unavailable'); }
  setItem(_key: string, _value: string): void { throw new Error('storage unavailable'); }
}

describe('QGo intro gating', () => {
  const now = new Date('2026-10-14T12:00:00.000Z');

  it('uses the full intro on every fresh app load or browser refresh', () => {
    const local = new MemoryStorage();
    const session = new MemoryStorage();
    expect(resolveIntroVariant({ now, local, session })).toBe('full');

    markIntroSeen('full', now, local, session);
    expect(resolveIntroVariant({ now, local, session })).toBe('full');
  });

  it('honours accessibility and dev overrides', () => {
    const local = new MemoryStorage();
    const session = new MemoryStorage();
    expect(resolveIntroVariant({ now, local, session, prefersReducedMotion: true })).toBe('reduced');
    expect(resolveIntroVariant({ now, local, session, search: '?intro=full' })).toBe('full');
    expect(resolveIntroVariant({ now, local, session, search: '?intro=off' })).toBe('off');
  });

  it('falls back safely when browser storage is unavailable', () => {
    const storage = new BrokenStorage();
    expect(resolveIntroVariant({ now, local: storage, session: storage })).toBe('full');
    expect(() => markIntroSeen('full', now, storage, storage)).not.toThrow();
  });
});
