import { afterEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as os from 'os';

import { stageCanonicalMasters } from './MasterAudioStagingService';

const MASTER_BYTES = new TextEncoder().encode('verified-lossless-master');
const MASTER_HASH = 'f05353696dd9faa0f73098d7359d9ad535466cbfa8242b6dc3fadcbbf2567637';

function releaseFixture(downloadUrl: string, contentHash = MASTER_HASH): Record<string, unknown> {
    return {
        releaseId: 'release-master-transport',
        tracks: [{
            title: 'Signal Path',
            master_asset: {
                content_hash: contentHash,
                download_url: downloadUrl,
                master_fingerprint: 'SONIC-master-1',
                mime_type: 'audio/flac',
                original_file_name: 'signal-path.flac',
                size_bytes: MASTER_BYTES.byteLength,
                storage_path: `masters/owner-1/${contentHash}/original.flac`,
            },
        }],
    };
}

function firebaseUrl(contentHash: string): string {
    const storagePath = `masters/owner-1/${contentHash}/original.flac`;
    return `https://firebasestorage.googleapis.com/v0/b/indii-test/o/${encodeURIComponent(storagePath)}?alt=media&token=test`;
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
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(MASTER_BYTES)));
        const before = new Set((await fs.readdir(os.tmpdir())).filter(name => name.startsWith('indii-ddex-master-')));

        await expect(stageCanonicalMasters(releaseFixture(firebaseUrl(wrongHash), wrongHash)))
            .rejects.toThrow('SHA-256');

        const after = (await fs.readdir(os.tmpdir())).filter(name => name.startsWith('indii-ddex-master-'));
        expect(after.filter(name => !before.has(name))).toEqual([]);
    });

    it('returns a verified local resource and removes the signed URL from the child-process payload', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(MASTER_BYTES)));

        const staged = await stageCanonicalMasters(releaseFixture(firebaseUrl(MASTER_HASH)));
        const [track] = staged.releaseData.tracks as Array<Record<string, unknown>>;
        const masterAsset = track.master_asset as Record<string, unknown>;
        const localPath = masterAsset.local_path as string;

        expect(track.filename).toMatch(/^resources\/01-[a-f0-9]{16}\.flac$/);
        expect(masterAsset.download_url).toBeUndefined();
        expect(await fs.readFile(localPath)).toEqual(Buffer.from(MASTER_BYTES));

        await staged.cleanup();
        await expect(fs.stat(staged.stagingPath)).rejects.toMatchObject({ code: 'ENOENT' });
    });
});
