import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConversionEvent } from '@indii/shared';

/**
 * The property under test is the one that protects the artist's numbers:
 * a crash between "insert succeeded" and "mark flushed" must not double-count
 * a conversion in the materialized view, because the view can never un-count it.
 */

const warehouse = vi.hoisted(() => ({
    inserted: [] as Array<{ table: string; rows: ReadonlyArray<Record<string, unknown>> }>,
    existingIds: new Set<string>(),
    insertShouldFail: false,
}));

vi.mock('./clickhouseClient', () => ({
    WAREHOUSE_SECRETS: [],
    WAREHOUSE_WRITER_SECRETS: [],
    queryWarehouse: async (_sql: string, params: Record<string, { value: readonly string[] }>) => {
        const ids = params.ids?.value ?? [];
        return [...ids].filter(id => warehouse.existingIds.has(id)).map(id => ({ event_id: id }));
    },
    insertWarehouseRows: async (table: string, rows: ReadonlyArray<Record<string, unknown>>) => {
        if (warehouse.insertShouldFail) throw new Error('warehouse unavailable');
        warehouse.inserted.push({ table, rows });
    },
}));

const store = vi.hoisted(() => {
    interface Doc { id: string; data: Record<string, unknown> }
    const docs: Doc[] = [];
    const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];

    const makeSnapshotDoc = (doc: Doc) => ({
        id: doc.id,
        ref: { id: doc.id },
        data: () => doc.data,
    });

    const query = {
        where: () => query,
        limit: () => query,
        get: async () => {
            const pending = docs.filter(d => d.data.status === 'pending' && (d.data.flushAttempts as number) < 5);
            return { empty: pending.length === 0, docs: pending.map(makeSnapshotDoc) };
        },
    };

    return {
        docs, updates, query,
        firestore: () => ({
            collection: () => query,
            batch: () => ({
                update: (ref: { id: string }, patch: Record<string, unknown>) => {
                    updates.push({ id: ref.id, patch });
                },
                commit: async () => undefined,
            }),
        }),
    };
});

vi.mock('firebase-admin', () => ({
    firestore: Object.assign(() => store.firestore(), {
        FieldValue: {
            serverTimestamp: () => 'SERVER_TIMESTAMP',
            increment: (n: number) => ({ __increment: n }),
        },
    }),
}));

vi.mock('firebase-functions/v2', () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('firebase-functions/v2/scheduler', () => ({
    onSchedule: (_opts: unknown, handler: unknown) => handler,
}));

import { flushOutboxBatch, toWarehouseRow } from './flushConversionEvents.js';

function makeEvent(id: string, overrides: Partial<ConversionEvent> = {}): ConversionEvent {
    return {
        schemaVersion: 'conversion-event.v1',
        eventId: id,
        artistId: 'artist-uid',
        platform: 'smart_link',
        eventType: 'dsp_redirect',
        occurredAt: '2026-07-31T12:00:00.000Z',
        revenueMinor: 0,
        costMinor: 0,
        currency: 'USD',
        campaignId: 'camp-1',
        adCreativeId: '',
        smartLinkSlug: 'summer',
        utmSource: 'facebook',
        utmMedium: 'cpc',
        utmCampaign: 'summer-launch',
        metadata: { dsp: 'spotify' },
        ...overrides,
    };
}

function seed(...ids: string[]) {
    for (const id of ids) {
        store.docs.push({ id, data: { ...makeEvent(id), status: 'pending', flushAttempts: 0 } });
    }
}

beforeEach(() => {
    store.docs.length = 0;
    store.updates.length = 0;
    warehouse.inserted.length = 0;
    warehouse.existingIds.clear();
    warehouse.insertShouldFail = false;
});

describe('toWarehouseRow', () => {
    it('maps camelCase transport fields onto snake_case warehouse columns', () => {
        const row = toWarehouseRow(makeEvent('evt-1'));

        expect(row).toMatchObject({
            event_id: 'evt-1',
            artist_id: 'artist-uid',
            platform: 'smart_link',
            event_type: 'dsp_redirect',
            campaign_id: 'camp-1',
            utm_source: 'facebook',
        });
    });

    it('renders the timestamp in the format ClickHouse can parse', () => {
        // JSONEachRow will not accept ISO's 'T' separator or trailing 'Z'.
        expect(toWarehouseRow(makeEvent('evt-1')).event_time).toBe('2026-07-31 12:00:00.000');
    });

    it('converts minor units to the Decimal the column expects', () => {
        const row = toWarehouseRow(makeEvent('evt-1', { revenueMinor: 2599, costMinor: 150 }));

        expect(row.revenue).toBe('25.9900');
        expect(row.cost).toBe('1.5000');
    });

    it('preserves cents exactly, without float drift', () => {
        const row = toWarehouseRow(makeEvent('evt-1', { revenueMinor: 1 }));
        expect(row.revenue).toBe('0.0100');
    });

    it('carries untyped fields through raw_metadata', () => {
        const metadata = JSON.parse(String(toWarehouseRow(makeEvent('evt-1')).raw_metadata));
        expect(metadata).toMatchObject({ dsp: 'spotify', smartLinkSlug: 'summer', currency: 'USD' });
    });
});

describe('flushOutboxBatch', () => {
    it('inserts pending rows and marks them flushed', async () => {
        seed('evt-1', 'evt-2');

        const flushed = await flushOutboxBatch();

        expect(flushed).toBe(2);
        expect(warehouse.inserted[0].table).toBe('indii_analytics.omnichannel_events');
        expect(warehouse.inserted[0].rows).toHaveLength(2);
        expect(store.updates.every(u => u.patch.status === 'flushed')).toBe(true);
    });

    it('does nothing when the outbox is empty', async () => {
        await expect(flushOutboxBatch()).resolves.toBe(0);
        expect(warehouse.inserted).toHaveLength(0);
    });

    it('skips rows a crashed earlier flush already landed', async () => {
        // This is the whole reason the pre-insert filter exists: the
        // materialized view fires per insert block and cannot un-count a
        // duplicate later.
        seed('evt-1', 'evt-2', 'evt-3');
        warehouse.existingIds.add('evt-2');

        await flushOutboxBatch();

        const insertedIds = warehouse.inserted[0].rows.map(row => row.event_id);
        expect(insertedIds).toEqual(['evt-1', 'evt-3']);
    });

    it('still marks the already-present row flushed so it leaves the queue', async () => {
        seed('evt-1');
        warehouse.existingIds.add('evt-1');

        await flushOutboxBatch();

        expect(store.updates.map(u => u.id)).toContain('evt-1');
        expect(store.updates[0].patch.status).toBe('flushed');
    });

    it('leaves rows pending and counts the attempt when the warehouse is down', async () => {
        seed('evt-1', 'evt-2');
        warehouse.insertShouldFail = true;

        const flushed = await flushOutboxBatch();

        expect(flushed).toBe(0);
        // Nothing marked flushed — these must be retried, not dropped.
        expect(store.updates.every(u => u.patch.status !== 'flushed')).toBe(true);
        expect(store.updates.every(u => u.patch.flushAttempts)).toBeTruthy();
    });

    it('stops retrying a poison row so it cannot block the queue behind it', async () => {
        store.docs.push({
            id: 'evt-poison',
            data: { ...makeEvent('evt-poison'), status: 'pending', flushAttempts: 5 },
        });
        seed('evt-good');

        await flushOutboxBatch();

        const insertedIds = warehouse.inserted[0].rows.map(row => row.event_id);
        expect(insertedIds).toEqual(['evt-good']);
    });
});
