import { describe, it, expect } from 'vitest';
import { AnalyzeAudioRequestSchema, resolveOwnedCanonicalMasterPath } from './audio';

describe('Audio Analysis Logic', () => {
    it('accepts only a canonical master storage path, never a public URL or caller-selected bucket', () => {
        const hash = 'a'.repeat(64);
        const valid = AnalyzeAudioRequestSchema.safeParse({
            storagePath: `masters/owner-1/${hash}/original.flac`,
        });
        expect(valid.success).toBe(true);

        const publicUrl = AnalyzeAudioRequestSchema.safeParse({
            audioUrl: 'https://attacker.example/audio.mp3',
        });
        expect(publicUrl.success).toBe(false);

        const bucketUri = AnalyzeAudioRequestSchema.safeParse({
            storagePath: `gs://another-project-bucket/masters/owner-1/${hash}/original.wav`,
        });
        expect(bucketUri.success).toBe(false);
    });

    it('binds the canonical master path to the authenticated owner and content hash', () => {
        const hash = 'b'.repeat(64);
        expect(resolveOwnedCanonicalMasterPath('owner-1', `masters/owner-1/${hash}/original.wav`))
            .toEqual({
                storagePath: `masters/owner-1/${hash}/original.wav`,
                contentHash: hash,
                mimeType: 'audio/wav',
            });

        expect(() => resolveOwnedCanonicalMasterPath('owner-1', `masters/owner-2/${hash}/original.wav`))
            .toThrow(/does not belong to the authenticated owner/);
        expect(() => resolveOwnedCanonicalMasterPath('owner-1', `masters/owner-1/${hash}/original.mp3`))
            .toThrow(/canonical WAV or FLAC/);
    });

    it('rejects malformed or ambiguous paths before any Vertex request is possible', () => {
        const malformed = AnalyzeAudioRequestSchema.safeParse({
            storagePath: 'masters/owner-1/not-a-digest/original.wav',
        });
        expect(malformed.success).toBe(false);
    });
});
