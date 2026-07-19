import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

vi.mock('firebase-admin', () => ({
    apps: [{}],
    initializeApp: vi.fn(),
    firestore: Object.assign(vi.fn(), {
        FieldValue: { serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP') },
    }),
    storage: vi.fn(),
}));

vi.mock('firebase-functions/v2/https', () => ({
    onCall: vi.fn((_options: unknown, handler: unknown) => handler),
    HttpsError: class HttpsError extends Error {
        constructor(public code: string, message: string) {
            super(message);
        }
    },
}));

import { verifyMasterAudioObject } from '../functions/storage/verifyMasterAudio';

function fixture(bytes: Buffer, ownerId = 'owner-1') {
    const hash = createHash('sha256').update(bytes).digest('hex');
    const storagePath = `masters/${ownerId}/${hash}/original.wav`;
    const verificationWrites: Record<string, unknown>[] = [];
    const file = {
        getMetadata: vi.fn(async () => [{
            contentType: 'audio/wav',
            size: String(bytes.length),
            generation: '12345',
            metadata: {
                contentHash: hash,
                immutable: 'true',
                masterFingerprint: 'SONIC-1',
                ownerId,
                originalFileName: 'master.wav',
            },
        }]),
        createReadStream: vi.fn(() => Readable.from(bytes)),
    };
    const bucket = { file: vi.fn(() => file) };
    const firestore = {
        collection: vi.fn(() => ({
            doc: vi.fn(() => ({
                set: vi.fn(async (data: Record<string, unknown>) => {
                    verificationWrites.push(data);
                }),
            })),
        })),
    };
    return { hash, storagePath, bucket, firestore, verificationWrites };
}

describe('verifyMasterAudioObject', () => {
    it('streams the stored bytes and records a server-verified SHA-256 proof', async () => {
        const bytes = Buffer.from('the actual canonical master bytes');
        const setup = fixture(bytes);

        const result = await verifyMasterAudioObject('owner-1', {
            storagePath: setup.storagePath,
            expectedSha256: setup.hash,
            masterFingerprint: 'SONIC-1',
        }, setup.bucket as never, setup.firestore as never);

        expect(result).toEqual(expect.objectContaining({
            verified: true,
            contentHash: setup.hash,
            generation: '12345',
        }));
        expect(setup.verificationWrites.at(-1)).toEqual(expect.objectContaining({
            userId: 'owner-1',
            storagePath: setup.storagePath,
            expectedSha256: setup.hash,
            observedSha256: setup.hash,
            status: 'verified',
        }));
    });

    it('records rejection and refuses a path whose bytes do not match its claimed hash', async () => {
        const setup = fixture(Buffer.from('actual bytes'));
        setup.bucket.file().createReadStream.mockReturnValue(Readable.from(Buffer.from('different bytes')));

        await expect(verifyMasterAudioObject('owner-1', {
            storagePath: setup.storagePath,
            expectedSha256: setup.hash,
            masterFingerprint: 'SONIC-1',
        }, setup.bucket as never, setup.firestore as never)).rejects.toThrow(/do not match/);

        expect(setup.verificationWrites.at(-1)).toEqual(expect.objectContaining({ status: 'rejected' }));
    });

    it('refuses another user path before reading any object bytes', async () => {
        const setup = fixture(Buffer.from('master'), 'owner-1');

        await expect(verifyMasterAudioObject('attacker', {
            storagePath: setup.storagePath,
            expectedSha256: setup.hash,
            masterFingerprint: 'SONIC-1',
        }, setup.bucket as never, setup.firestore as never)).rejects.toThrow(/does not belong/);

        expect(setup.bucket.file).not.toHaveBeenCalled();
    });

    it('refuses a master that has no immutable Storage generation', async () => {
        const setup = fixture(Buffer.from('master'));
        const metadata = await setup.bucket.file().getMetadata();
        setup.bucket.file().getMetadata.mockResolvedValue([{ ...metadata[0], generation: '' }]);

        await expect(verifyMasterAudioObject('owner-1', {
            storagePath: setup.storagePath,
            expectedSha256: setup.hash,
            masterFingerprint: 'SONIC-1',
        }, setup.bucket as never, setup.firestore as never)).rejects.toThrow(/generation is invalid/);

        expect(setup.bucket.file().createReadStream).not.toHaveBeenCalled();
    });
});
