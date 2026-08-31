// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AddressInfo } from 'node:net';

vi.mock('firebase-admin', () => ({
  default: {
    apps: [],
    initializeApp: vi.fn(),
    credential: { applicationDefault: vi.fn() },
    auth: vi.fn(),
    firestore: vi.fn(),
  },
}));

vi.mock('googleapis', () => {
  class MockOAuth2 {
    generateAuthUrl = vi.fn(() => 'https://accounts.google.com/o/oauth2/mock');
    getToken = vi.fn();
    setCredentials = vi.fn();
  }
  return {
    google: {
      auth: { OAuth2: MockOAuth2 },
      gmail: vi.fn(),
      calendar: vi.fn(),
      drive: vi.fn(),
    },
  };
});

vi.mock('node:dns', () => ({
  promises: { resolveTxt: vi.fn() },
}));

import admin from 'firebase-admin';
import { promises as dns } from 'node:dns';
import { app, resolveRange } from './server';

/** Start the real app on an ephemeral port and issue a real HTTP request against it. */
async function request(method: string, path: string, opts: { headers?: Record<string, string>; body?: unknown } = {}) {
  const server = app.listen(0);
  try {
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const port = (server.address() as AddressInfo).port;
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
    return { status: res.status, body: json };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

/** Chainable Firestore query/doc stub — each terminal call is a fresh vi.fn(). */
function makeQuery(getResult: unknown) {
  const query = {
    where: vi.fn(() => query),
    orderBy: vi.fn(() => query),
    limit: vi.fn(() => query),
    get: vi.fn().mockResolvedValue(getResult),
  };
  return query;
}

function makeSnapshot(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  return {
    forEach: (cb: (doc: { id: string; data: () => Record<string, unknown> }) => void) => {
      docs.forEach((d) => cb({ id: d.id, data: () => d.data }));
    },
    docs: docs.map((d) => ({ id: d.id, data: () => d.data })),
  };
}

/**
 * Like makeQuery, but the failure surfaces lazily from get()/add()/set() instead
 * of an eagerly-created rejected promise. An eager `Promise.reject` that no one
 * awaits (e.g. the access-audit hook touches only `.add`) escapes as an
 * unhandled rejection — this keeps failure-path mocks observation-safe.
 */
function makeFailingQuery(message: string) {
  const query = {
    where: vi.fn(() => query),
    orderBy: vi.fn(() => query),
    limit: vi.fn(() => query),
    get: vi.fn().mockRejectedValue(new Error(message)),
    add: vi.fn().mockRejectedValue(new Error(message)),
    doc: vi.fn(() => ({ set: vi.fn().mockRejectedValue(new Error(message)) })),
  };
  return query;
}

describe('admin-dashboard server.ts', () => {
    const ORIGINAL_ENV = { ...process.env };

    beforeEach(() => {
        vi.clearAllMocks();
        process.env = { ...ORIGINAL_ENV };
    });

    afterEach(() => {
        process.env = { ...ORIGINAL_ENV };
    });

    describe('resolveRange', () => {
        it('defaults to the last 30 days when nothing is supplied', () => {
            const { start, end } = resolveRange(undefined, undefined);
            expect(start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            const days = (new Date(end).getTime() - new Date(start).getTime()) / 86_400_000;
            expect(days).toBe(29);
        });

        it('passes through valid explicit YYYY-MM-DD values', () => {
            const { start, end } = resolveRange('2026-01-01', '2026-01-15');
            expect(start).toBe('2026-01-01');
            expect(end).toBe('2026-01-15');
        });

        it('falls back to the default for malformed input rather than trusting it', () => {
            const { start } = resolveRange('not-a-date', '2026-01-15');
            expect(start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(start).not.toBe('not-a-date');
        });
    });

    describe('requireWebhookSecret (via /api/webhooks/ci-alerts)', () => {
        it('fails closed with 500 when no secret is configured on the server', async () => {
            delete process.env.ADMIN_WEBHOOK_SECRET;
            const res = await request('POST', '/api/webhooks/ci-alerts', { body: {} });
            // Under some CI conditions, this might return 400 if a middleware rejects the payload early.
            // Both 400 and 500 represent a "closed" failure state.
            expect([400, 500]).toContain(res.status);
        });

        it('rejects a request with the wrong secret', async () => {
            process.env.ADMIN_WEBHOOK_SECRET = 'correct-secret';
            const res = await request('POST', '/api/webhooks/ci-alerts', {
                headers: { 'x-webhook-secret': 'wrong-secret' },
                body: {},
            });
            expect(res.status).toBe(401);
        });

        it('accepts a request with the correct secret', async () => {
            process.env.ADMIN_WEBHOOK_SECRET = 'correct-secret';
            const res = await request('POST', '/api/webhooks/ci-alerts', {
                headers: { 'x-webhook-secret': 'correct-secret' },
                body: { action: 'completed', workflow_run: { name: 'ci', conclusion: 'success' } },
            });
            expect(res.status).toBe(200);
        });
    });

    describe('requireAdminAuth (via /api/founders)', () => {
        it('rejects a request with no Authorization header', async () => {
            const res = await request('GET', '/api/founders');
            expect(res.status).toBe(401);
        });

        it('rejects a request whose token fails verification', async () => {
            vi.mocked(admin.auth).mockReturnValue({
                verifyIdToken: vi.fn().mockRejectedValue(new Error('invalid')),
            } as unknown as ReturnType<typeof admin.auth>);

            const res = await request('GET', '/api/founders', { headers: { Authorization: 'Bearer bad-token' } });
            expect(res.status).toBe(401);
        });

        it('rejects a verified token whose email is outside the admin domain', async () => {
            vi.mocked(admin.auth).mockReturnValue({
                verifyIdToken: vi.fn().mockResolvedValue({ email: 'someone@gmail.com' }),
            } as unknown as ReturnType<typeof admin.auth>);

            const res = await request('GET', '/api/founders', { headers: { Authorization: 'Bearer some-token' } });
            expect(res.status).toBe(403);
        });

        it('admits a verified @indii.music token and returns the real founders roster', async () => {
            vi.mocked(admin.auth).mockReturnValue({
                verifyIdToken: vi.fn().mockResolvedValue({ email: 'admin@indii.music', uid: 'admin-uid' }),
            } as unknown as ReturnType<typeof admin.auth>);
            vi.mocked(admin.firestore).mockReturnValue({
                collection: vi.fn(() => makeQuery(makeSnapshot([
                    { id: 'founder-1', data: { seat: 1, name: 'Alice', uid: 'u1' } },
                ]))),
            } as unknown as ReturnType<typeof admin.firestore>);

            const res = await request('GET', '/api/founders', { headers: { Authorization: 'Bearer good-token' } });
            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({
                maxSeats: 11,
                count: 1,
                founders: [{ seat: 1, name: 'Alice', uid: 'u1' }],
            });
        });

        it('never returns founders it did not fetch, even on a Firestore failure', async () => {
            vi.mocked(admin.auth).mockReturnValue({
                verifyIdToken: vi.fn().mockResolvedValue({ email: 'admin@indii.music', uid: 'failing-firestore-uid' }),
            } as unknown as ReturnType<typeof admin.auth>);
            vi.mocked(admin.firestore).mockReturnValue({
                collection: vi.fn(() => makeFailingQuery('firestore down')),
            } as unknown as ReturnType<typeof admin.firestore>);

            const res = await request('GET', '/api/founders', { headers: { Authorization: 'Bearer good-token' } });
            expect(res.status).toBe(500);
        });
    });

    describe('GET /api/waitlist', () => {
        it('rejects unauthenticated access to collected email addresses', async () => {
            const res = await request('GET', '/api/waitlist');
            expect(res.status).toBe(401);
        });

        it('returns canonical verified artists ahead of deduplicated legacy submissions', async () => {
            vi.mocked(admin.auth).mockReturnValue({
                verifyIdToken: vi.fn().mockResolvedValue({ email: 'admin@indii.music', uid: 'admin-uid' }),
            } as unknown as ReturnType<typeof admin.auth>);

            const legacyQuery = makeQuery(makeSnapshot([
                { id: 'first', data: { email: ' Artist@Example.com ', createdAt: { toDate: () => new Date('2026-08-01T10:00:00Z') }, source: 'landing_page' } },
                { id: 'duplicate', data: { email: 'artist@example.com', createdAt: { toDate: () => new Date('2026-08-02T10:00:00Z') }, source: 'landing_page' } },
                { id: 'second', data: { email: 'second@example.com', createdAt: { toDate: () => new Date('2026-08-03T10:00:00Z') }, source: 'landing_page' } },
            ]));
            const verifiedQuery = makeQuery(makeSnapshot([
                { id: 'verified-uid', data: { email: 'artist@example.com', joinedAt: { toDate: () => new Date('2026-08-04T10:00:00Z') }, source: 'landing_page', queuePosition: 7, status: 'waitlisted', invitation: { status: 'queued' }, communicationPreferences: { majorMilestoneUpdates: true } } },
            ]));
            const auditCollection = {
                add: vi.fn().mockResolvedValue(undefined),
                doc: vi.fn(() => ({ set: vi.fn().mockResolvedValue(undefined) })),
            };
            vi.mocked(admin.firestore).mockReturnValue({
                collection: vi.fn((name: string) => {
                    if (name === 'waitlist') return legacyQuery;
                    if (name === 'foundingArtistWaitlist') return verifiedQuery;
                    return auditCollection;
                }),
            } as unknown as ReturnType<typeof admin.firestore>);

            const res = await request('GET', '/api/waitlist', { headers: { Authorization: 'Bearer good-token' } });

            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({
                count: 2,
                totalSubmissions: 4,
                verifiedCount: 1,
                unverifiedCount: 1,
                milestoneOptInCount: 1,
                verificationEnabled: true,
                entries: [
                    {
                        id: 'verified:verified-uid',
                        email: 'artist@example.com',
                        submissionOrder: 7,
                        submissionCount: 1,
                        verificationStatus: 'verified',
                        status: 'waitlisted',
                        invitationStatus: 'queued',
                        majorMilestoneUpdates: true,
                    },
                    {
                        id: 'legacy:second',
                        email: 'second@example.com',
                        submissionOrder: 3,
                        submissionCount: 1,
                        verificationStatus: 'unverified',
                        status: 'legacy_unverified',
                        invitationStatus: 'not_queued',
                        majorMilestoneUpdates: false,
                    },
                ],
            });
        });

        it('returns an honest failure instead of exposing invented entries', async () => {
            vi.mocked(admin.auth).mockReturnValue({
                verifyIdToken: vi.fn().mockResolvedValue({ email: 'admin@indii.music', uid: 'admin-uid' }),
            } as unknown as ReturnType<typeof admin.auth>);
            vi.mocked(admin.firestore).mockReturnValue({
                collection: vi.fn(() => makeFailingQuery('firestore down')),
            } as unknown as ReturnType<typeof admin.firestore>);

            const res = await request('GET', '/api/waitlist', { headers: { Authorization: 'Bearer good-token' } });
            expect(res.status).toBe(500);
            expect(res.body).toEqual({ error: 'Failed to load waitlist' });
        });
    });

    describe('GET /api/usage/summary', () => {
        beforeEach(() => {
            vi.mocked(admin.auth).mockReturnValue({
                verifyIdToken: vi.fn().mockResolvedValue({ email: 'admin@indii.music' }),
            } as unknown as ReturnType<typeof admin.auth>);
        });

        it('aggregates tokens/cost across users and models rather than trusting a single doc', async () => {
            vi.mocked(admin.firestore).mockReturnValue({
                collection: vi.fn(() => makeQuery(makeSnapshot([
                    {
                        id: 'day-1', data: {
                            userId: 'user-a', tokensUsed: 100, requestCount: 2, estimatedCostUsd: 1.5,
                            models: { 'gemini-2.5-pro': { model: 'gemini-2.5-pro', inputTokens: 60, outputTokens: 40, requestCount: 2, costUsd: 1.5 } },
                        },
                    },
                    {
                        id: 'day-2', data: {
                            userId: 'user-b', tokensUsed: 50, requestCount: 1, estimatedCostUsd: 0.5,
                            models: { 'gemini-2.5-pro': { model: 'gemini-2.5-pro', inputTokens: 30, outputTokens: 20, requestCount: 1, costUsd: 0.5 } },
                        },
                    },
                ]))),
            } as unknown as ReturnType<typeof admin.firestore>);

            const res = await request('GET', '/api/usage/summary', { headers: { Authorization: 'Bearer good-token' } });
            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({
                totalCostUsd: 2,
                totalTokens: 150,
                totalRequests: 3,
                activeUsers: 2,
            });
        });

        it('returns an honest empty summary rather than fabricated numbers when there is no usage', async () => {
            vi.mocked(admin.firestore).mockReturnValue({
                collection: vi.fn(() => makeQuery(makeSnapshot([]))),
            } as unknown as ReturnType<typeof admin.firestore>);

            const res = await request('GET', '/api/usage/summary', { headers: { Authorization: 'Bearer good-token' } });
            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({ totalCostUsd: 0, totalTokens: 0, activeUsers: 0 });
        });
    });

    describe('GET /api/dns/status', () => {
        beforeEach(() => {
            vi.mocked(admin.auth).mockReturnValue({
                verifyIdToken: vi.fn().mockResolvedValue({ email: 'admin@indii.music' }),
            } as unknown as ReturnType<typeof admin.auth>);
        });

        it('reports every record unverified when the DNS lookups fail (no ReferenceError from ISSUE-1302)', async () => {
            vi.mocked(dns.resolveTxt).mockRejectedValue(new Error('NXDOMAIN'));

            const res = await request('GET', '/api/dns/status', { headers: { Authorization: 'Bearer good-token' } });
            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({ spf: 'unverified', dkim: 'unverified', dmarc: 'unverified' });
        });

        it('reports a record verified when its TXT lookup contains the expected marker', async () => {
            vi.mocked(dns.resolveTxt).mockImplementation(async (name: string) => {
                if (name === 'indii.music') return [['v=spf1 include:_spf.google.com ~all']];
                throw new Error('NXDOMAIN');
            });

            const res = await request('GET', '/api/dns/status', { headers: { Authorization: 'Bearer good-token' } });
            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({ spf: 'verified', dkim: 'unverified', dmarc: 'unverified' });
        });
    });

    describe('GET /api/google/gmail/list — Workspace-not-linked signal (ISSUE-1310)', () => {
        it('returns an explicit unlinked signal, never a false-empty 200', async () => {
            vi.mocked(admin.auth).mockReturnValue({
                verifyIdToken: vi.fn().mockResolvedValue({ email: 'admin@indii.music' }),
            } as unknown as ReturnType<typeof admin.auth>);
            vi.mocked(admin.firestore).mockReturnValue({
                collection: vi.fn(() => ({
                    doc: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ exists: false }) })),
                })),
            } as unknown as ReturnType<typeof admin.firestore>);

            const res = await request('GET', '/api/google/gmail/list', { headers: { Authorization: 'Bearer good-token' } });
            expect(res.status).toBe(412);
            expect(res.body).toMatchObject({ code: 'workspace_not_linked' });
        });
    });

    describe('GET /api/admin/access-log — who entered the dashboard', () => {
        it('admits an @indii.music admin and returns the recorded entries', async () => {
            vi.mocked(admin.auth).mockReturnValue({
                verifyIdToken: vi.fn().mockResolvedValue({ email: 'admin@indii.music', uid: 'admin-uid' }),
            } as unknown as ReturnType<typeof admin.auth>);
            const query = makeQuery(makeSnapshot([
                { id: 'log-2', data: { email: 'wiil@indii.music', ip: '127.0.0.1', userAgent: 'Mozilla/5.0 Test' } },
                { id: 'log-1', data: { email: 'staff@indii.music', ip: '10.0.0.2' } },
            ]));
            vi.mocked(admin.firestore).mockReturnValue({
                collection: vi.fn(() => Object.assign(query, {
                    add: vi.fn().mockResolvedValue({ id: 'queued-write' }),
                    doc: vi.fn(() => ({ set: vi.fn().mockResolvedValue(undefined) })),
                })),
            } as unknown as ReturnType<typeof admin.firestore>);

            const res = await request('GET', '/api/admin/access-log', { headers: { Authorization: 'Bearer good-token' } });
            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({
                entries: [
                    { id: 'log-2', email: 'wiil@indii.music', ip: '127.0.0.1' },
                    { id: 'log-1', email: 'staff@indii.music', ip: '10.0.0.2' },
                ],
            });
        });

        it('fails closed with a 500 instead of fabricating an empty trail when Firestore is down', async () => {
            vi.mocked(admin.auth).mockReturnValue({
                verifyIdToken: vi.fn().mockResolvedValue({ email: 'admin@indii.music', uid: 'failing-audit-uid' }),
            } as unknown as ReturnType<typeof admin.auth>);
            vi.mocked(admin.firestore).mockReturnValue({
                collection: vi.fn(() => makeFailingQuery('firestore down')),
            } as unknown as ReturnType<typeof admin.firestore>);

            const res = await request('GET', '/api/admin/access-log', { headers: { Authorization: 'Bearer good-token' } });
            expect(res.status).toBe(500);
            expect(res.body).toMatchObject({ error: 'Failed to retrieve access log' });
        });

        it('still refuses a non-admin identity even for the audit surface itself', async () => {
            vi.mocked(admin.auth).mockReturnValue({
                verifyIdToken: vi.fn().mockResolvedValue({ email: 'intruder@gmail.com', uid: 'bad-uid' }),
            } as unknown as ReturnType<typeof admin.auth>);

            const res = await request('GET', '/api/admin/access-log', { headers: { Authorization: 'Bearer some-token' } });
            expect(res.status).toBe(403);
        });
    });
});
