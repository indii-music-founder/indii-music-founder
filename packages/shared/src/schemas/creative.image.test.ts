import { describe, expect, it } from 'vitest';

import { GenerateImageSchema, GenerateVideoSchema } from './creative';

describe('GenerateImageSchema', () => {
    const request = {
        prompt: 'A surreal record cover',
        costReservationId: 'op-image-reservation-123',
    };

    it('requires and preserves the server-issued cost reservation identifier', () => {
        expect(GenerateImageSchema.safeParse({ prompt: request.prompt }).success).toBe(false);
        expect(GenerateImageSchema.parse({ ...request, costReservationId: ` ${request.costReservationId} ` }).costReservationId)
            .toBe(request.costReservationId);
    });

    it('rejects blank or oversized reservation identifiers before the gateway runs', () => {
        expect(GenerateImageSchema.safeParse({ ...request, costReservationId: '   ' }).success).toBe(false);
        expect(GenerateImageSchema.safeParse({ ...request, costReservationId: 'x'.repeat(257) }).success).toBe(false);
    });

    it('accepts the full GA Gemini image aspect-ratio set', () => {
        const aspectRatios = [
            '1:1', '1:4', '1:8', '2:3', '3:2', '3:4', '4:1', '4:3',
            '4:5', '5:4', '8:1', '9:16', '16:9', '21:9', '9:21',
        ];

        for (const aspectRatio of aspectRatios) {
            expect(GenerateImageSchema.safeParse({
                prompt: 'Generate cover art',
                aspectRatio,
                costReservationId: 'image-aspect-ratio-test',
            }).success).toBe(true);
        }
    });
});

describe('GenerateVideoSchema', () => {
    it('requires a server-issued video cost reservation', () => {
        expect(GenerateVideoSchema.safeParse({ prompt: 'A live performance' }).success).toBe(false);
        expect(GenerateVideoSchema.safeParse({
            prompt: 'A live performance',
            costReservationId: 'video-reservation-123',
        }).success).toBe(true);
    });

    it('does not expose a client cost-check bypass in the shared request contract', () => {
        const parsed = GenerateVideoSchema.parse({
            prompt: 'A live performance cut to the beat',
            costReservationId: 'video-reservation-123',
            skipCostCheck: true,
        });

        expect(parsed).not.toHaveProperty('skipCostCheck');
    });
});
