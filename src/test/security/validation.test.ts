
import { describe, it, expect } from 'vitest';
import { FetchUrlSchema, AudioAnalyzeSchema, DistributionStageReleaseSchema } from '../../../electron/utils/validation';

describe('Electron Validation Schemas', () => {

    describe('FetchUrlSchema', () => {
        it('should allow valid http/https URLs', () => {
            expect(FetchUrlSchema.safeParse('https://google.com').success).toBe(true);
            expect(FetchUrlSchema.safeParse('http://example.com').success).toBe(true);
        });

        it('should reject file:// URLs', () => {
            expect(FetchUrlSchema.safeParse('file:///etc/passwd').success).toBe(false);
        });

        it('should reject invalid URLs', () => {
            expect(FetchUrlSchema.safeParse('not-a-url').success).toBe(false);
        });
    });

    describe('AudioAnalyzeSchema', () => {
        it('should allow valid audio paths', () => {
            expect(AudioAnalyzeSchema.safeParse('/path/to/song.wav').success).toBe(true);
            expect(AudioAnalyzeSchema.safeParse('C:\\Music\\song.mp3').success).toBe(true);
        });

        it('should reject path traversal', () => {
            expect(AudioAnalyzeSchema.safeParse('../../etc/passwd.wav').success).toBe(false);
        });

        it('should reject unsupported extensions', () => {
            expect(AudioAnalyzeSchema.safeParse('song.exe').success).toBe(false);
        });
    });

    describe('DistributionStageReleaseSchema', () => {
        it('should allow valid release packages', () => {
            const valid = {
                releaseId: '123e4567-e89b-12d3-a456-426614174000',
                files: [
                    { type: 'content', data: 'foo', name: 'cover.jpg' },
                    { type: 'path', data: '/tmp/audio.wav', name: 'audio.wav' }
                ]
            };
            expect(DistributionStageReleaseSchema.safeParse(valid).success).toBe(true);
        });

        it('should reject path traversal in filenames', () => {
            const invalid = {
                releaseId: '123e4567-e89b-12d3-a456-426614174000',
                files: [
                    { type: 'content', data: 'foo', name: '../../pwned.txt' }
                ]
            };
            const result = DistributionStageReleaseSchema.safeParse(invalid);
            expect(result.success).toBe(false);
        });
    });
});
