/**
 * CareerMemoryArchiveService tests.
 *
 * This is the longitudinal substrate of the cross-pollination chains: career
 * events accrue here over years, and the annual-review / insight agents read
 * them back. The client-side aggregation (importance ranking, year grouping)
 * is the logic that turns "3 years of guitar-string spend" into an insight, so
 * it must be correct and deterministic.
 *
 * Firebase (auth + firestore) is mocked globally in src/test/setup.ts; we drive
 * getDocs return values here to exercise the pure logic above the data layer.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDocs } from 'firebase/firestore';
import { CareerMemoryArchiveService, type CareerMemory } from './CareerMemoryArchiveService';

const mockGetDocs = vi.mocked(getDocs);

/** Build a fake Firestore querySnapshot from plain memory objects. */
function snapshotOf(memories: Partial<CareerMemory>[]) {
  return {
    docs: memories.map((m) => ({ data: () => m })),
    empty: memories.length === 0,
    size: memories.length,
    forEach: vi.fn(),
  } as unknown as Awaited<ReturnType<typeof getDocs>>;
}

const mem = (overrides: Partial<CareerMemory>): Partial<CareerMemory> => ({
  id: Math.random().toString(36).slice(2),
  userId: 'test-uid',
  content: 'event',
  category: 'milestone',
  importance: 5,
  eventDate: '2024-06-01',
  tags: [],
  relatedEntities: [],
  source: 'manual',
  ...overrides,
});

beforeEach(() => {
  mockGetDocs.mockReset();
});

describe('CareerMemoryArchiveService.getTopMilestones', () => {
  it('returns memories sorted by importance descending, capped at maxResults', async () => {
    mockGetDocs.mockResolvedValueOnce(
      snapshotOf([
        mem({ content: 'low', importance: 2 }),
        mem({ content: 'high', importance: 9 }),
        mem({ content: 'mid', importance: 5 }),
      ]),
    );

    const top = await CareerMemoryArchiveService.getTopMilestones(2024, 2);

    expect(top).toHaveLength(2);
    expect(top.map((m) => m.content)).toEqual(['high', 'mid']);
    expect(top[0]!.importance).toBeGreaterThanOrEqual(top[1]!.importance);
  });

  it('returns empty array when no memories exist for the year', async () => {
    mockGetDocs.mockResolvedValueOnce(snapshotOf([]));
    const top = await CareerMemoryArchiveService.getTopMilestones(2099);
    expect(top).toEqual([]);
  });
});

describe('CareerMemoryArchiveService.generateYearInReviewData', () => {
  it('groups memories by category', async () => {
    mockGetDocs.mockResolvedValueOnce(
      snapshotOf([
        mem({ content: 'released album', category: 'milestone' }),
        mem({ content: 'signed deal', category: 'milestone' }),
        mem({ content: 'guitar string purchase', category: 'financial' }),
      ]),
    );

    const grouped = await CareerMemoryArchiveService.generateYearInReviewData(2024);

    expect(grouped.milestone).toHaveLength(2);
    expect(grouped.financial).toHaveLength(1);
  });

  it('returns an empty grouping when the year has no memories', async () => {
    mockGetDocs.mockResolvedValueOnce(snapshotOf([]));
    const grouped = await CareerMemoryArchiveService.generateYearInReviewData(2099);
    expect(Object.keys(grouped)).toHaveLength(0);
  });
});

describe('CareerMemoryArchiveService query helpers', () => {
  it('getByCategory maps snapshot docs to memory objects', async () => {
    mockGetDocs.mockResolvedValueOnce(
      snapshotOf([mem({ content: 'a', category: 'milestone' }), mem({ content: 'b', category: 'milestone' })]),
    );
    const result = await CareerMemoryArchiveService.getByCategory('milestone');
    expect(result.map((m) => m.content)).toEqual(['a', 'b']);
  });

  it('getByEntity returns memories linked to an entity', async () => {
    mockGetDocs.mockResolvedValueOnce(snapshotOf([mem({ content: 'linked', relatedEntities: ['release-1'] })]));
    const result = await CareerMemoryArchiveService.getByEntity('release-1');
    expect(result).toHaveLength(1);
    expect(result[0]!.relatedEntities).toContain('release-1');
  });

  it('searchByTag returns memories matching a tag', async () => {
    mockGetDocs.mockResolvedValueOnce(snapshotOf([mem({ content: 'tagged', tags: ['tour'] })]));
    const result = await CareerMemoryArchiveService.searchByTag('tour');
    expect(result[0]!.tags).toContain('tour');
  });
});
