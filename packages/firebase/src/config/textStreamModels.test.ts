import { describe, expect, it } from 'vitest';

import {
    APPROVED_TEXT_STREAM_FINE_TUNED_ENDPOINTS,
    isApprovedFineTunedTextEndpoint,
    isApprovedTextStreamModel,
} from './textStreamModels.js';

describe('text stream model policy', () => {
    it('accepts reviewed base models and the reviewed endpoint registry only', () => {
        expect(isApprovedTextStreamModel('gemini-3-flash-preview')).toBe(true);
        const reviewedEndpoint = [...APPROVED_TEXT_STREAM_FINE_TUNED_ENDPOINTS][0]!;
        expect(isApprovedFineTunedTextEndpoint(reviewedEndpoint)).toBe(true);
        expect(isApprovedTextStreamModel(reviewedEndpoint)).toBe(true);
    });

    it('rejects arbitrary, cross-project, malformed, and non-string model selectors', () => {
        expect(isApprovedTextStreamModel('projects/attacker/locations/us/endpoints/123')).toBe(false);
        expect(isApprovedTextStreamModel('projects/148015878263/locations/us/endpoints/9999999999999999999')).toBe(false);
        expect(isApprovedTextStreamModel('https://untrusted.example/model')).toBe(false);
        expect(isApprovedTextStreamModel({ model: 'gemini-3-flash-preview' })).toBe(false);
    });
});
