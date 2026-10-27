import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';

const mocks = vi.hoisted(() => {
  const firestoreQueryGet = vi.fn();
  const query: any = {
    where: vi.fn(() => query),
    orderBy: vi.fn(() => query),
    limit: vi.fn(() => query),
    startAfter: vi.fn(() => query),
    get: firestoreQueryGet,
  };
  return {
    protectAuthenticatedApiRequest: vi.fn(),
    protectAnonymousSignupRequest: vi.fn(),
    validateAppCheckV2: vi.fn(),
    requireVerifiedServerEntitlement: vi.fn(),
    getVertexAIClient: vi.fn(),
    firestoreDocGet: vi.fn(),
    firestoreDocSet: vi.fn(),
    firestoreDocAdd: vi.fn(),
    firestoreDocUpdate: vi.fn(),
    firestoreQueryGet,
    firestoreRunTransaction: vi.fn(),
    verifyIdToken: vi.fn(),
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
        update: mocks.firestoreDocUpdate,
      })),
      add: mocks.firestoreDocAdd,
    })),
    doc: vi.fn(() => ({
      get: mocks.firestoreDocGet,
      set: mocks.firestoreDocSet,
      update: mocks.firestoreDocUpdate,
    })),
    runTransaction: mocks.firestoreRunTransaction,
  }));

  const auth = vi.fn(() => ({
    verifyIdToken: mocks.verifyIdToken,
  }));

  return {
    default: {
      apps: [{ name: 'mock-app' }],
      initializeApp: vi.fn(),
      firestore: Object.assign(firestore, {
        FieldValue: {
          serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
          delete: vi.fn(() => 'DELETE_SENTINEL'),
          vector: vi.fn(() => 'VECTOR'),
        },
      }),
      auth,
    },
    apps: [{ name: 'mock-app' }],
    initializeApp: vi.fn(),
    firestore: Object.assign(firestore, {
      FieldValue: {
        serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
        delete: vi.fn(() => 'DELETE_SENTINEL'),
        vector: vi.fn(() => 'VECTOR'),
      },
    }),
    auth,
  };
});

vi.mock('firebase-admin/firestore', () => {
  const firestore = vi.fn(() => ({
    collection: vi.fn(() => ({
      ...mocks.query,
      doc: vi.fn(() => ({
        id: 'mock-doc-id',
        get: mocks.firestoreDocGet,
        set: mocks.firestoreDocSet,
        update: mocks.firestoreDocUpdate,
      })),
      add: mocks.firestoreDocAdd,
    })),
    doc: vi.fn(() => ({
      get: mocks.firestoreDocGet,
      set: mocks.firestoreDocSet,
      update: mocks.firestoreDocUpdate,
    })),
    runTransaction: mocks.firestoreRunTransaction,
  }));

  return {
    getFirestore: firestore,
    FieldValue: {
      serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
      delete: vi.fn(() => 'DELETE_SENTINEL'),
      vector: vi.fn(() => 'VECTOR'),
    },
  };
});

vi.mock('../../middleware/appCheck', () => ({
  validateAppCheckV2: mocks.validateAppCheckV2,
}));

vi.mock('../security/arcjet', () => ({
  protectAuthenticatedApiRequest: mocks.protectAuthenticatedApiRequest,
  protectAnonymousSignupRequest: mocks.protectAnonymousSignupRequest,
  policyClassForServerEntitlement: vi.fn(() => 'verified-free'),
}));

vi.mock('../auth/entitlements', () => ({
  requireVerifiedServerEntitlement: mocks.requireVerifiedServerEntitlement,
}));

vi.mock('../../lib/vertexClient', () => ({
  getVertexAIClient: mocks.getVertexAIClient,
}));

vi.mock('firebase-functions/v2/https', () => ({
  onCall: vi.fn((_options: unknown, handler: unknown) => handler),
  onRequest: vi.fn((_options: unknown, handler: unknown) => handler),
  HttpsError: class HttpsError extends Error {
    constructor(public code: string, message?: string, public details?: unknown) {
      super(message);
    }
  },
}));

import { setCatalogVisibility, catalogSemanticApi } from './semanticProjection';
import { manageSemanticMemory, batchEmbedText } from '../agent/manageSemanticMemory';
import { createWorkflowExecution, manageWorkflowExecution } from '../agent/workflowExecutionCallables';
import { reportBugFn } from '../agent/reportBugFn';
import { getCapabilitySnapshot } from '../agent/getCapabilitySnapshot';
import { mcpEndpoint } from '../../mcp/index';

describe('Unit 22 Admission Security: Semantic Catalog, Vector Memory, Workflows, Bug Reporting, Capability Snapshot & MCP', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.protectAuthenticatedApiRequest.mockReset();
    mocks.protectAnonymousSignupRequest.mockReset();
    mocks.protectAuthenticatedApiRequest.mockResolvedValue({ allowed: true });
    mocks.protectAnonymousSignupRequest.mockResolvedValue({ allowed: true });
    mocks.requireVerifiedServerEntitlement.mockResolvedValue({ tier: 'free' });
    mocks.firestoreDocGet.mockResolvedValue({ exists: true, data: () => ({}) });
    mocks.firestoreRunTransaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
      return cb({
        get: vi.fn().mockResolvedValue({ exists: true, data: () => ({}) }),
        set: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        create: vi.fn(),
      });
    });
  });

  const call = (fn: any, ...args: any[]) => fn(...args);

  describe('setCatalogVisibility', () => {
    it('rejects with resource-exhausted when Arcjet denies the request', async () => {
      mocks.protectAuthenticatedApiRequest.mockResolvedValueOnce({
        allowed: false,
        status: 429,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded.',
      });

      await expect(
        call(setCatalogVisibility, {
          auth: { uid: 'user-catalog-1' },
          rawRequest: { headers: {}, ip: '127.0.0.1' },
          data: { masterHash: 'master-1', visibility: 'public' },
        })
      ).rejects.toMatchObject({
        code: 'resource-exhausted',
        message: 'Rate limit exceeded.',
      });

      expect(mocks.protectAuthenticatedApiRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId: 'user-catalog-1',
          operationId: 'set-catalog-visibility:user-catalog-1',
        })
      );
    });

    it('proceeds past Arcjet admission when allowed', async () => {
      mocks.protectAuthenticatedApiRequest.mockResolvedValueOnce({ allowed: true });

      // Invalid payload will throw invalid-argument inside the business logic
      await expect(
        call(setCatalogVisibility, {
          auth: { uid: 'user-catalog-1' },
          rawRequest: { headers: {}, ip: '127.0.0.1' },
          data: {},
        })
      ).rejects.toMatchObject({
        code: 'invalid-argument',
      });

      expect(mocks.protectAuthenticatedApiRequest).toHaveBeenCalled();
    });
  });

  describe('catalogSemanticApi', () => {
    it('returns 429 when Arcjet protection denies anonymous request', async () => {
      mocks.protectAnonymousSignupRequest.mockResolvedValueOnce({
        allowed: false,
        status: 429,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too Many Requests',
      });

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        setHeader: vi.fn(),
      };

      await call(
        catalogSemanticApi,
        {
          method: 'GET',
          query: { entityId: 'track-1' },
          headers: {},
          ip: '127.0.0.1',
        },
        res
      );

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({ error: 'Too Many Requests' });
      expect(mocks.protectAnonymousSignupRequest).toHaveBeenCalledWith(
        expect.anything(),
        'catalog-semantic-api',
        'allow-low-risk-read'
      );
    });

    it('proceeds past Arcjet admission when allowed', async () => {
      mocks.protectAnonymousSignupRequest.mockResolvedValueOnce({ allowed: true });
      mocks.firestoreDocGet.mockResolvedValueOnce({ exists: false });

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        setHeader: vi.fn(),
      };

      await call(
        catalogSemanticApi,
        {
          method: 'GET',
          query: { entityId: 'track-1' },
          headers: {},
          ip: '127.0.0.1',
        },
        res
      );

      expect(mocks.protectAnonymousSignupRequest).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('manageSemanticMemory', () => {
    it('rejects with resource-exhausted when Arcjet denies the request', async () => {
      mocks.protectAuthenticatedApiRequest.mockResolvedValueOnce({
        allowed: false,
        status: 429,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded.',
      });

      await expect(
        call(manageSemanticMemory, {
          auth: { uid: 'user-mem-1', token: { firebase: { sign_in_provider: 'password' } } },
          rawRequest: { headers: {}, ip: '127.0.0.1' },
          data: { action: 'add' },
        })
      ).rejects.toMatchObject({
        code: 'resource-exhausted',
        message: 'Rate limit exceeded.',
      });

      expect(mocks.protectAuthenticatedApiRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId: 'user-mem-1',
          operationId: 'manage-semantic-memory:user-mem-1',
        })
      );
    });

    it('proceeds past Arcjet admission when allowed', async () => {
      mocks.protectAuthenticatedApiRequest.mockResolvedValueOnce({ allowed: true });

      await expect(
        call(manageSemanticMemory, {
          auth: { uid: 'user-mem-1', token: { firebase: { sign_in_provider: 'password' } } },
          rawRequest: { headers: {}, ip: '127.0.0.1' },
          data: { action: 'invalid-action' },
        })
      ).rejects.toMatchObject({
        code: 'invalid-argument',
      });

      expect(mocks.protectAuthenticatedApiRequest).toHaveBeenCalled();
    });
  });

  describe('batchEmbedText', () => {
    it('rejects with resource-exhausted when Arcjet denies the request', async () => {
      mocks.protectAuthenticatedApiRequest.mockResolvedValueOnce({
        allowed: false,
        status: 429,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded.',
      });

      await expect(
        call(batchEmbedText, {
          auth: { uid: 'user-embed-1', token: { firebase: { sign_in_provider: 'password' } } },
          rawRequest: { headers: {}, ip: '127.0.0.1' },
          data: { texts: ['test'] },
        })
      ).rejects.toMatchObject({
        code: 'resource-exhausted',
        message: 'Rate limit exceeded.',
      });

      expect(mocks.protectAuthenticatedApiRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId: 'user-embed-1',
          operationId: 'batch-embed-text:user-embed-1',
        })
      );
    });

    it('proceeds past Arcjet admission when allowed', async () => {
      mocks.protectAuthenticatedApiRequest.mockResolvedValueOnce({ allowed: true });

      await expect(
        call(batchEmbedText, {
          auth: { uid: 'user-embed-1', token: { firebase: { sign_in_provider: 'password' } } },
          rawRequest: { headers: {}, ip: '127.0.0.1' },
          data: { texts: [] },
        })
      ).rejects.toMatchObject({
        code: 'invalid-argument',
      });

      expect(mocks.protectAuthenticatedApiRequest).toHaveBeenCalled();
    });
  });

  describe('createWorkflowExecution', () => {
    it('rejects with resource-exhausted when Arcjet denies the request', async () => {
      mocks.protectAuthenticatedApiRequest.mockResolvedValueOnce({
        allowed: false,
        status: 429,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded.',
      });

      await expect(
        call(createWorkflowExecution, {
          auth: { uid: 'user-wf-1', token: { firebase: { sign_in_provider: 'password' } } },
          rawRequest: { headers: {}, ip: '127.0.0.1' },
          data: {},
        })
      ).rejects.toMatchObject({
        code: 'resource-exhausted',
        message: 'Rate limit exceeded.',
      });

      expect(mocks.protectAuthenticatedApiRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId: 'user-wf-1',
          operationId: 'create-workflow-execution:user-wf-1',
        })
      );
    });

    it('proceeds past Arcjet admission when allowed', async () => {
      mocks.protectAuthenticatedApiRequest.mockResolvedValueOnce({ allowed: true });

      await expect(
        call(createWorkflowExecution, {
          auth: { uid: 'user-wf-1', token: { firebase: { sign_in_provider: 'password' } } },
          rawRequest: { headers: {}, ip: '127.0.0.1' },
          data: {},
        })
      ).rejects.toMatchObject({
        code: 'invalid-argument',
      });

      expect(mocks.protectAuthenticatedApiRequest).toHaveBeenCalled();
    });
  });

  describe('manageWorkflowExecution', () => {
    it('rejects with resource-exhausted when Arcjet denies the request', async () => {
      mocks.protectAuthenticatedApiRequest.mockResolvedValueOnce({
        allowed: false,
        status: 429,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded.',
      });

      await expect(
        call(manageWorkflowExecution, {
          auth: { uid: 'user-wf-2', token: { firebase: { sign_in_provider: 'password' } } },
          rawRequest: { headers: {}, ip: '127.0.0.1' },
          data: {},
        })
      ).rejects.toMatchObject({
        code: 'resource-exhausted',
        message: 'Rate limit exceeded.',
      });

      expect(mocks.protectAuthenticatedApiRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId: 'user-wf-2',
          operationId: 'manage-workflow-execution:user-wf-2',
        })
      );
    });

    it('proceeds past Arcjet admission when allowed', async () => {
      mocks.protectAuthenticatedApiRequest.mockResolvedValueOnce({ allowed: true });

      await expect(
        call(manageWorkflowExecution, {
          auth: { uid: 'user-wf-2', token: { firebase: { sign_in_provider: 'password' } } },
          rawRequest: { headers: {}, ip: '127.0.0.1' },
          data: {},
        })
      ).rejects.toMatchObject({
        code: 'invalid-argument',
      });

      expect(mocks.protectAuthenticatedApiRequest).toHaveBeenCalled();
    });
  });

  describe('reportBugFn', () => {
    it('rejects with resource-exhausted when Arcjet denies the request', async () => {
      mocks.protectAuthenticatedApiRequest.mockResolvedValueOnce({
        allowed: false,
        status: 429,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded.',
      });

      await expect(
        call(reportBugFn, {
          auth: { uid: 'user-bug-1', token: { firebase: { sign_in_provider: 'password' } } },
          rawRequest: { headers: {}, ip: '127.0.0.1' },
          data: { title: 'Bug title', description: 'Bug desc' },
        })
      ).rejects.toMatchObject({
        code: 'resource-exhausted',
        message: 'Rate limit exceeded.',
      });

      expect(mocks.protectAuthenticatedApiRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId: 'user-bug-1',
          operationId: 'report-bug:user-bug-1',
        })
      );
    });

    it('proceeds past Arcjet admission when allowed', async () => {
      mocks.protectAuthenticatedApiRequest.mockResolvedValueOnce({ allowed: true });

      await expect(
        call(reportBugFn, {
          auth: { uid: 'user-bug-1', token: { firebase: { sign_in_provider: 'password' } } },
          rawRequest: { headers: {}, ip: '127.0.0.1' },
          data: {},
        })
      ).rejects.toMatchObject({
        code: 'invalid-argument',
      });

      expect(mocks.protectAuthenticatedApiRequest).toHaveBeenCalled();
    });
  });

  describe('getCapabilitySnapshot', () => {
    it('rejects with resource-exhausted when Arcjet denies the request', async () => {
      mocks.protectAuthenticatedApiRequest.mockResolvedValueOnce({
        allowed: false,
        status: 429,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded.',
      });

      await expect(
        call(getCapabilitySnapshot, {
          auth: { uid: 'user-cap-1', token: { firebase: { sign_in_provider: 'password' } } },
          rawRequest: { headers: {}, ip: '127.0.0.1' },
          data: {},
        })
      ).rejects.toMatchObject({
        code: 'resource-exhausted',
        message: 'Rate limit exceeded.',
      });

      expect(mocks.protectAuthenticatedApiRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId: 'user-cap-1',
        })
      );
    });

    it('proceeds past Arcjet admission when allowed', async () => {
      mocks.protectAuthenticatedApiRequest.mockResolvedValueOnce({ allowed: true });

      const snapshot = await call(getCapabilitySnapshot, {
        auth: { uid: 'user-cap-1', token: { firebase: { sign_in_provider: 'password' } } },
        rawRequest: { headers: {}, ip: '127.0.0.1' },
        data: {},
      });

      expect(mocks.protectAuthenticatedApiRequest).toHaveBeenCalled();
      expect(snapshot).toHaveProperty('capabilities');
    });
  });

  describe('mcpEndpoint', () => {
    it('returns 429 when Arcjet protection denies request', async () => {
      mocks.protectAuthenticatedApiRequest.mockResolvedValueOnce({
        allowed: false,
        status: 429,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded.',
      });

      const res = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await call(
        mcpEndpoint,
        {
          headers: {},
          ip: '192.168.1.1',
        },
        res
      );

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.send).toHaveBeenCalledWith('Rate limit exceeded.');
      expect(mocks.protectAuthenticatedApiRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId: 'mcp-gateway',
          operationId: 'mcp-endpoint:192.168.1.1',
        })
      );
    });

    it('proceeds past Arcjet admission when allowed', async () => {
      mocks.protectAuthenticatedApiRequest.mockResolvedValueOnce({ allowed: true });

      const req = new Readable() as any;
      req._read = () => {};
      req.method = 'GET';
      req.url = '/sse';
      req.headers = {};
      req.ip = '192.168.1.1';

      const res = new EventEmitter() as any;
      res.statusCode = 200;
      res.setHeader = vi.fn();
      res.status = vi.fn((code: number) => {
        res.statusCode = code;
        return res;
      });
      res.send = vi.fn();
      res.end = vi.fn();

      await call(mcpEndpoint, req, res);

      expect(mocks.protectAuthenticatedApiRequest).toHaveBeenCalled();
    });
  });
});
