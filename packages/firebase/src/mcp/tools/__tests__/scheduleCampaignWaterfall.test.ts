import { beforeEach, describe, expect, it, vi } from 'vitest';

const ownedGetMock = vi.fn();
const addMock = vi.fn();

const releaseDocRef = {
    get: ownedGetMock,
    collection: vi.fn(() => ({ doc: vi.fn(() => ({ get: ownedGetMock })) })),
};

const firestoreInstance = {
    collection: vi.fn((name: string) => {
        if (name === 'campaigns') return { add: addMock };
        return { doc: vi.fn(() => releaseDocRef), add: addMock };
    }),
};

vi.mock('firebase-admin', () => {
    const firestore = Object.assign(vi.fn(() => firestoreInstance), {
        FieldValue: { serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP') },
    });
    return { firestore, default: { firestore } };
});

import { scheduleCampaignWaterfall } from '../scheduleCampaignWaterfall.js';
import { McpContext } from '../../types.js';

const context = (uid: string): McpContext => ({ user: { uid } as never });

describe('scheduleCampaignWaterfall MCP tool', () => {
    beforeEach(() => {
        ownedGetMock.mockReset();
        addMock.mockReset();
        ownedGetMock.mockResolvedValue({ exists: true, data: () => ({}) });
        addMock.mockResolvedValue({ id: 'camp-1' });
    });

    it('persists a deterministic waterfall with correct month-boundary dates and whitelisted fields only', async () => {
        const result = await scheduleCampaignWaterfall.handler(
            { releaseId: 'rel-1', campaignStartDate: '2026-03-05', budget: 250, userId: 'attacker-uid', extraField: 'nope' },
            context('user-1'),
        );
        const payload = JSON.parse(result.content[0].text);

        expect(result.isError).toBeUndefined();
        expect(payload.status).toBe('succeeded');
        expect(payload.resource.type).toBe('campaign_waterfall');
        expect(payload.data.campaignId).toBe('camp-1');
        expect(payload.data.events.map((e: { key: string; date: string }) => [e.key, e.date])).toEqual([
            ['announce', '2026-02-12'],
            ['presave_push', '2026-02-19'],
            ['teaser_content', '2026-02-26'],
            ['release_day', '2026-03-05'],
            ['playlist_pitch_followup', '2026-03-08'],
            ['recap_ugc_push', '2026-03-19'],
        ]);
        expect(payload.warnings[0]).toMatch(/DRAFT/);

        const written = addMock.mock.calls[0][0];
        expect(Object.keys(written).sort()).toEqual(
            ['budget', 'createdAt', 'engine', 'events', 'initiatorUid', 'releaseId', 'startDate', 'status'].sort(),
        );
        expect(written.initiatorUid).toBe('user-1');
        expect(written.status).toBe('draft_scheduled');
        expect(written.engine).toBe('none');
        expect(written).not.toHaveProperty('userId');
        expect(written).not.toHaveProperty('extraField');
        expect(written.events.every((e: { status: string }) => e.status === 'planned')).toBe(true);
    });

    it('omits budget when not supplied', async () => {
        await scheduleCampaignWaterfall.handler({ releaseId: 'rel-1', campaignStartDate: '2026-01-01' }, context('user-1'));
        expect(addMock.mock.calls[0][0]).not.toHaveProperty('budget');
        // Year-boundary check: announce = 2025-12-11
        const events = addMock.mock.calls[0][0].events as Array<{ key: string; date: string }>;
        expect(events.find((e) => e.key === 'announce')?.date).toBe('2025-12-11');
    });

    it('fails closed with INVALID_ARGUMENT on a malformed or impossible date', async () => {
        for (const bad of ['03/05/2026', '2026-3-5', '2026-02-30', 'soon']) {
            const result = await scheduleCampaignWaterfall.handler(
                { releaseId: 'rel-1', campaignStartDate: bad },
                context('user-1'),
            );
            const payload = JSON.parse(result.content[0].text);
            expect(result.isError).toBe(true);
            expect(payload.error.code).toBe('INVALID_ARGUMENT');
        }
        expect(addMock).not.toHaveBeenCalled();
    });

    it('fails closed with INVALID_ARGUMENT on a bad budget', async () => {
        for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY, '100' as unknown as number]) {
            const result = await scheduleCampaignWaterfall.handler(
                { releaseId: 'rel-1', campaignStartDate: '2026-03-05', budget: bad },
                context('user-1'),
            );
            expect(result.isError).toBe(true);
            expect(JSON.parse(result.content[0].text).error.code).toBe('INVALID_ARGUMENT');
        }
        expect(addMock).not.toHaveBeenCalled();
    });

    it('denies scheduling against a release the caller does not own', async () => {
        ownedGetMock.mockResolvedValue({ exists: false, data: () => undefined });
        const result = await scheduleCampaignWaterfall.handler(
            { releaseId: 'rel-other', campaignStartDate: '2026-03-05' },
            context('user-1'),
        );
        const payload = JSON.parse(result.content[0].text);
        expect(result.isError).toBe(true);
        expect(payload.error.code).toBe('PERMISSION_DENIED');
        expect(addMock).not.toHaveBeenCalled();
    });
});
