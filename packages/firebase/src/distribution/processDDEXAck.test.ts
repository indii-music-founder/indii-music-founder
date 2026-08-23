/**
 * Regression test for the processDDEXAck self-retrigger fix (P0).
 *
 * Successful processing MOVES the ACK file to ddex-acks/processed/. A
 * same-bucket move fires a new onObjectFinalized for the destination, which
 * still matches the ddex-acks/ prefix — so without a processed-path guard the
 * function reprocessed (and re-moved) every ACK forever, duplicating release
 * updates and storage charges per delivery.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    download: vi.fn(),
}));

vi.mock('firebase-functions/v2/storage', () => ({
    onObjectFinalized: vi.fn((_opts: unknown, handler?: unknown) => handler ?? _opts),
}));

vi.mock('firebase-admin/firestore', () => ({
    getFirestore: vi.fn(() => ({ collection: vi.fn() })),
    FieldValue: { serverTimestamp: vi.fn(() => 'TS') },
}));

vi.mock('firebase-admin/storage', () => ({
    getStorage: vi.fn(() => ({
        bucket: vi.fn(() => ({
            file: vi.fn(() => ({ download: mocks.download })),
        })),
    })),
}));

vi.mock('firebase-functions', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { processDDEXAck } from './processDDEXAck';

const invoke = (name: string) =>
    (processDDEXAck as unknown as (e: unknown) => Promise<void>)({
        data: { name, bucket: 'indii-music-founder.firebasestorage.app' },
    });

describe('processDDEXAck — processed-path guard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.download.mockResolvedValue([Buffer.from('<xml/>')]);
    });

    it('ignores files outside the ddex-acks/ prefix', async () => {
        await invoke('releases/some-release.xml');
        expect(mocks.download).not.toHaveBeenCalled();
    });

    it('processes a fresh ACK in ddex-acks/', async () => {
        await invoke('ddex-acks/ack-123.xml');
        expect(mocks.download).toHaveBeenCalledTimes(1);
    });

    it('never reprocesses an archived ACK under ddex-acks/processed/', async () => {
        // This is the exact event a successful move() emits for its destination.
        await invoke('ddex-acks/processed/ack-123.xml');
        expect(mocks.download).not.toHaveBeenCalled();
    });
});
