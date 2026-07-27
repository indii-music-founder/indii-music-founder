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
});
describe('GenerateVideoSchema', () => {
    it('does not expose a client cost-check bypass in the shared request contract', () => {
        const parsed = GenerateVideoSchema.parse({
            prompt: 'A live performance cut to the beat',
            costReservationId: 'video-reservation-123',
            skipCostCheck: true,
        });
        expect(parsed).not.toHaveProperty('skipCostCheck');
    });
});
