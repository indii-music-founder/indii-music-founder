import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  protectAuthenticated: vi.fn(),
  protectAnonymous: vi.fn(),
  validateAppCheck: vi.fn(),
  firestoreDocGet: vi.fn(),
  firestoreDocSet: vi.fn(),
  queryWarehouse: vi.fn(),
}));

vi.mock('firebase-admin', () => {
  const firestore = vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: mocks.firestoreDocGet,
        set: mocks.firestoreDocSet,
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            get: mocks.firestoreDocGet,
            set: mocks.firestoreDocSet,
          })),
        })),
      })),
      add: vi.fn().mockResolvedValue({ id: 'doc-123' }),
      where: vi.fn().mockReturnThis(),
    })),
  }));
  Object.assign(firestore, {
    FieldValue: { serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP') },
    Timestamp: {
      now: vi.fn(() => ({ toDate: () => new Date(), toMillis: () => Date.now() })),
      fromDate: vi.fn((d: Date) => ({ toDate: () => d, toMillis: () => d.getTime() })),
    },
  });
  return {
    default: { firestore },
    firestore,
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

vi.mock('firebase-functions/params', () => ({
  defineString: vi.fn(() => ({ value: vi.fn(() => 'https://bounty.test') })),
  defineSecret: vi.fn((name: string) => ({ name, value: vi.fn(() => '') })),
}));

vi.mock('../config/secrets', () => ({
  arcjetKey: { name: 'ARCJET_KEY' },
  typesafeApiKey: { name: 'TYPESAFE_API_KEY' },
}));

vi.mock('../functions/security/arcjet', () => ({
  protectAuthenticatedApiRequest: mocks.protectAuthenticated,
  protectAnonymousSignupRequest: mocks.protectAnonymous,
}));

vi.mock('../middleware/appCheck', () => ({
  validateAppCheckV2: mocks.validateAppCheck,
}));

vi.mock('./clickhouseClient', () => ({
  queryWarehouse: mocks.queryWarehouse,
  WAREHOUSE_SECRETS: [],
  ClickHouseError: class ClickHouseError extends Error {},
}));

vi.mock('./facebookAdsExecutor', () => ({
  getAdAccountId: vi.fn().mockResolvedValue('act_123'),
  createCampaign: vi.fn().mockResolvedValue({ success: true, campaignId: 'cmp_123' }),
  createAdSet: vi.fn().mockResolvedValue({ success: true, adSetId: 'adset_123' }),
  createAd: vi.fn().mockResolvedValue({ success: true, adId: 'ad_123' }),
  pauseAd: vi.fn().mockResolvedValue({ success: true }),
}));

import {
  createAdCampaign,
  createAdSet,
  createAd,
  getAdInsights,
  pauseAdCampaign,
  getSocialPostInsights,
  syncEmailList,
  deployEmailCampaign,
  getEmailCampaignStats,
  sendSMSBlast,
  getSMSDeliveryStatus,
} from './marketingCallables';

import {
  executeUnifiedCampaignDirective,
  ingestUnifiedAttributionEvent,
} from '../functions/marketing/adCampaignCallables';

import { marketingGetCampaignMetrics } from './campaignMetricsCallable';
import { createPreSaveCampaign } from './presaveCampaigns';
import { executeCampaign, dispatchSocialPost, createInfluencerBounty } from '../lib/marketing';
import { smartLinkRedirect } from './smartLink';

const baseRequest = (overrides: Record<string, unknown> = {}) => ({
  auth: {
    uid: 'artist_marketing_1',
    token: {
      email_verified: true,
      firebase: { sign_in_provider: 'password' },
    },
  },
  data: {},
  rawRequest: { method: 'POST', headers: {} },
  ...overrides,
}) as never;

describe('Marketing Callables Admission & Arcjet Protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.protectAuthenticated.mockResolvedValue({ allowed: true });
    mocks.protectAnonymous.mockResolvedValue({ allowed: true });
    mocks.firestoreDocGet.mockResolvedValue({ exists: false, data: () => ({}) });
  });

  const callables = [
    { name: 'createAdCampaign', fn: createAdCampaign },
    { name: 'createAdSet', fn: createAdSet },
    { name: 'createAd', fn: createAd },
    { name: 'getAdInsights', fn: getAdInsights },
    { name: 'pauseAdCampaign', fn: pauseAdCampaign },
    { name: 'getSocialPostInsights', fn: getSocialPostInsights },
    { name: 'syncEmailList', fn: syncEmailList },
    { name: 'deployEmailCampaign', fn: deployEmailCampaign },
    { name: 'getEmailCampaignStats', fn: getEmailCampaignStats },
    { name: 'sendSMSBlast', fn: sendSMSBlast },
    { name: 'getSMSDeliveryStatus', fn: getSMSDeliveryStatus },
    { name: 'executeUnifiedCampaignDirective', fn: executeUnifiedCampaignDirective },
    { name: 'ingestUnifiedAttributionEvent', fn: ingestUnifiedAttributionEvent },
    { name: 'marketingGetCampaignMetrics', fn: marketingGetCampaignMetrics },
    { name: 'createPreSaveCampaign', fn: createPreSaveCampaign },
    { name: 'executeCampaign', fn: executeCampaign },
    { name: 'dispatchSocialPost', fn: dispatchSocialPost },
    { name: 'createInfluencerBounty', fn: createInfluencerBounty },
  ];

  for (const { name, fn } of callables) {
    describe(`${name} admission`, () => {
      const invoke = fn as unknown as (req: unknown) => Promise<unknown>;

      it('rejects unauthenticated requests', async () => {
        await expect(invoke(baseRequest({ auth: null }))).rejects.toMatchObject({
          code: 'unauthenticated',
        });
      });

      it('rejects anonymous callers', async () => {
        await expect(
          invoke(
            baseRequest({
              auth: {
                uid: 'anon_user',
                token: { firebase: { sign_in_provider: 'anonymous' }, email_verified: true },
              },
            })
          )
        ).rejects.toMatchObject({ code: 'permission-denied' });
      });

      it('rejects unverified email accounts', async () => {
        await expect(
          invoke(
            baseRequest({
              auth: {
                uid: 'unverified_user',
                token: { firebase: { sign_in_provider: 'password' }, email_verified: false },
              },
            })
          )
        ).rejects.toMatchObject({ code: 'permission-denied' });
      });

      it('enforces Arcjet rate limits on authenticated requests', async () => {
        mocks.protectAuthenticated.mockResolvedValueOnce({
          allowed: false,
          status: 429,
          message: 'Rate limit exceeded.',
        });
        await expect(invoke(baseRequest())).rejects.toMatchObject({
          code: 'resource-exhausted',
        });
      });

      it('enforces Arcjet denial with permission-denied', async () => {
        mocks.protectAuthenticated.mockResolvedValueOnce({
          allowed: false,
          status: 403,
          message: 'Forbidden.',
        });
        await expect(invoke(baseRequest())).rejects.toMatchObject({
          code: 'permission-denied',
        });
      });
    });
  }

  describe('smartLinkRedirect admission', () => {
    it('enforces Arcjet rate limiting on HTTP smart link redirects', async () => {
      mocks.protectAnonymous.mockResolvedValueOnce({
        allowed: false,
        status: 429,
        message: 'Rate limit exceeded.',
      });

      const res = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      };
      const req = {
        path: '/summer-track',
        query: {},
      };

      const handler = smartLinkRedirect as unknown as (req: unknown, res: unknown) => Promise<void>;
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.send).toHaveBeenCalledWith('Rate limit exceeded.');
    });
  });
});
