import { describe, expect, it, vi } from 'vitest';

import {
    CanonicalRenderMasterError,
    parseProjectCanonicalMaster,
    parseProjectCanonicalVideoSegments,
    resolveVerifiedRenderMaster,
} from './renderMasterContract';

const OWNER_UID = 'user-1';
const CONTENT_HASH = 'a'.repeat(64);

function canonicalMaster(overrides: Record<string, unknown> = {}) {
    return {
        storagePath: `masters/${OWNER_UID}/${CONTENT_HASH}/original.wav`,
        contentHash: CONTENT_HASH,
        generation: '123456789',
        masterFingerprint: 'SONIC-master-1',
        volume: 1,
        ...overrides,
    };
}

describe('render canonical-master contract', () => {
    it('uses only owner-scoped project-bucket video sources, never a preview URL', () => {
        expect(parseProjectCanonicalVideoSegments(OWNER_UID, 'indii-music-founder.firebasestorage.app', [{
            type: 'video',
            src: 'https://attacker.example/preview.mp4',
            canonicalSourceUri: 'gs://indii-music-founder.firebasestorage.app/creative/user-1/video/outputs/scene.mp4',
            startFrame: 0,
        }])).toEqual(['gs://indii-music-founder.firebasestorage.app/creative/user-1/video/outputs/scene.mp4']);
    });

    it('rejects raw, cross-bucket, and cross-owner video sources', () => {
        expect(() => parseProjectCanonicalVideoSegments(OWNER_UID, 'indii-music-founder.firebasestorage.app', [{
            type: 'video', src: 'https://attacker.example/preview.mp4', startFrame: 0,
        }])).toThrow('canonical project-bucket source URI');
        expect(() => parseProjectCanonicalVideoSegments(OWNER_UID, 'indii-music-founder.firebasestorage.app', [{
            type: 'video', canonicalSourceUri: 'gs://other-bucket/creative/user-1/video/outputs/scene.mp4', startFrame: 0,
        }])).toThrow('canonical project-bucket source URI');
        expect(() => parseProjectCanonicalVideoSegments(OWNER_UID, 'indii-music-founder.firebasestorage.app', [{
            type: 'video', canonicalSourceUri: 'gs://indii-music-founder.firebasestorage.app/creative/other-user/video/outputs/scene.mp4', startFrame: 0,
        }])).toThrow('not an owner-scoped project video source');
    });

    it('ignores a renderer URL and accepts only a canonical master reference', () => {
        const master = parseProjectCanonicalMaster(OWNER_UID, [
            {
                type: 'audio',
                src: 'https://attacker.example/master.wav',
                canonicalMaster: canonicalMaster(),
            },
        ]);

        expect(master).toEqual(canonicalMaster());
        expect(master).not.toHaveProperty('src');
    });

    it('rejects a raw audio URL instead of forwarding it into the render queue', () => {
        expect(() => parseProjectCanonicalMaster(OWNER_UID, [{
            type: 'audio',
            src: 'https://attacker.example/master.wav',
        }])).toThrow(CanonicalRenderMasterError);
    });

    it('requires the canonical master to start at the beginning of the visual timeline', () => {
        expect(() => parseProjectCanonicalMaster(OWNER_UID, [{
            type: 'audio',
            startFrame: 1,
            durationInFrames: 300,
            canonicalMaster: canonicalMaster(),
        }])).toThrow('start at frame zero');
    });

    it('rejects a master path that belongs to another user or a different content hash', () => {
        expect(() => parseProjectCanonicalMaster(OWNER_UID, [{
            type: 'audio',
            canonicalMaster: canonicalMaster({ storagePath: `masters/other-user/${CONTENT_HASH}/original.wav` }),
        }])).toThrow('does not belong to the authenticated owner');

        expect(() => parseProjectCanonicalMaster(OWNER_UID, [{
            type: 'audio',
            canonicalMaster: canonicalMaster({ contentHash: 'b'.repeat(64) }),
        }])).toThrow('does not match the canonical path');
    });

    it('requires the verified storage generation to equal the renderer reference', async () => {
        await expect(resolveVerifiedRenderMaster(
            OWNER_UID,
            canonicalMaster(),
            {
                bucketName: 'indii-music-founder.firebasestorage.app',
                verifyMaster: vi.fn().mockResolvedValue({
                    verified: true,
                    storagePath: `masters/${OWNER_UID}/${CONTENT_HASH}/original.wav`,
                    contentHash: CONTENT_HASH,
                    generation: '987654321',
                }),
            },
        )).rejects.toThrow('generation changed');
    });

    it('derives a project-bucket gs URI only after master verification succeeds', async () => {
        const master = await resolveVerifiedRenderMaster(
            OWNER_UID,
            canonicalMaster({ volume: 0.5 }),
            {
                bucketName: 'indii-music-founder.firebasestorage.app',
                verifyMaster: vi.fn().mockResolvedValue({
                    verified: true,
                    storagePath: `masters/${OWNER_UID}/${CONTENT_HASH}/original.wav`,
                    contentHash: CONTENT_HASH,
                    generation: '123456789',
                }),
            },
        );

        expect(master).toEqual({
            storagePath: `masters/${OWNER_UID}/${CONTENT_HASH}/original.wav`,
            contentHash: CONTENT_HASH,
            generation: '123456789',
            masterFingerprint: 'SONIC-master-1',
            volume: 0.5,
            uri: `gs://indii-music-founder.firebasestorage.app/masters/${OWNER_UID}/${CONTENT_HASH}/original.wav`,
        });
    });
});
