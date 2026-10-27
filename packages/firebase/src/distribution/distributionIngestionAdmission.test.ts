import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const firestoreQueryGet = vi.fn();
  const query: any = {
    where: vi.fn(() => query),
    limit: vi.fn(() => query),
    get: firestoreQueryGet,
  };
  return {
    protectAuthenticatedApiRequest: vi.fn(),
    validateAppCheckV2: vi.fn(),
    firestoreDocGet: vi.fn(),
    firestoreDocSet: vi.fn(),
    firestoreDocAdd: vi.fn(),
    firestoreQueryGet,
    firestoreRunTransaction: vi.fn(),
    verifyMasterAudioObject: vi.fn(),
    tasksClientCreateTask: vi.fn(),
    auditReleaseArtworkForOwner: vi.fn(),
    authVerifyIdToken: vi.fn(),
    probeDurationSeconds: vi.fn(),
    storageBucket: vi.fn(),
    query,
  };
});

vi.mock('firebase-admin', () => {
  const firestore = vi.fn(() => ({
    collection: vi.fn(() => ({
      ...mocks.query,
      doc: vi.fn(() => ({
        id: 'mock-doc-id',
        get: mocks.firestoreDocGet,
        set: mocks.firestoreDocSet,
        collection: vi.fn(() => ({
          ...mocks.query,
          doc: vi.fn(() => ({
            id: 'mock-subdoc-id',
            get: mocks.firestoreDocGet,
            set: mocks.firestoreDocSet,
          })),
          add: mocks.firestoreDocAdd,
        })),
      })),
      add: mocks.firestoreDocAdd,
    })),
    runTransaction: mocks.firestoreRunTransaction,
  }));

  const mockFile = vi.fn(() => ({
    getMetadata: vi.fn().mockResolvedValue([{ contentType: 'video/mp4', size: 1024 }]),
    download: vi.fn().mockResolvedValue(undefined),
  }));

  const bucket = vi.fn(() => ({
    name: 'test-bucket.appspot.com',
    file: mockFile,
  }));

  return {
    default: {
      apps: [{ name: 'mock-app' }],
      initializeApp: vi.fn(),
      firestore: Object.assign(firestore, {
        FieldValue: {
          serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
        },
      }),
      auth: vi.fn(() => ({
        verifyIdToken: mocks.authVerifyIdToken,
      })),
      storage: vi.fn(() => ({
        bucket,
      })),
    },
    apps: [{ name: 'mock-app' }],
    initializeApp: vi.fn(),
    firestore: Object.assign(firestore, {
      FieldValue: {
        serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
      },
    }),
    auth: vi.fn(() => ({
      verifyIdToken: mocks.authVerifyIdToken,
    })),
    storage: vi.fn(() => ({
      bucket,
    })),
  };
});

vi.mock('firebase-admin/storage', () => ({
  getStorage: vi.fn(() => ({
    bucket: vi.fn(() => ({
      name: 'test-bucket.appspot.com',
      file: vi.fn(() => ({
        getMetadata: vi.fn().mockResolvedValue([{ contentType: 'audio/wav', size: 2048 }]),
        download: vi.fn().mockResolvedValue(undefined),
      })),
    })),
  })),
}));

vi.mock('@google-cloud/tasks', () => ({
  CloudTasksClient: vi.fn().mockImplementation(() => ({
    queuePath: vi.fn(() => 'mock/queue/path'),
    createTask: mocks.tasksClientCreateTask,
  })),
}));

vi.mock('../functions/storage/verifyMasterAudio', () => ({
  verifyMasterAudioObject: mocks.verifyMasterAudioObject,
}));

vi.mock('fluent-ffmpeg', () => ({
  default: {
    setFfprobePath: vi.fn(),
    ffprobe: vi.fn((_path, callback) => callback(null, { format: { duration: 124.5 } })),
  },
}));

vi.mock('ffprobe-static', () => ({
  default: { path: '/mock/path/ffprobe' },
}));

vi.mock('fs/promises', () => ({
  unlink: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../middleware/appCheck', () => ({
  validateAppCheckV2: mocks.validateAppCheckV2,
}));

vi.mock('../../middleware/appCheck', () => ({
  validateAppCheckV2: mocks.validateAppCheckV2,
}));

vi.mock('../functions/security/arcjet', () => ({
  protectAuthenticatedApiRequest: mocks.protectAuthenticatedApiRequest,
}));

vi.mock('./security/arcjet', () => ({
  protectAuthenticatedApiRequest: mocks.protectAuthenticatedApiRequest,
}));

vi.mock('firebase-functions/v2/https', () => ({
  onCall: vi.fn((_options: unknown, handler: unknown) => handler),
  onRequest: vi.fn((_options: unknown, handler: unknown) => handler),
  HttpsError: class HttpsError extends Error {
    constructor(public code: string, message: string) {
      super(message);
    }
  },
}));

import { auditReleaseArtworkForDelivery } from '../assets/auditReleaseArtwork';
import { processAudioIngestion } from './ingestion';
import { getMediaDuration } from '../functions/creative/getMediaDuration';
import {
  assignDistributionIdentifier,
  recordDistributionIdentifier,
  recordDistributionAuditEvent,
  requestDistributionTakedown,
  createSftpIngestionRecord,
  updateSftpIngestionRecord,
} from '../functions/distribution/distributionRecords';
import { createWebhook } from '../functions/webhooks/dispatcher';

describe('Unit 20 Admission Security: Distribution, Ingestion, Artwork, Media Duration & Webhooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateAppCheckV2.mockReturnValue(undefined);
    mocks.protectAuthenticatedApiRequest.mockResolvedValue({ allowed: true });
    mocks.firestoreDocAdd.mockResolvedValue({ id: 'mock-added-doc' });
    mocks.firestoreRunTransaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
      return cb({
        get: vi.fn().mockResolvedValue({
          empty: true,
          exists: true,
          id: 'mock-tx-doc',
          data: () => ({ userId: 'caller-1', status: 'INITIATED' }),
        }),
        set: vi.fn(),
        update: vi.fn(),
      });
    });
    mocks.verifyMasterAudioObject.mockResolvedValue({
      verified: true,
      contentHash: 'a'.repeat(64),
      generation: '123',
    });
    mocks.tasksClientCreateTask.mockResolvedValue({});
    mocks.authVerifyIdToken.mockResolvedValue({
      uid: 'caller-1',
      firebase: { sign_in_provider: 'password' },
    });
  });

  const call = (fn: any, ...args: any[]) => fn(...args);

  describe('auditReleaseArtworkForDelivery', () => {
    it('rejects failed AppCheck validation', async () => {
      mocks.validateAppCheckV2.mockImplementation(() => {
        throw new Error('AppCheck failed');
      });
      await expect(call(auditReleaseArtworkForDelivery, { auth: { uid: 'u1' }, data: { releaseId: 'rel-1' } }))
        .rejects.toThrow('AppCheck failed');
    });

    it('rejects unauthenticated caller', async () => {
      await expect(call(auditReleaseArtworkForDelivery, { data: { releaseId: 'rel-1' } }))
        .rejects.toMatchObject({ code: 'unauthenticated' });
    });

    it('rejects anonymous caller', async () => {
      await expect(call(auditReleaseArtworkForDelivery, {
        auth: { uid: 'u1', token: { firebase: { sign_in_provider: 'anonymous' } } },
        data: { releaseId: 'rel-1' },
      })).rejects.toMatchObject({ code: 'permission-denied' });
    });

    it('rejects when Arcjet denies', async () => {
      mocks.protectAuthenticatedApiRequest.mockResolvedValue({
        allowed: false,
        status: 429,
        message: 'Rate limit exceeded',
      });
      await expect(call(auditReleaseArtworkForDelivery, {
        auth: { uid: 'u1', token: { firebase: { sign_in_provider: 'password' } } },
        rawRequest: {},
        data: { releaseId: 'rel-1' },
      })).rejects.toMatchObject({ code: 'resource-exhausted' });
    });
  });

  describe('processAudioIngestion', () => {
    it('rejects failed AppCheck validation', async () => {
      mocks.validateAppCheckV2.mockImplementation(() => {
        throw new Error('AppCheck failed');
      });
      await expect(call(processAudioIngestion, { auth: { uid: 'u1' }, data: {} }))
        .rejects.toThrow('AppCheck failed');
    });

    it('rejects unauthenticated caller', async () => {
      await expect(call(processAudioIngestion, { data: {} }))
        .rejects.toMatchObject({ code: 'unauthenticated' });
    });

    it('rejects anonymous caller', async () => {
      await expect(call(processAudioIngestion, {
        auth: { uid: 'u1', token: { firebase: { sign_in_provider: 'anonymous' } } },
        data: {},
      })).rejects.toMatchObject({ code: 'permission-denied' });
    });

    it('rejects when Arcjet denies', async () => {
      mocks.protectAuthenticatedApiRequest.mockResolvedValue({
        allowed: false,
        status: 429,
        message: 'Rate limit exceeded',
      });
      await expect(call(processAudioIngestion, {
        auth: { uid: 'u1', token: { firebase: { sign_in_provider: 'password' } } },
        rawRequest: {},
        data: {},
      })).rejects.toMatchObject({ code: 'resource-exhausted' });
    });
  });

  describe('getMediaDuration', () => {
    it('rejects failed AppCheck validation', async () => {
      mocks.validateAppCheckV2.mockImplementation(() => {
        throw new Error('AppCheck failed');
      });
      await expect(call(getMediaDuration, { auth: { uid: 'u1' }, data: { uri: 'gs://test-bucket.appspot.com/creative/u1/video.mp4' } }))
        .rejects.toThrow('AppCheck failed');
    });

    it('rejects unauthenticated caller', async () => {
      await expect(call(getMediaDuration, { data: { uri: 'gs://test-bucket.appspot.com/creative/u1/video.mp4' } }))
        .rejects.toMatchObject({ code: 'unauthenticated' });
    });

    it('rejects anonymous caller', async () => {
      await expect(call(getMediaDuration, {
        auth: { uid: 'u1', token: { firebase: { sign_in_provider: 'anonymous' } } },
        data: { uri: 'gs://test-bucket.appspot.com/creative/u1/video.mp4' },
      })).rejects.toMatchObject({ code: 'permission-denied' });
    });

    it('rejects when Arcjet denies', async () => {
      mocks.protectAuthenticatedApiRequest.mockResolvedValue({
        allowed: false,
        status: 429,
        message: 'Rate limit exceeded',
      });
      await expect(call(getMediaDuration, {
        auth: { uid: 'u1', token: { firebase: { sign_in_provider: 'password' } } },
        rawRequest: {},
        data: { uri: 'gs://test-bucket.appspot.com/creative/u1/video.mp4' },
      })).rejects.toMatchObject({ code: 'resource-exhausted' });
    });

    it('successfully probes media duration for valid caller', async () => {
      const res = await call(getMediaDuration, {
        auth: { uid: 'u1', token: { firebase: { sign_in_provider: 'password' } } },
        rawRequest: {},
        data: { uri: 'gs://test-bucket.appspot.com/creative/u1/video.mp4' },
      });
      expect(res).toEqual({ durationSeconds: 124.5 });
    });
  });

  describe('assignDistributionIdentifier', () => {
    it('rejects unauthenticated caller', async () => {
      await expect(call(assignDistributionIdentifier, { data: { type: 'isrc', assignedTo: 'track-1' } }))
        .rejects.toMatchObject({ code: 'unauthenticated' });
    });

    it('rejects anonymous caller', async () => {
      await expect(call(assignDistributionIdentifier, {
        auth: { uid: 'u1', token: { firebase: { sign_in_provider: 'anonymous' } } },
        data: { type: 'isrc', assignedTo: 'track-1' },
      })).rejects.toMatchObject({ code: 'permission-denied' });
    });

    it('rejects when Arcjet denies', async () => {
      mocks.protectAuthenticatedApiRequest.mockResolvedValue({
        allowed: false,
        status: 429,
        message: 'Rate limit exceeded',
      });
      await expect(call(assignDistributionIdentifier, {
        auth: { uid: 'u1', token: { firebase: { sign_in_provider: 'password' } } },
        rawRequest: {},
        data: { type: 'isrc', assignedTo: 'track-1' },
      })).rejects.toMatchObject({ code: 'resource-exhausted' });
    });

    it('rejects invalid identifier type', async () => {
      await expect(call(assignDistributionIdentifier, {
        auth: { uid: 'u1', token: { firebase: { sign_in_provider: 'password' } } },
        rawRequest: {},
        data: { type: 'invalid_type', assignedTo: 'track-1' },
      })).rejects.toMatchObject({ code: 'invalid-argument' });
    });
  });

  describe('recordDistributionIdentifier', () => {
    it('rejects unauthenticated caller', async () => {
      await expect(call(recordDistributionIdentifier, { data: { type: 'isrc', isrc: 'USRC17607839', releaseId: 'rel-1' } }))
        .rejects.toMatchObject({ code: 'unauthenticated' });
    });

    it('rejects anonymous caller', async () => {
      await expect(call(recordDistributionIdentifier, {
        auth: { uid: 'u1', token: { firebase: { sign_in_provider: 'anonymous' } } },
        data: { type: 'isrc', isrc: 'USRC17607839', releaseId: 'rel-1' },
      })).rejects.toMatchObject({ code: 'permission-denied' });
    });

    it('rejects when Arcjet denies', async () => {
      mocks.protectAuthenticatedApiRequest.mockResolvedValue({
        allowed: false,
        status: 429,
        message: 'Rate limit exceeded',
      });
      await expect(call(recordDistributionIdentifier, {
        auth: { uid: 'u1', token: { firebase: { sign_in_provider: 'password' } } },
        rawRequest: {},
        data: { type: 'isrc', isrc: 'USRC17607839', releaseId: 'rel-1' },
      })).rejects.toMatchObject({ code: 'resource-exhausted' });
    });

    it('rejects invalid ISRC format', async () => {
      await expect(call(recordDistributionIdentifier, {
        auth: { uid: 'u1', token: { firebase: { sign_in_provider: 'password' } } },
        rawRequest: {},
        data: { type: 'isrc', isrc: 'invalid_isrc_code', releaseId: 'rel-1' },
      })).rejects.toMatchObject({ code: 'invalid-argument' });
    });
  });

  describe('recordDistributionAuditEvent', () => {
    it('rejects unauthenticated caller', async () => {
      await expect(call(recordDistributionAuditEvent, { data: { releaseId: 'rel-1', kind: 'event' } }))
        .rejects.toMatchObject({ code: 'unauthenticated' });
    });

    it('rejects anonymous caller', async () => {
      await expect(call(recordDistributionAuditEvent, {
        auth: { uid: 'u1', token: { firebase: { sign_in_provider: 'anonymous' } } },
        data: { releaseId: 'rel-1', kind: 'event' },
      })).rejects.toMatchObject({ code: 'permission-denied' });
    });

    it('rejects when Arcjet denies', async () => {
      mocks.protectAuthenticatedApiRequest.mockResolvedValue({
        allowed: false,
        status: 429,
        message: 'Rate limit exceeded',
      });
      await expect(call(recordDistributionAuditEvent, {
        auth: { uid: 'u1', token: { firebase: { sign_in_provider: 'password' } } },
        rawRequest: {},
        data: { releaseId: 'rel-1', kind: 'event' },
      })).rejects.toMatchObject({ code: 'resource-exhausted' });
    });
  });

  describe('requestDistributionTakedown', () => {
    it('rejects unauthenticated caller', async () => {
      await expect(call(requestDistributionTakedown, { data: { releaseId: 'rel-1' } }))
        .rejects.toMatchObject({ code: 'unauthenticated' });
    });

    it('rejects anonymous caller', async () => {
      await expect(call(requestDistributionTakedown, {
        auth: { uid: 'u1', token: { firebase: { sign_in_provider: 'anonymous' } } },
        data: { releaseId: 'rel-1' },
      })).rejects.toMatchObject({ code: 'permission-denied' });
    });

    it('rejects when Arcjet denies', async () => {
      mocks.protectAuthenticatedApiRequest.mockResolvedValue({
        allowed: false,
        status: 429,
        message: 'Rate limit exceeded',
      });
      await expect(call(requestDistributionTakedown, {
        auth: { uid: 'u1', token: { firebase: { sign_in_provider: 'password' } } },
        rawRequest: {},
        data: { releaseId: 'rel-1' },
      })).rejects.toMatchObject({ code: 'resource-exhausted' });
    });
  });

  describe('createSftpIngestionRecord', () => {
    it('rejects unauthenticated caller', async () => {
      await expect(call(createSftpIngestionRecord, { data: { targetDSP: 'spotify', releaseFolder: '/dsp/r1' } }))
        .rejects.toMatchObject({ code: 'unauthenticated' });
    });

    it('rejects anonymous caller', async () => {
      await expect(call(createSftpIngestionRecord, {
        auth: { uid: 'u1', token: { firebase: { sign_in_provider: 'anonymous' } } },
        data: { targetDSP: 'spotify', releaseFolder: '/dsp/r1' },
      })).rejects.toMatchObject({ code: 'permission-denied' });
    });

    it('rejects when Arcjet denies', async () => {
      mocks.protectAuthenticatedApiRequest.mockResolvedValue({
        allowed: false,
        status: 429,
        message: 'Rate limit exceeded',
      });
      await expect(call(createSftpIngestionRecord, {
        auth: { uid: 'u1', token: { firebase: { sign_in_provider: 'password' } } },
        rawRequest: {},
        data: { targetDSP: 'spotify', releaseFolder: '/dsp/r1' },
      })).rejects.toMatchObject({ code: 'resource-exhausted' });
    });

    it('creates ingestion record for valid caller', async () => {
      const res = await call(createSftpIngestionRecord, {
        auth: { uid: 'u1', token: { firebase: { sign_in_provider: 'password' } } },
        rawRequest: {},
        data: { targetDSP: 'spotify', releaseFolder: '/dsp/r1' },
      });
      expect(res).toEqual({ ingestionId: 'mock-added-doc' });
    });
  });

  describe('updateSftpIngestionRecord', () => {
    it('rejects unauthenticated caller', async () => {
      await expect(call(updateSftpIngestionRecord, { data: { ingestionId: 'ing-1', status: 'TRANSFERRED' } }))
        .rejects.toMatchObject({ code: 'unauthenticated' });
    });

    it('rejects anonymous caller', async () => {
      await expect(call(updateSftpIngestionRecord, {
        auth: { uid: 'u1', token: { firebase: { sign_in_provider: 'anonymous' } } },
        data: { ingestionId: 'ing-1', status: 'TRANSFERRED' },
      })).rejects.toMatchObject({ code: 'permission-denied' });
    });

    it('rejects when Arcjet denies', async () => {
      mocks.protectAuthenticatedApiRequest.mockResolvedValue({
        allowed: false,
        status: 429,
        message: 'Rate limit exceeded',
      });
      await expect(call(updateSftpIngestionRecord, {
        auth: { uid: 'u1', token: { firebase: { sign_in_provider: 'password' } } },
        rawRequest: {},
        data: { ingestionId: 'ing-1', status: 'TRANSFERRED' },
      })).rejects.toMatchObject({ code: 'resource-exhausted' });
    });

    it('updates ingestion record for valid caller', async () => {
      const res = await call(updateSftpIngestionRecord, {
        auth: { uid: 'caller-1', token: { firebase: { sign_in_provider: 'password' } } },
        rawRequest: {},
        data: { ingestionId: 'ing-1', status: 'TRANSFERRED', filesTransferred: 5 },
      });
      expect(res).toEqual({ ingestionId: 'ing-1', status: 'TRANSFERRED' });
    });
  });

  describe('createWebhook (onRequest)', () => {
    function createMockResponse() {
      const res: any = {};
      res.statusCode = 200;
      res.body = null;
      res.status = vi.fn((code: number) => {
        res.statusCode = code;
        return res;
      });
      res.json = vi.fn((payload: any) => {
        res.body = payload;
        return res;
      });
      return res;
    }

    it('rejects missing or invalid Authorization header with 401', async () => {
      const req: any = { headers: {} };
      const res = createMockResponse();

      await call(createWebhook, req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.body).toEqual({ error: 'Unauthorized: Missing or invalid authorization header' });
    });

    it('rejects anonymous caller with 403', async () => {
      mocks.authVerifyIdToken.mockResolvedValueOnce({
        uid: 'anon-1',
        firebase: { sign_in_provider: 'anonymous' },
      });
      const req: any = {
        headers: { authorization: 'Bearer mock-anon-token' },
        body: { url: 'https://webhook.site/test', secret: 'sec-1', events: ['release.created'] },
      };
      const res = createMockResponse();

      await call(createWebhook, req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.body).toEqual({ error: 'Forbidden: Anonymous accounts cannot register webhooks' });
    });

    it('rejects rate-limited requests when Arcjet denies with 429', async () => {
      mocks.protectAuthenticatedApiRequest.mockResolvedValueOnce({
        allowed: false,
        status: 429,
        message: 'Rate limit exceeded',
      });
      const req: any = {
        headers: { authorization: 'Bearer mock-valid-token' },
        body: { url: 'https://webhook.site/test', secret: 'sec-1', events: ['release.created'] },
      };
      const res = createMockResponse();

      await call(createWebhook, req, res);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.body).toEqual({ error: 'Rate limit exceeded' });
    });

    it('rejects missing required body fields with 400', async () => {
      const req: any = {
        headers: { authorization: 'Bearer mock-valid-token' },
        body: { url: 'https://webhook.site/test' }, // missing secret and events
      };
      const res = createMockResponse();

      await call(createWebhook, req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body).toEqual({ error: 'Missing required fields' });
    });

    it('creates webhook subscription for valid authenticated request with 201', async () => {
      const req: any = {
        headers: { authorization: 'Bearer mock-valid-token' },
        body: { url: 'https://webhook.site/test', secret: 'sec-123', events: ['release.published'] },
      };
      const res = createMockResponse();

      await call(createWebhook, req, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.body).toMatchObject({
        userId: 'caller-1',
        url: 'https://webhook.site/test',
        secret: 'sec-123',
        events: ['release.published'],
        active: true,
      });
    });
  });
});
