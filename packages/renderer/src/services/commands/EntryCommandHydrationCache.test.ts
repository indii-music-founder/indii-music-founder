import { describe, expect, it } from 'vitest';
import { EntryCommandHydrationCache } from '@/services/commands/EntryCommandHydrationCache';

describe('command hydration lifetime tokens (pure bookkeeping)', () => {
  it('invalidates completed keys and rejects late completion after reset', () => {
    const cache = new EntryCommandHydrationCache();
    const first = cache.begin();
    expect(cache.complete('key', first)).toBe(true);
    expect(cache.has('key')).toBe(true);
    cache.reset();
    expect(cache.has('key')).toBe(false);
    expect(cache.isCurrent(first)).toBe(false);
    expect(cache.complete('late-key', first)).toBe(false);
    expect(cache.has('late-key')).toBe(false);
    expect(cache.complete('key', cache.begin())).toBe(true);
  });

  it('does not treat starting a read as successful hydration', () => {
    const cache = new EntryCommandHydrationCache();
    cache.begin();
    expect(cache.has('key')).toBe(false);
  });
});
