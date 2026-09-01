import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const mockExportDocuments = vi.fn();
  const mockGetFiles = vi.fn();
  const mockBatchDelete = vi.fn();
  const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
  const mockRunSet = vi.fn().mockResolvedValue(undefined);
  const mockExportSet = vi.fn().mockResolvedValue(undefined);

  const state = {
    mockConfigEnableDeletion: false,
    mockAgentTracesDocs: [] as any[],
    mockContextCacheDocs: [] as any[],
    mockNotificationTokensDocs: [] as any[],
    mockTaxFormDocs: [] as any[],
    mockTelegramDocs: [] as any[],
    mockOutboxDocs: [] as any[],
    mockHealthDocs: [] as any[],
    mockExportsDocs: [] as any[],
    mockUsersDocsMap: {} as Record<string, boolean>,
  };

  const firestoreMock: any = () => ({
    collection: (name: string) => {
      if (name === 'admin') {
        return {
          doc: (docId: string) => {
            if (docId === 'databaseMaintenance') {
              return {
                get: async () => ({
                  exists: true,
                  data: () => ({ enableDeletion: state.mockConfigEnableDeletion }),
                }),
                collection: (subName: string) => ({
                  doc: (_id: string) => ({
                    set: subName === 'exports' ? mockExportSet : mockRunSet,
                  }),
                  orderBy: () => ({
                    limit: () => ({
                      get: async () => ({
                        empty: state.mockExportsDocs.length === 0,
                        docs: state.mockExportsDocs,
                      }),
                    }),
                  }),
                }),
              };
            }
            return { id: docId };
          },
        };
      }

      if (name === 'users') {
        return {
          doc: (userId: string) => ({
            get: async () => ({
              exists: state.mockUsersDocsMap[userId] ?? true,
              id: userId,
            }),
          }),
        };
      }

      // Collections being queried for maintenance
      const getDocsForCollection = () => {
        switch (name) {
          case 'agent_traces':
            return state.mockAgentTracesDocs;
          case 'ai_context_cache':
            return state.mockContextCacheDocs;
          case 'notification_tokens':
            return state.mockNotificationTokensDocs;
          case 'taxFormRequests':
            return state.mockTaxFormDocs;
          case 'telegram-link-codes':
            return state.mockTelegramDocs;
          case 'conversionEventOutbox':
            return state.mockOutboxDocs;
          case '_health_check':
            return state.mockHealthDocs;
          default:
            return [];
        }
      };

      const queryMock: any = {
        where: () => queryMock,
        limit: () => ({
          get: async () => ({
            empty: getDocsForCollection().length === 0,
            docs: getDocsForCollection(),
          }),
        }),
        get: async () => ({
          empty: getDocsForCollection().length === 0,
          docs: getDocsForCollection(),
        }),
      };

      return queryMock;
    },
    batch: () => ({
      delete: mockBatchDelete,
      commit: mockBatchCommit,
    }),
    FieldValue: {
      serverTimestamp: () => 'MOCK_TIMESTAMP',
    },
  });

  firestoreMock.FieldValue = {
    serverTimestamp: () => 'MOCK_TIMESTAMP',
  };

  firestoreMock.v1 = {
    FirestoreAdminClient: class {
      databasePath(proj: string, db: string) {
        return `projects/${proj}/databases/${db}`;
      }
      async exportDocuments(req: any) {
        mockExportDocuments(req);
        return [{ name: 'projects/indii-music-founder/databases/(default)/operations/op_123' }];
      }
    },
  };

  const storageMock = () => ({
    bucket: () => ({
      getFiles: mockGetFiles,
    }),
  });

  return {
    mockExportDocuments,
    mockGetFiles,
    mockBatchDelete,
    mockBatchCommit,
    mockRunSet,
    mockExportSet,
    state,
    firestoreMock,
    storageMock,
  };
});

const createDocRef = (collectionName: string, id: string, data: any) => ({
  id,
  ref: { id, path: `${collectionName}/${id}` },
  data: () => data,
});

vi.mock('firebase-admin', () => ({
  default: {
    firestore: mocks.firestoreMock,
    storage: mocks.storageMock,
  },
  firestore: mocks.firestoreMock,
  storage: mocks.storageMock,
}));

vi.mock('firebase-functions/v2/scheduler', () => ({
  onSchedule: (_opts: unknown, handler: unknown) => handler,
}));

// Import unit under test
import {
  verifyExportSnapshot,
  getLatestVerifiedSnapshot,
  scheduledFirestoreColdlineExport,
  executeTelemetryPurge,
} from './databaseMaintenance';

describe('databaseMaintenance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.mockConfigEnableDeletion = false;
    mocks.state.mockAgentTracesDocs = [];
    mocks.state.mockContextCacheDocs = [];
    mocks.state.mockNotificationTokensDocs = [];
    mocks.state.mockTaxFormDocs = [];
    mocks.state.mockTelegramDocs = [];
    mocks.state.mockOutboxDocs = [];
    mocks.state.mockHealthDocs = [];
    mocks.state.mockExportsDocs = [];
    mocks.state.mockUsersDocsMap = {};
  });

  describe('verifyExportSnapshot', () => {
    it('fails verification if no files exist under prefix', async () => {
      mocks.mockGetFiles.mockResolvedValueOnce([[]]);

      const result = await verifyExportSnapshot('test-bucket', 'exports/2026-09-01');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('No files found');
    });

    it('fails verification if .overall_export_metadata is missing', async () => {
      mocks.mockGetFiles.mockResolvedValueOnce([[
        { name: 'exports/2026-09-01/all_kinds/agent_traces.export_metadata', metadata: { size: '1024' } },
        { name: 'exports/2026-09-01/all_kinds/agent_traces.output-0', metadata: { size: '2048' } },
      ]]);

      const result = await verifyExportSnapshot('test-bucket', 'exports/2026-09-01');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('overall_export_metadata');
    });

    it('fails verification if .overall_export_metadata is 0 bytes', async () => {
      mocks.mockGetFiles.mockResolvedValueOnce([[
        { name: 'exports/2026-09-01/2026-09-01.overall_export_metadata', metadata: { size: '0' } },
        { name: 'exports/2026-09-01/all_kinds/agent_traces.export_metadata', metadata: { size: '1024' } },
      ]]);

      const result = await verifyExportSnapshot('test-bucket', 'exports/2026-09-01');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('missing or empty');
    });

    it('fails verification if collection export metadata is missing', async () => {
      mocks.mockGetFiles.mockResolvedValueOnce([[
        { name: 'exports/2026-09-01/2026-09-01.overall_export_metadata', metadata: { size: '512' } },
      ]]);

      const result = await verifyExportSnapshot('test-bucket', 'exports/2026-09-01');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('No valid collection metadata files');
    });

    it('passes verification when complete export bundle exists in GCS Coldline', async () => {
      mocks.mockGetFiles.mockResolvedValueOnce([[
        { name: 'exports/2026-09-01/2026-09-01.overall_export_metadata', metadata: { size: '512' } },
        { name: 'exports/2026-09-01/all_kinds/agent_traces.export_metadata', metadata: { size: '1024' } },
        { name: 'exports/2026-09-01/all_kinds/agent_traces.output-0', metadata: { size: '409600' } },
      ]]);

      const result = await verifyExportSnapshot('test-bucket', 'exports/2026-09-01');
      expect(result.valid).toBe(true);
      expect(result.overallMetadataFound).toBe(true);
      expect(result.collectionMetadataCount).toBe(1);
      expect(result.totalBytes).toBe(512 + 1024 + 409600);
    });
  });

  describe('scheduledFirestoreColdlineExport', () => {
    it('initiates managed export to GCS Coldline bucket and logs audit record', async () => {
      const handler = scheduledFirestoreColdlineExport as unknown as () => Promise<void>;
      await handler();

      expect(mocks.mockExportDocuments).toHaveBeenCalledTimes(1);
      const req = mocks.mockExportDocuments.mock.calls[0][0];
      expect(req.outputUriPrefix).toContain('gs://indii-music-founder-firestore-backups-coldline/exports/');
      expect(req.collectionIds).toEqual([]);

      expect(mocks.mockExportSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'INITIATED',
          storageClass: 'COLDLINE',
          operationName: 'projects/indii-music-founder/databases/(default)/operations/op_123',
        })
      );
    });
  });

  describe('executeTelemetryPurge & Safety Rails', () => {
    it('aborts and fails closed if deletion is enabled but snapshot verification fails', async () => {
      mocks.state.mockConfigEnableDeletion = true;
      // No valid snapshot in tracking collection, and GCS returns empty
      mocks.mockGetFiles.mockResolvedValueOnce([[]]);

      await expect(
        executeTelemetryPurge({ dryRun: false })
      ).rejects.toThrow(/pre-deletion snapshot verification failed/);

      expect(mocks.mockRunSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ABORTED_UNVERIFIED_SNAPSHOT',
          dryRun: false,
        })
      );
      expect(mocks.mockBatchDelete).not.toHaveBeenCalled();
      expect(mocks.mockBatchCommit).not.toHaveBeenCalled();
    });

    it('runs safely in DRY RUN mode without deleting any documents', async () => {
      mocks.state.mockConfigEnableDeletion = false; // DRY RUN

      mocks.state.mockAgentTracesDocs = [
        createDocRef('agent_traces', 'trace-1', { startTime: new Date(Date.now() - 40 * 86400000) }),
        createDocRef('agent_traces', 'trace-2', { startTime: new Date(Date.now() - 50 * 86400000) }),
      ];
      mocks.state.mockContextCacheDocs = [
        createDocRef('ai_context_cache', 'user1_hash1', { expireTime: Date.now() - 1000 }),
      ];

      const report = await executeTelemetryPurge({ dryRun: true, skipSnapshotVerification: true });

      expect(report.dryRun).toBe(true);
      expect(report.status).toBe('COMPLETED');
      expect(report.purgedCounts.agentTraces).toBe(2);
      expect(report.purgedCounts.aiContextCache).toBe(1);
      expect(report.purgedCounts.totalPurged).toBe(3);

      // Verify no permanent deletions occurred
      expect(mocks.mockBatchDelete).not.toHaveBeenCalled();
      expect(mocks.mockBatchCommit).not.toHaveBeenCalled();
    });

    it('purges stale telemetry and orphaned tokens when deletion is enabled and snapshot is verified', async () => {
      // Mock valid export snapshot in GCS Coldline
      mocks.mockGetFiles.mockResolvedValue([[
        { name: 'exports/latest/latest.overall_export_metadata', metadata: { size: '512' } },
        { name: 'exports/latest/all_kinds/agent_traces.export_metadata', metadata: { size: '1024' } },
        { name: 'exports/latest/all_kinds/data.chunk', metadata: { size: '2048' } },
      ]]);

      mocks.state.mockExportsDocs = [
        createDocRef('exports', '2026-09-01T02-00-00', {
          timestamp: new Date(),
          bucket: 'indii-music-founder-firestore-backups-coldline',
          prefix: 'exports/latest',
        }),
      ];

      // Populate stale telemetry documents
      mocks.state.mockAgentTracesDocs = [
        createDocRef('agent_traces', 'stale-trace-1', { startTime: new Date(Date.now() - 35 * 86400000) }),
      ];
      mocks.state.mockContextCacheDocs = [
        createDocRef('ai_context_cache', 'expired-cache-1', { expireTime: Date.now() - 5000 }),
      ];
      // Orphaned notification token (user no longer exists)
      mocks.state.mockNotificationTokensDocs = [
        createDocRef('notification_tokens', 'token-orphaned', { userId: 'deleted-user-123' }),
      ];
      mocks.state.mockUsersDocsMap['deleted-user-123'] = false; // User document does not exist

      mocks.state.mockTaxFormDocs = [
        createDocRef('taxFormRequests', 'token-consumed', { consumedAt: new Date() }),
      ];
      mocks.state.mockTelegramDocs = [
        createDocRef('telegram-link-codes', 'code-expired', { createdAt: new Date(Date.now() - 2 * 86400000) }),
      ];
      mocks.state.mockOutboxDocs = [
        createDocRef('conversionEventOutbox', 'outbox-delivered', { status: 'delivered', updatedAt: new Date(Date.now() - 10 * 86400000) }),
      ];
      mocks.state.mockHealthDocs = [
        createDocRef('_health_check', 'ping-old', { timestamp: new Date(Date.now() - 2 * 86400000) }),
      ];

      const report = await executeTelemetryPurge({ dryRun: false });

      expect(report.status).toBe('COMPLETED');
      expect(report.dryRun).toBe(false);
      expect(report.snapshotVerified).toBe(true);
      expect(report.purgedCounts.agentTraces).toBe(1);
      expect(report.purgedCounts.aiContextCache).toBe(1);
      expect(report.purgedCounts.notificationTokens).toBe(1);
      expect(report.purgedCounts.taxFormRequests).toBe(1);
      expect(report.purgedCounts.telegramLinkCodes).toBe(1);
      expect(report.purgedCounts.conversionEventOutbox).toBe(1);
      expect(report.purgedCounts.healthCheckPings).toBe(1);
      expect(report.purgedCounts.totalPurged).toBe(7);

      // Verify batch deletions were executed and committed
      expect(mocks.mockBatchDelete).toHaveBeenCalledTimes(7);
      expect(mocks.mockBatchCommit).toHaveBeenCalled();

      // Verify audit trail logged to admin/databaseMaintenance/runs
      expect(mocks.mockRunSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'COMPLETED',
          dryRun: false,
          snapshotVerified: true,
          purgedCounts: expect.objectContaining({ totalPurged: 7 }),
        })
      );
    });
  });
});
