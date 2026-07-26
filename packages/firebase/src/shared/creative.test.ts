import { describe, expect, it } from 'vitest';

import { GenerateImageSchema } from './creative';

describe('Firebase GenerateImageSchema', () => {
    it('keeps the required cost reservation through gateway parsing', () => {
        const parsed = GenerateImageSchema.parse({
            prompt: 'A surreal record cover',
            costReservationId: ' op-image-reservation-123 ',
        });

        expect(parsed.costReservationId).toBe('op-image-reservation-123');
    });

    it('rejects a request without a cost reservation before any Vertex work', () => {
        expect(GenerateImageSchema.safeParse({ prompt: 'A surreal record cover' }).success).toBe(false);
    });
});
