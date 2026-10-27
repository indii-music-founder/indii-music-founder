import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as crypto from 'crypto';

const mocks = vi.hoisted(() => ({
  protectAuthenticated: vi.fn(),
  protectAnonymous: vi.fn(),
  validateAppCheckV2: vi.fn(),
  validateAppCheckHttp: vi.fn(),
  firestoreDocGet: vi.fn(),
  firestoreDocSet: vi.fn(),
  firestoreDocCreate: vi.fn(),
  firestoreDocUpdate: vi.fn(),
  firestoreRunTransaction: vi.fn(),
  authVerifyIdToken: vi.fn(),
}));

vi.mock('firebase-admin', () => {
  const firestore = vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        id: 'mock-doc-id',
        get: mocks.firestoreDocGet,
        set: mocks.firestoreDocSet,
        create: mocks.firestoreDocCreate,
        update: mocks.firestoreDocUpdate,
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            id: 'mock-subdoc-id',
            get: mocks.firestoreDocGet,
            set: mocks.firestoreDocSet,
            create: mocks.firestoreDocCreate,
            update: mocks.firestoreDocUpdate,
          })),
        })),
      })),
    })),
    doc: vi.fn(() => ({
      get: mocks.firestoreDocGet,
      set: mocks.firestoreDocSet,
      create: mocks.firestoreDocCreate,
      update: mocks.firestoreDocUpdate,
    })),
    runTransaction: mocks.firestoreRunTransaction,
  }));
  return {
    default: {
      apps: [{ name: 'mock-app' }],
      initializeApp: vi.fn(),
      firestore: Object.assign(firestore, {
        FieldValue: {
          serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
          increment: vi.fn((n: number) => n),
        },
      }),
      auth: vi.fn(() => ({
        verifyIdToken: mocks.authVerifyIdToken,
      })),
    },
    apps: [{ name: 'mock-app' }],
    initializeApp: vi.fn(),
    firestore: Object.assign(firestore, {
      FieldValue: {
        serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
        increment: vi.fn((n: number) => n),
      },
    }),
    auth: vi.fn(() => ({
      verifyIdToken: mocks.authVerifyIdToken,
    })),
  };
});

vi.mock('firebase-admin/firestore', () => {
  const getFirestore = vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        id: 'mock-doc-id',
        get: mocks.firestoreDocGet,
        set: mocks.firestoreDocSet,
        create: mocks.firestoreDocCreate,
        update: mocks.firestoreDocUpdate,
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            id: 'mock-subdoc-id',
            get: mocks.firestoreDocGet,
            set: mocks.firestoreDocSet,
            create: mocks.firestoreDocCreate,
            update: mocks.firestoreDocUpdate,
          })),
        })),
      })),
    })),
    doc: vi.fn(() => ({
      get: mocks.firestoreDocGet,
      set: mocks.firestoreDocSet,
      create: mocks.firestoreDocCreate,
      update: mocks.firestoreDocUpdate,
    })),
    runTransaction: mocks.firestoreRunTransaction,
  }));
  return {
    getFirestore,
    FieldValue: {
      serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
      increment: vi.fn((n: number) => n),
    },
    Timestamp: {
      now: vi.fn(() => ({ toDate: () => new Date(), toMillis: () => Date.now() })),
    },
  };
});

vi.mock('firebase-functions/v2/https', () => ({
  onCall: vi.fn((_options: unknown, handler: unknown) => handler),
  onRequest: vi.fn((_options: unknown, handler: unknown) => handler),
  HttpsError: class HttpsError extends Error {
    constructor(public code: string, message: string) {
      super(message);
    }
  },
}));

vi.mock('../config/secrets', () => ({
  arcjetKey: { name: 'ARCJET_KEY' },
  metaAppId: { name: 'META_APP_ID' },
  metaAppSecret: { value: () => 'test_meta_app_secret', name: 'META_APP_SECRET' },
  metaWebhookVerifyToken: { value: () => 'test_verify_token', name: 'META_WEBHOOK_VERIFY_TOKEN' },
}));

vi.mock('../middleware/appCheck', () => ({
  validateAppCheckV2: mocks.validateAppCheckV2,
  validateAppCheckHttp: mocks.validateAppCheckHttp,
}));

vi.mock('../functions/security/arcjet', () => ({
  protectAuthenticatedApiRequest: mocks.protectAuthenticated,
  protectAnonymousSignupRequest: mocks.protectAnonymous,
}));

import {
  sendInstagramMessageCallable,
  replyInstagramCommentCallable,
  getInstagramMediaCommentsCallable,
} from './instagramMessaging';
import { instagramWebhook } from './instagramWebhook';
import { getSocialConnectionStatus } from '../functions/social-connections';
import { syncPlatformStats } from '../functions/social-stats-sync';
import { agentStreamResponse, agentStreamHealth } from '../streaming/agentStream';

type CallableHandler = (request: {
  auth?: { uid: string; token?: Record<string, unknown> } | null;
  rawRequest?: unknown;
  data?: unknown;
}) => Promise<unknown>;

interface CallableConfig {
  name: string;
  handler: CallableHandler;
  defaultData: Record<string, unknown>;
}

const callables: CallableConfig[] = [
  {
    name: 'sendInstagramMessageCallable',
    handler: sendInstagramMessageCallable as unknown as CallableHandler,
    defaultData: {
      recipientIgUserId: 'ig-123',
      inboundEventId: 'evt-123',
      messageText: 'Hello',
    },
  },
  {
    name: 'replyInstagramCommentCallable',
    handler: replyInstagramCommentCallable as unknown as CallableHandler,
    defaultData: {
      commentId: 'comment-123',
      replyText: 'Thanks for listening!',
    },
  },
  {
    name: 'getInstagramMediaCommentsCallable',
    handler: getInstagramMediaCommentsCallable as unknown as CallableHandler,
    defaultData: {
      mediaId: 'media-123',
    },
  },
  {
    name: 'getSocialConnectionStatus',
    handler: getSocialConnectionStatus as unknown as CallableHandler,
    defaultData: {
      platform: 'instagram',
    },
  },
  {
    name: 'syncPlatformStats',
    handler: syncPlatformStats as unknown as CallableHandler,
    defaultData: {
      platform: 'instagram',
    },
  },
];

describe('Social Connections, Messaging, Webhook & Streaming Admission Gates (ISSUE-1543 Batch 14)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.validateAppCheckV2.mockImplementation(() => undefined);
    mocks.validateAppCheckHttp.mockResolvedValue(true);
    mocks.protectAuthenticated.mockResolvedValue({ allowed: true });
    mocks.protectAnonymous.mockResolvedValue({ allowed: true });
    mocks.authVerifyIdToken.mockResolvedValue({ uid: 'user-123' });

    mocks.firestoreDocGet.mockResolvedValue({
      exists: true,
      data: () => ({
        ownerId: 'user-123',
        platform: 'instagram',
        senderId: 'ig-123',
        sourceType: 'message',
        responseStatus: 'pending',
        accessToken: 'test-access-token',
        igUserId: 'ig-user-123',
        expiresAt: Date.now() + 3600_000,
      }),
      get: vi.fn((field: string) => {
        if (field === 'ownerId') return 'user-123';
        return undefined;
      }),
    });

    mocks.firestoreRunTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: mocks.firestoreDocGet,
        set: mocks.firestoreDocSet,
        create: mocks.firestoreDocCreate,
        update: mocks.firestoreDocUpdate,
      };
      return cb(tx);
    });
  });

  describe('Callable Admission Gates', () => {
    for (const { name, handler, defaultData } of callables) {
      describe(name, () => {
        it('validates App Check token', async () => {
          mocks.validateAppCheckV2.mockImplementationOnce(() => {
            throw new Error('Unauthorized: Missing App Check token.');
          });
          await expect(
            handler({
              auth: { uid: 'user-123' },
              data: defaultData,
            })
          ).rejects.toThrow('Unauthorized: Missing App Check token.');
        });

        it('rejects unauthenticated requests', async () => {
          await expect(
            handler({
              auth: null,
              data: defaultData,
            })
          ).rejects.toThrow(/authenticated|authentication|signed in/i);
        });

        it('rejects anonymous callers', async () => {
          await expect(
            handler({
              auth: {
                uid: 'anon-user',
                token: { firebase: { sign_in_provider: 'anonymous' } },
              },
              data: defaultData,
            })
          ).rejects.toThrow('Anonymous accounts may not perform this operation.');
        });

        it('enforces Arcjet protection when rawRequest is present', async () => {
          mocks.protectAuthenticated.mockResolvedValueOnce({
            allowed: false,
            status: 429,
            message: 'Too Many Requests',
          });

          await expect(
            handler({
              auth: { uid: 'user-123' },
              rawRequest: { headers: {}, ip: '127.0.0.1' },
              data: defaultData,
            })
          ).rejects.toThrow('Request rate limit exceeded. Please try again later.');

          expect(mocks.protectAuthenticated).toHaveBeenCalled();
        });
      });
    }
  });

  describe('HTTP Webhook & Streaming Admission Gates', () => {
    describe('instagramWebhook', () => {
      it('rejects when Arcjet denies the webhook', async () => {
        mocks.protectAnonymous.mockResolvedValueOnce({
          allowed: false,
          status: 429,
          message: 'Rate limit exceeded',
          retryAfterSeconds: 30,
        });

        const req = {
          method: 'POST',
          header: vi.fn().mockReturnValue('sha256=invalid'),
          headers: {},
          rawBody: Buffer.from('{}'),
        };
        const statusFn = vi.fn().mockReturnThis();
        const sendFn = vi.fn();
        const setFn = vi.fn();
        const res = { status: statusFn, send: sendFn, set: setFn };

        const webhook = instagramWebhook as unknown as (req: unknown, res: unknown) => Promise<void>;
        await webhook(req, res);

        expect(statusFn).toHaveBeenCalledWith(429);
        expect(sendFn).toHaveBeenCalledWith('Rate limit exceeded');
        expect(setFn).toHaveBeenCalledWith('Retry-After', '30');
      });

      it('responds with challenge on verified hub.mode subscription GET', async () => {
        const req = {
          method: 'GET',
          query: {
            'hub.mode': 'subscribe',
            'hub.verify_token': 'test_verify_token',
            'hub.challenge': 'challenge_code_123',
          },
          header: vi.fn(),
          headers: {},
        };
        const statusFn = vi.fn().mockReturnThis();
        const sendFn = vi.fn();
        const res = { status: statusFn, send: sendFn };

        const webhook = instagramWebhook as unknown as (req: unknown, res: unknown) => Promise<void>;
        await webhook(req, res);

        expect(statusFn).toHaveBeenCalledWith(200);
        expect(sendFn).toHaveBeenCalledWith('challenge_code_123');
      });
    });

    describe('agentStreamResponse', () => {
      it('rejects when Arcjet denies the stream request', async () => {
        mocks.protectAuthenticated.mockResolvedValueOnce({
          allowed: false,
          status: 429,
          message: 'Rate limit exceeded',
          retryAfterSeconds: 60,
        });

        const req = {
          method: 'POST',
          headers: {
            authorization: 'Bearer valid-id-token',
          },
          body: {
            userId: 'user-123',
            agentId: 'agent-1',
            input: 'Generate track description',
          },
        };
        const statusFn = vi.fn().mockReturnThis();
        const jsonFn = vi.fn();
        const setHeaderFn = vi.fn();
        const res = {
          status: statusFn,
          json: jsonFn,
          setHeader: setHeaderFn,
        };

        const stream = agentStreamResponse as unknown as (req: unknown, res: unknown) => Promise<void>;
        await stream(req, res);

        expect(statusFn).toHaveBeenCalledWith(429);
        expect(jsonFn).toHaveBeenCalledWith({ error: 'Rate limit exceeded' });
        expect(setHeaderFn).toHaveBeenCalledWith('Retry-After', '60');
      });
    });

    describe('agentStreamHealth', () => {
      it('rejects when Arcjet denies health check', async () => {
        mocks.protectAnonymous.mockResolvedValueOnce({
          allowed: false,
          status: 429,
          message: 'Rate limit exceeded',
          retryAfterSeconds: 15,
        });

        const req = {
          method: 'GET',
          headers: {},
        };
        const statusFn = vi.fn().mockReturnThis();
        const jsonFn = vi.fn();
        const setHeaderFn = vi.fn();
        const res = {
          status: statusFn,
          json: jsonFn,
          setHeader: setHeaderFn,
        };

        const health = agentStreamHealth as unknown as (req: unknown, res: unknown) => Promise<void>;
        await health(req, res);

        expect(statusFn).toHaveBeenCalledWith(429);
        expect(jsonFn).toHaveBeenCalledWith({ error: 'Rate limit exceeded' });
        expect(setHeaderFn).toHaveBeenCalledWith('Retry-After', '15');
      });

      it('returns healthy status when allowed', async () => {
        const req = {
          method: 'GET',
          headers: {},
        };
        const jsonFn = vi.fn();
        const setHeaderFn = vi.fn();
        const res = {
          json: jsonFn,
          setHeader: setHeaderFn,
        };

        const health = agentStreamHealth as unknown as (req: unknown, res: unknown) => Promise<void>;
        await health(req, res);

        expect(jsonFn).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'healthy',
            service: 'agentStreamResponse',
          })
        );
      });
    });
  });
});
