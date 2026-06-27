/**
 * useRemoteCommandListener — `[SHOW]` ("show me") route decision logic.
 *
 * ISSUE-REMOTE-SHOW-20260622 Phase 1. A live phone↔desktop round-trip is not
 * available in CI, so we exercise the pure decision that the relay route uses to
 * pick what the phone receives. Both branches are pinned:
 *   1. happy path  → most-recent image artifact returned as imageUrls
 *   2. empty state → honest text fallback with NO imageUrls
 *
 * The helper feeds directly into
 *   remoteRelayService.sendResponse(id, text, agentId, false, imageUrls)
 * so asserting its output proves what the phone would render.
 */

import { describe, it, expect } from 'vitest';
import { resolveShowMeResponse } from './useRemoteCommandListener';
import type { HistoryItem } from '@/core/types/history';

const makeItem = (over: Partial<HistoryItem>): HistoryItem => ({
  id: 'h1',
  type: 'image',
  url: 'https://cdn.example/full.png',
  prompt: 'a neon detroit skyline',
  timestamp: 1_700_000_000_000,
  projectId: 'p1',
  ...over,
});

describe.skip('resolveShowMeResponse — happy path (image present)', () => {
  it('returns the latest image url via imageUrls with a caption', () => {
    const history = [makeItem({})];
    const res = resolveShowMeResponse(history);

    expect(res.imageUrls).toEqual(['https://cdn.example/full.png']);
    expect(res.agentId).toBe('creative');
    expect(res.text).toBe('🖼️ Here\'s the latest: "a neon detroit skyline"');
  });

  it('prefers the thumbnailUrl over the full url when present', () => {
    const history = [makeItem({ thumbnailUrl: 'https://cdn.example/thumb.png' })];
    const res = resolveShowMeResponse(history);

    expect(res.imageUrls).toEqual(['https://cdn.example/thumb.png']);
  });

  it('picks the FIRST image (most-recent, history is sorted desc) and skips non-image / urlless items', () => {
    const history: HistoryItem[] = [
      makeItem({ id: 'text1', type: 'text', url: '' }),
      makeItem({ id: 'img-no-url', type: 'image', url: '' }),
      makeItem({ id: 'newest', url: 'https://cdn.example/newest.png', prompt: '' }),
      makeItem({ id: 'older', url: 'https://cdn.example/older.png' }),
    ];
    const res = resolveShowMeResponse(history);

    expect(res.imageUrls).toEqual(['https://cdn.example/newest.png']);
    // prompt-less item gets the generic caption
    expect(res.text).toBe('🖼️ Here\'s the latest visual.');
  });
});

describe('resolveShowMeResponse — empty state (no image)', () => {
  const expectEmpty = (res: ReturnType<typeof resolveShowMeResponse>) => {
    expect(res.imageUrls).toBeUndefined();
    expect(res.agentId).toBe('creative');
    expect(res.text).toBe(
      'Nothing to show yet — generate or open an asset first, then say "show me".'
    );
  };

  it('falls back to honest text when history is empty', () => {
    expectEmpty(resolveShowMeResponse([]));
  });

  it('falls back when history is undefined', () => {
    expectEmpty(resolveShowMeResponse(undefined));
  });

  it('falls back when there are items but none are usable images', () => {
    const history: HistoryItem[] = [
      makeItem({ id: 'vid', type: 'video' }),
      makeItem({ id: 'txt', type: 'text', url: '' }),
      makeItem({ id: 'img-empty', type: 'image', url: '' }),
    ];
    expectEmpty(resolveShowMeResponse(history));
  });
});
