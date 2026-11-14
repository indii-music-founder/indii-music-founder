import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';

const mocks = vi.hoisted(() => {
  const firestoreQueryGet = vi.fn();
  const query: any = {
    where: vi.fn(() => query),
    orderBy: vi.fn(() => query),
    limit: vi.fn(() => query),
    get: firestoreQueryGet,
  };
  return {
    protectAuthenticated: vi.fn(),
    protectAnonymous: vi.fn(),
    validateAppCheck: vi.fn(),
    firestoreDocGet: vi.fn(),
    firestoreDocSet: vi.fn(),
    firestoreDocCreate: vi.fn(),
    firestoreDocUpdate: vi.fn(),
    firestoreDocDelete: vi.fn(),
    firestoreQueryGet,
    firestoreRunTransaction: vi.fn(),
    storageBucket: vi.fn(),
    resendSend: vi.fn(),
    verifyIdToken: vi.fn(),
    createCustomToken: vi.fn(),
    query,
  };
});

vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = {
      send: mocks.resendSend,
    };
  },
}));

vi.mock('firebase-admin', () => {
  const firestore = vi.fn(() => ({
    collection: vi.fn(() => ({
      ...mocks.query,
      doc: vi.fn(() => ({
        id: 'mock-doc-id',
        get: mocks.firestoreDocGet,
        set: mocks.firestoreDocSet,
        create: mocks.firestoreDocCreate,
        update: mocks.firestoreDocUpdate,
        delete: mocks.firestoreDocDelete,
        collection: vi.fn(() => ({
          ...mocks.query,
          doc: vi.fn(() => ({
            id: 'mock-subdoc-id',
            get: mocks.firestoreDocGet,
            set: mocks.firestoreDocSet,
            create: mocks.firestoreDocCreate,
            update: mocks.firestoreDocUpdate,
            delete: mocks.firestoreDocDelete,
          })),
          add: vi.fn().mockResolvedValue({ id: 'mock-add-id' }),
        })),
      })),
      add: vi.fn().mockResolvedValue({ id: 'mock-add-id' }),
    })),
    doc: vi.fn(() => ({
      get: mocks.firestoreDocGet,
      set: mocks.firestoreDocSet,
      create: mocks.firestoreDocCreate,
      update: mocks.firestoreDocUpdate,
      delete: mocks.firestoreDocDelete,
    })),
    batch: vi.fn(() => ({
      set: mocks.firestoreDocSet,
      update: mocks.firestoreDocUpdate,
      delete: mocks.firestoreDocDelete,
      commit: vi.fn().mockResolvedValue([]),
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
        verifyIdToken: mocks.verifyIdToken,
        createCustomToken: mocks.createCustomToken,
      })),
      storage: vi.fn(() => ({
        bucket: mocks.storageBucket,
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
      verifyIdToken: mocks.verifyIdToken,
      createCustomToken: mocks.createCustomToken,
    })),
    storage: vi.fn(() => ({
      bucket: mocks.storageBucket,
    })),
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
}));

vi.mock('../../config/secrets', () => ({
  arcjetKey: { name: 'ARCJET_KEY' },
}));

vi.mock('../middleware/appCheck', () => ({
  validateAppCheckV2: mocks.validateAppCheck,
  requireVerifiedEmailV2: vi.fn((request: { auth?: { uid?: string } }) => {
    if (!request.auth?.uid) {
      const error = new Error('User must be authenticated.');
      (error as unknown as { code: string }).code = 'unauthenticated';
      throw error;
    }
    return request.auth.uid;
  }),
}));

vi.mock('../../middleware/appCheck', () => ({
  validateAppCheckV2: mocks.validateAppCheck,
  requireVerifiedEmailV2: vi.fn((request: { auth?: { uid?: string } }) => {
    if (!request.auth?.uid) {
      const error = new Error('User must be authenticated.');
      (error as unknown as { code: string }).code = 'unauthenticated';
      throw error;
    }
    return request.auth.uid;
  }),
}));

vi.mock('../functions/security/arcjet', () => ({
  protectAuthenticatedApiRequest: mocks.protectAuthenticated,
  protectAnonymousSignupRequest: mocks.protectAnonymous,
}));

vi.mock('../security/arcjet', () => ({
  protectAuthenticatedApiRequest: mocks.protectAuthenticated,
  protectAnonymousSignupRequest: mocks.protectAnonymous,
}));

vi.mock('../lib/rateLimit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(undefined),
}));

import { sendEmail } from './sendEmail';
import { emailExchangeToken, emailRefreshToken, emailRevokeToken } from './tokenManager';
import { acceptFoundingArtistInvitation, joinFoundingArtistWaitlist } from '../foundingArtist/waitlist';
import { inviteNextFoundingArtist, queueFoundingArtistMilestoneUpdate } from '../foundingArtist/admin';
import { createHandoffCode, redeemHandoffCode } from '../functions/auth/handoff';
import { fetchStorageAssetForCanvas } from '../functions/storage/fetchStorageAssetForCanvas';
import { generateReleaseDownloadUrl } from '../releases/generateDownloadUrl';

type CallableHandler = (request: {
  auth?: { uid: string; token?: Record<string, unknown> } | null;
  rawRequest?: unknown;
  data?: unknown;
}) => Promise<unknown>;

interface CallableConfig {
  name: string;
  handler: CallableHandler;
  defaultData: Record<string, unknown>;
  expectedOpPrefix: string;
  tokenClaims?: Record<string, unknown>;
  docOverrides?: Record<string, unknown>;
}

const callables: CallableConfig[] = [
  {
    name: 'sendEmail',
    handler: sendEmail as unknown as CallableHandler,
    defaultData: {
      to: 'artist@indii.music',
      subject: 'Welcome to indii',
      text: 'Welcome aboard!',
    },
    expectedOpPrefix: 'send-email:',
  },
  {
    name: 'emailExchangeToken',
    handler: emailExchangeToken as unknown as CallableHandler,
    defaultData: {
      code: 'oauth-auth-code',
      provider: 'gmail',
      redirectUri: 'https://app.indii.music/auth/gmail/callback',
    },
    expectedOpPrefix: 'email-exchange-token:',
  },
  {
    name: 'emailRefreshToken',
    handler: emailRefreshToken as unknown as CallableHandler,
    defaultData: {
      provider: 'gmail',
    },
    expectedOpPrefix: 'email-refresh-token:',
  },
  {
    name: 'emailRevokeToken',
    handler: emailRevokeToken as unknown as CallableHandler,
    defaultData: {
      provider: 'gmail',
    },
    expectedOpPrefix: 'email-revoke-token:',
  },
  {
    name: 'joinFoundingArtistWaitlist',
    handler: joinFoundingArtistWaitlist as unknown as CallableHandler,
    defaultData: {
      source: 'landing_page',
      majorMilestoneUpdates: true,
    },
    expectedOpPrefix: 'founding-artist-waitlist:',
    tokenClaims: { email: 'artist@indii.music', email_verified: true },
  },
  {
    name: 'acceptFoundingArtistInvitation',
    handler: acceptFoundingArtistInvitation as unknown as CallableHandler,
    defaultData: {},
    expectedOpPrefix: 'founding-artist-accept:',
    tokenClaims: { email: 'artist@indii.music', email_verified: true },
    docOverrides: { status: 'invited', invitation: { status: 'sent', communicationId: 'comm-1' } },
  },
  {
    name: 'inviteNextFoundingArtist',
    handler: inviteNextFoundingArtist as unknown as CallableHandler,
    defaultData: {},
    expectedOpPrefix: 'founding-artist-invite:',
    tokenClaims: { email: 'admin@indii.music', email_verified: true },
  },
  {
    name: 'queueFoundingArtistMilestoneUpdate',
    handler: queueFoundingArtistMilestoneUpdate as unknown as CallableHandler,
    defaultData: {
      requestId: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6',
      subject: 'Milestone Update',
      message: 'Exciting product updates from indii team.',
    },
    expectedOpPrefix: 'founding-artist-milestone:',
    tokenClaims: { email: 'admin@indii.music', email_verified: true },
  },
  {
    name: 'fetchStorageAssetForCanvas',
    handler: fetchStorageAssetForCanvas as unknown as CallableHandler,
    defaultData: {
      uri: 'gs://test-bucket/users/user-1/assets/asset.png',
    },
    expectedOpPrefix: 'fetch-storage-asset-canvas:',
  },
  {
    name: 'generateReleaseDownloadUrl',
    handler: generateReleaseDownloadUrl as unknown as CallableHandler,
    defaultData: {
      platform: 'mac',
    },
    expectedOpPrefix: 'release-download:',
  },
];

describe('Unit 19 Admission: Email, Founding Artist, Auth Handoff & Storage (ISSUE-1543 Batch 16)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            access_token: 'mock-access-token',
            refresh_token: 'mock-refresh-token',
            expires_in: 3600,
            emailAddress: 'artist@indii.music',
            mail: 'artist@indii.music',
          }),
          { status: 200 },
        ),
      ),
    );
    const emailHash = createHash('sha256').update('artist@indii.music').digest('hex');
    mocks.protectAuthenticated.mockResolvedValue({ allowed: true });
    mocks.protectAnonymous.mockResolvedValue({ allowed: true });
    mocks.resendSend.mockResolvedValue({ data: { id: 'resend-msg-123' }, error: null });
    mocks.verifyIdToken.mockResolvedValue({ uid: 'user-1' });
    mocks.createCustomToken.mockResolvedValue('custom-token-xyz');
    mocks.firestoreQueryGet.mockResolvedValue({
      empty: false,
      docs: [
        {
          id: 'artist-1',
          data: () => ({
            email: 'artist@indii.music',
            emailVerified: true,
            status: 'waitlisted',
            communicationPreferences: { majorMilestoneUpdates: true },
          }),
        },
      ],
    });
    mocks.firestoreDocGet.mockResolvedValue({
      exists: true,
      data: () => ({
        uid: 'user-1',
        email: 'artist@indii.music',
        emailHash,
        emailVerified: true,
        status: 'waitlisted',
        queuePosition: 1,
        subscriptionTier: 'founder',
        isFounder: true,
        expiresAt: { toDate: () => new Date(Date.now() + 60000) },
        idToken: 'mock-id-token',
        accessToken: 'mock-access-token',
        userId: 'user-1',
        refreshToken: 'mock-refresh-token',
        communicationPreferences: { majorMilestoneUpdates: true },
      }),
    });
    mocks.firestoreDocSet.mockResolvedValue({ id: 'saved-id' });
    mocks.firestoreDocUpdate.mockResolvedValue({});
    mocks.firestoreDocDelete.mockResolvedValue({});
    mocks.firestoreRunTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      return callback({
        get: vi.fn((refOrQuery: any) => {
          if (refOrQuery?.where || refOrQuery?.orderBy || refOrQuery?.limit) {
            return mocks.firestoreQueryGet();
          }
          return mocks.firestoreDocGet();
        }),
        set: mocks.firestoreDocSet,
        update: mocks.firestoreDocUpdate,
        delete: mocks.firestoreDocDelete,
      });
    });
    mocks.storageBucket.mockReturnValue({
      name: 'test-bucket',
      file: vi.fn(() => ({
        exists: vi.fn().mockResolvedValue([true]),
        getSignedUrl: vi.fn().mockResolvedValue(['https://signed.url/download']),
        getMetadata: vi.fn().mockResolvedValue([{ size: 1024, contentType: 'image/png' }]),
        download: vi.fn().mockResolvedValue([Buffer.from('mock-asset-data')]),
      })),
    });
  });

  for (const { name, handler, defaultData, expectedOpPrefix, tokenClaims, docOverrides } of callables) {
    describe(`${name} callable boundary`, () => {
      it('validates App Check on every request', async () => {
        mocks.validateAppCheck.mockImplementationOnce(() => {
          throw new Error('Missing App Check token.');
        });

        await expect(
          handler({
            auth: { uid: 'user-1', token: { email: 'user@indii.music', email_verified: true, ...(tokenClaims ?? {}) } },
            rawRequest: { headers: { 'x-arcjet-test': '1' } },
            data: defaultData,
          }),
        ).rejects.toThrow('Missing App Check token.');
        expect(mocks.validateAppCheck).toHaveBeenCalled();
      });

      it('rejects unauthenticated requests', async () => {
        await expect(
          handler({
            auth: null,
            rawRequest: { headers: {} },
            data: defaultData,
          }),
        ).rejects.toMatchObject({ code: 'unauthenticated' });
      });

      it('rejects anonymous accounts', async () => {
        await expect(
          handler({
            auth: {
              uid: 'anon-1',
              token: {
                firebase: { sign_in_provider: 'anonymous' },
                email: 'anon@indii.music',
                email_verified: true,
                ...(tokenClaims ?? {}),
              },
            },
            rawRequest: { headers: {} },
            data: defaultData,
          }),
        ).rejects.toMatchObject({
          code: expect.stringMatching(/permission-denied|unauthenticated/),
        });
      });

      it('blocks request when Arcjet protection denies rate limit', async () => {
        mocks.protectAuthenticated.mockResolvedValueOnce({
          allowed: false,
          status: 429,
          message: 'Rate limit exceeded',
        });

        await expect(
          handler({
            auth: {
              uid: 'user-1',
              token: { email: 'user@indii.music', email_verified: true, ...(tokenClaims ?? {}) },
            },
            rawRequest: { headers: { 'x-forwarded-for': '127.0.0.1' } },
            data: defaultData,
          }),
        ).rejects.toMatchObject({ code: 'resource-exhausted' });

        expect(mocks.protectAuthenticated).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            userId: 'user-1',
            policy: 'verified-free',
            operationId: expect.stringContaining(expectedOpPrefix),
          }),
        );
      });

      it('allows request when validly authenticated and Arcjet allows', async () => {
        mocks.protectAuthenticated.mockResolvedValueOnce({ allowed: true });
        if (docOverrides) {
          const baseSnapshot = await mocks.firestoreDocGet();
          const baseData = baseSnapshot.data();
          mocks.firestoreDocGet.mockResolvedValueOnce({
            exists: true,
            data: () => ({ ...baseData, ...docOverrides }),
          });
        }

        const result = await handler({
          auth: {
            uid: 'user-1',
            token: { email: 'user@indii.music', email_verified: true, ...(tokenClaims ?? {}) },
          },
          rawRequest: { headers: { 'x-forwarded-for': '127.0.0.1' } },
          data: defaultData,
        });

        expect(mocks.protectAuthenticated).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            userId: 'user-1',
            policy: 'verified-free',
            operationId: expect.stringContaining(expectedOpPrefix),
          }),
        );
        expect(result).toBeDefined();
      });
    });
  }

  describe('HTTP handoff triggers (onRequest)', () => {
    type HttpHandler = (req: unknown, res: unknown) => Promise<void>;

    it('createHandoffCode blocks request when Arcjet denies rate limit', async () => {
      mocks.protectAnonymous.mockResolvedValueOnce({
        allowed: false,
        status: 429,
        message: 'Rate limit exceeded',
        retryAfterSeconds: 60,
      });

      const res = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
        setHeader: vi.fn(),
      };

      await (createHandoffCode as unknown as HttpHandler)(
        { method: 'POST', body: { idToken: 'token' } },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '60');
      expect(res.send).toHaveBeenCalledWith('Rate limit exceeded');
      expect(mocks.protectAnonymous).toHaveBeenCalledWith(
        expect.anything(),
        'auth-handoff-create',
        'allow-low-risk-read',
      );
    });

    it('redeemHandoffCode blocks request when Arcjet denies rate limit', async () => {
      mocks.protectAnonymous.mockResolvedValueOnce({
        allowed: false,
        status: 429,
        message: 'Rate limit exceeded',
        retryAfterSeconds: 30,
      });

      const res = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
        setHeader: vi.fn(),
      };

      await (redeemHandoffCode as unknown as HttpHandler)(
        { method: 'POST', body: { code: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' } },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '30');
      expect(res.send).toHaveBeenCalledWith('Rate limit exceeded');
      expect(mocks.protectAnonymous).toHaveBeenCalledWith(
        expect.anything(),
        'auth-handoff-redeem',
        'allow-low-risk-read',
      );
    });
  });
});
