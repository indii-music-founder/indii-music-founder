/**
 * Runtime schema contracts shared by every creative callable.
 *
 * This suite executes the exact Firebase request schemas. It deliberately
 * avoids browser fixtures that merely reproduce validation client-side.
 */

import { describe, expect, it } from 'vitest';

import {
    GenerateAudioSchema,
    GenerateImageSchema,
    GenerateOmniRemixSchema,
    GenerateVideoSchema,
} from './creative.js';

describe('Creative request schemas', () => {
    it('requires a prompt and canonical Storage references for image requests', () => {
        const valid = GenerateImageSchema.safeParse({
            prompt: 'A performance beneath neon lights',
            costReservationId: 'image-reservation-1',
            referenceUri: 'gs://indii-music-founder.firebasestorage.app/creative/user-1/reference.png',
        });
        expect(valid.success).toBe(true);

        expect(GenerateImageSchema.safeParse({
            prompt: '',
            costReservationId: 'image-reservation-1',
        }).success).toBe(false);
        expect(GenerateImageSchema.safeParse({
            prompt: 'A protected reference image',
            costReservationId: 'image-reservation-1',
            referenceUri: 'data:image/png;base64,Zm9yZ2Vk',
        }).success).toBe(false);

        const stripped = GenerateImageSchema.parse({
            prompt: 'A protected reference image',
            costReservationId: 'image-reservation-1',
            imageBytes: 'data:image/png;base64,Zm9yZ2Vk',
        });
        expect(stripped).not.toHaveProperty('imageBytes');
    });

    it('rejects invalid video model, frame URI, and duration values', () => {
        expect(GenerateVideoSchema.safeParse({
            prompt: 'A live performance cut to the beat',
            costReservationId: 'video-reservation-1',
            model: 'fast',
            aspectRatio: '16:9',
            resolution: '1080p',
            durationSeconds: 6,
        }).success).toBe(true);

        expect(GenerateVideoSchema.safeParse({
            prompt: 'A live performance',
            costReservationId: 'video-reservation-1',
            model: 'unbounded-provider-model',
        }).success).toBe(false);
        expect(GenerateVideoSchema.safeParse({
            prompt: 'A live performance',
            costReservationId: 'video-reservation-1',
            firstFrameUri: 'data:image/png;base64,Zm9yZ2Vk',
        }).success).toBe(false);
        expect(GenerateVideoSchema.safeParse({
            prompt: 'A live performance',
            costReservationId: 'video-reservation-1',
            durationSeconds: 60,
        }).success).toBe(false);
    });

    it('normalizes null aspectRatio/resolution to the defaults (ISSUE-1379)', () => {
        // The agent's generate_video tool can omit these; JSON serializes
        // absence as null, which zod's .default()/.optional() would reject.
        const parsed = GenerateVideoSchema.safeParse({
            prompt: 'A live performance',
            costReservationId: 'video-reservation-1',
            aspectRatio: null,
            resolution: null,
            directorSettings: {
                aspectRatio: null,
                resolution: null,
                fps: 24,
            },
        });
        expect(parsed.success).toBe(true);
        if (parsed.success) {
            expect(parsed.data.aspectRatio).toBe('16:9');
            expect(parsed.data.resolution).toBe('720p');
        }
    });

    it('enforces task-specific canonical media references for Omni edits', () => {
        expect(GenerateOmniRemixSchema.safeParse({
            prompt: 'Add a slow camera orbit while preserving the performer',
            task: 'edit',
            referenceVideoUri: 'gs://indii-music-founder.firebasestorage.app/creative/user-1/source.mp4',
        }).success).toBe(true);
        expect(GenerateOmniRemixSchema.safeParse({
            prompt: 'Edit this',
            task: 'edit',
            referenceVideoUri: 'https://untrusted.example/source.mp4',
        }).success).toBe(false);
    });

    it('requires bounded text and a durable identity for speech requests', () => {
        expect(GenerateAudioSchema.safeParse({
            prompt: 'A short artist introduction.',
            voice: 'Kore',
            requestId: '04df70bd-247f-4f9e-aef5-6ca9dc858b16',
        }).success).toBe(true);
        expect(GenerateAudioSchema.safeParse({
            prompt: ' ',
            requestId: 'not-a-uuid',
        }).success).toBe(false);
    });
});
