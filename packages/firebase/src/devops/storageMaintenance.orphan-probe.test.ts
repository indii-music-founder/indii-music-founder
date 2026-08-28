/**
 * ISSUE-1413 deletion-safety probe (founder decision 2026-08-28: build the
 * rails, keep `enableDeletion=false` / DRY RUN).
 *
 * Pins the two conditions that make flipping the flag safe:
 * 1. A freshly-rendered output whose `history` AND `videoJobs` docs are
 *    missing/slow is reported as an orphan but NEVER auto-deleted (freshness
 *    rail — the doc write may simply not be visible yet).
 * 2. A file whose age is UNKNOWN (no parsable metadata) is never auto-deleted.
 * 3. Only stale files with no doc coverage are actually deleted, and a file
 *    covered by either collection is never touched.
 * 4. DRY RUN (the current production configuration) deletes nothing at all.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const mockGetAll = vi.fn();
  const mockGetConfigDoc = vi.fn();
  const mockAuditSet = vi.fn();
  return { mockGetAll, mockGetConfigDoc, mockAuditSet };
});

const firestoreMock = () => ({
  collection: (name: string) => ({
    doc: (id: string) => {
      if (name === 'admin' && id === 'storageMaintenance') {
        return {
          get: mocks.mockGetConfigDoc,
          collection: () => ({ doc: () => ({ set: mocks.mockAuditSet }) }),
        };
      }
      return { id };
    },
  }),
  getAll: mocks.mockGetAll,
  FieldValue: { serverTimestamp: () => 'MOCK_TIMESTAMP' },
});

const storageMock = () => ({ bucket: () => ({ getFiles: async () => [makeFiles()] }) });

firestoreMock.FieldValue = { serverTimestamp: () => 'MOCK_TIMESTAMP' };

vi.mock('firebase-admin', () => ({
  default: { firestore: firestoreMock, storage: storageMock },
  firestore: firestoreMock,
  storage: storageMock,
}));

vi.mock('firebase-functions/v2/scheduler', () => ({
  onSchedule: (_opts: unknown, handler: unknown) => handler,
}));

const DAY = 24 * 60 * 60 * 1000;

interface FakeFile {
  name: string;
  timeCreated?: string;
  metadata?: Record<string, unknown>;
  deleted: boolean;
}

let files: FakeFile[];

function makeFiles() {
  return files;
}

function seedStorage() {
  files = [
    {
      // Fresh render, docs not visible yet — the exact ISSUE-1413 hazard.
      name: 'videos/user1/fresh_job.mp4',
      timeCreated: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
      deleted: false,
    },
    {
      // Stale file with no doc coverage anywhere — a true orphan.
      name: 'videos/user2/stale_orphan.mp4',
      timeCreated: new Date(Date.now() - 30 * DAY).toISOString(),
      deleted: false,
    },
    {
      // Unknown age — must fail closed.
      name: 'videos/user3/unknown_age.mp4',
      deleted: false,
    },
    {
      // Covered by history — never touched.
      name: 'videos/user4/covered_history.mp4',
      timeCreated: new Date(Date.now() - 30 * DAY).toISOString(),
      deleted: false,
    },
    {
      // Covered by videoJobs — never touched.
      name: 'videos/user5/covered_job.mp4',
      timeCreated: new Date(Date.now() - 30 * DAY).toISOString(),
      deleted: false,
    },
  ];
  // Mutate the raw objects returned by makeFiles(): GCS-shaped metadata plus
  // the delete() the cleanup path calls.
  for (const f of files) {
    const raw = f as FakeFile & { delete: () => Promise<void> };
    raw.metadata = raw.metadata ?? { timeCreated: f.timeCreated };
    raw.delete = async () => { f.deleted = true; };
  }
  return files;
}

function seedDocs(opts: { historyIds?: string[]; jobIds?: string[] } = {}) {
  const historyIds = new Set(opts.historyIds ?? []);
  const jobIds = new Set(opts.jobIds ?? []);
  mocks.mockGetAll.mockImplementation(async (...refs: Array<{ id: string }>) =>
    refs.map((ref) => ({
      id: ref.id,
      exists: historyIds.has(ref.id) || jobIds.has(ref.id),
    })),
  );
}

async function runCleanup(enableDeletion: boolean) {
  mocks.mockGetConfigDoc.mockResolvedValue({ data: () => ({ enableDeletion }) });
  const { cleanupOrphanedVideos } = await import('./storageMaintenance');
  await (cleanupOrphanedVideos as unknown as () => Promise<void>)();
}

describe('cleanupOrphanedVideos deletion safety probe (ISSUE-1413)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockAuditSet.mockResolvedValue(undefined);
    seedStorage();
    seedDocs({ historyIds: ['covered_history'], jobIds: ['covered_job'] });
  });

  it('never deletes a freshly-rendered file whose docs are missing/slow', async () => {
    await runCleanup(true);

    const fresh = files.find((f) => f.name === 'videos/user1/fresh_job.mp4')!;
    expect(fresh.deleted).toBe(false);

    // Audit still counts it as an orphan (visible for finance/ops) but the
    // run records that it was preserved by the freshness rail.
    const audit = mocks.mockAuditSet.mock.calls[0][0];
    expect(audit.orphanPaths).toContain('videos/user1/fresh_job.mp4');
    expect(audit.recentOrphansPreserved).toBeGreaterThan(0);
  });

  it('never deletes a file with unknown age (fail closed)', async () => {
    await runCleanup(true);

    const unknown = files.find((f) => f.name === 'videos/user3/unknown_age.mp4')!;
    expect(unknown.deleted).toBe(false);
  });

  it('deletes only stale files with no history/videoJobs coverage', async () => {
    await runCleanup(true);

    expect(files.find((f) => f.name === 'videos/user2/stale_orphan.mp4')!.deleted).toBe(true);
  });

  it('never deletes files covered by history or videoJobs docs', async () => {
    await runCleanup(true);

    expect(files.find((f) => f.name === 'videos/user4/covered_history.mp4')!.deleted).toBe(false);
    expect(files.find((f) => f.name === 'videos/user5/covered_job.mp4')!.deleted).toBe(false);
  });

  it('deletes nothing at all in DRY RUN (the current production configuration)', async () => {
    await runCleanup(false);

    expect(files.every((f) => !f.deleted)).toBe(true);
    const audit = mocks.mockAuditSet.mock.calls[0][0];
    expect(audit.dryRun).toBe(true);
  });
});
