import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'crypto';
import * as fs from 'fs/promises';
import * as os from 'os';

import { stageCanonicalMasters } from './MasterAudioStagingService';

function pcmWav(): Uint8Array {
    const bytes = new Uint8Array(44);
    const view = new DataView(bytes.buffer);
    bytes.set(new TextEncoder().encode('RIFF'), 0);
    view.setUint32(4, 36, true);
    bytes.set(new TextEncoder().encode('WAVEfmt '), 8);
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 2, true);
    view.setUint32(24, 48_000, true);
    view.setUint16(34, 24, true);
    bytes.set(new TextEncoder().encode('data'), 36);
    return bytes;
}

const MASTER_BYTES = pcmWav();
const MASTER_HASH = createHash('sha256').update(MASTER_BYTES).digest('hex');

function releaseFixture(downloadUrl: string, contentHash = MASTER_HASH): Record<string, unknown> {
    return {
        releaseId: 'release-master-transport',
        tracks: [{
            title: 'Signal Path',
            master_asset: {
                content_hash: contentHash,
                download_url: downloadUrl,
                master_fingerprint: 'SONIC-master-1',
                mime_type: 'audio/wav',
                original_file_name: 'signal-path.wav',
                size_bytes: MASTER_BYTES.byteLength,
                storage_path: `masters/owner-1/${contentHash}/original.wav`,
            },
        }],
    };
}

function firebaseUrl(contentHash: string): string {
    const storagePath = `masters/owner-1/${contentHash}/original.wav`;
    return `https://firebasestorage.googleapis.com/v0/b/indii-test/o/${encodeURIComponent(storagePath)}?alt=media&token=test`;
}

function responseWithBytes(bytes: Uint8Array): Response {
    const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    return new Response(body);
}

describe('stageCanonicalMasters', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('rejects a non-Firebase download URL before making a network request', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        await expect(stageCanonicalMasters(releaseFixture(
            `https://attacker.example/audio.flac?path=masters/owner-1/${MASTER_HASH}/original.flac`
        ))).rejects.toThrow('Firebase Storage');

        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('deletes temporary bytes when the downloaded master fails SHA-256 verification', async () => {
        const wrongHash = 'b'.repeat(64);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(responseWithBytes(MASTER_BYTES)));
        const before = new Set((await fs.readdir(os.tmpdir())).filter(name => name.startsWith('indii-ddex-master-')));

        await expect(stageCanonicalMasters(releaseFixture(firebaseUrl(wrongHash), wrongHash)))
            .rejects.toThrow('SHA-256');

        const after = (await fs.readdir(os.tmpdir())).filter(name => name.startsWith('indii-ddex-master-'));
        expect(after.filter(name => !before.has(name))).toEqual([]);
    });

    it('returns a verified local resource and removes the signed URL from the child-process payload', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(responseWithBytes(MASTER_BYTES)));

        const staged = await stageCanonicalMasters(releaseFixture(firebaseUrl(MASTER_HASH)));
        const [track] = staged.releaseData.tracks as Array<Record<string, unknown>>;
        const masterAsset = track.master_asset as Record<string, unknown>;
        const localPath = masterAsset.local_path as string;

        expect(track.filename).toMatch(/^resources\/01-[a-f0-9]{16}\.wav$/);
        expect(track.codec).toBe('PCM');
        expect(track.bit_depth).toBe(24);
        expect(track.channels).toBe(2);
        expect(track.sample_rate).toBe(48_000);
        expect(masterAsset.download_url).toBeUndefined();
        expect(await fs.readFile(localPath)).toEqual(Buffer.from(MASTER_BYTES));

        await staged.cleanup();
        await expect(fs.stat(staged.stagingPath)).rejects.toMatchObject({ code: 'ENOENT' });
    });

    it('rejects hash-valid lossy bytes that are renamed and stored as a WAV master', async () => {
        const lossyBytes = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00]);
        const lossyHash = createHash('sha256').update(lossyBytes).digest('hex');
        const release = releaseFixture(firebaseUrl(lossyHash), lossyHash);
        const [track] = release.tracks as Array<Record<string, unknown>>;
        (track.master_asset as Record<string, unknown>).size_bytes = lossyBytes.byteLength;
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(responseWithBytes(lossyBytes)));

        await expect(stageCanonicalMasters(release))
            .rejects.toThrow(/not a supported WAV or FLAC/);
    });
});
