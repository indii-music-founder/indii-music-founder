import { describe, expect, it } from 'vitest';
import { assetVersionDocument } from './assetVersionDocument';

describe('asset version JSON document serialization (pure data)', () => {
    it('omits absent compliance and provenance without inventing results', () => {
        expect(assetVersionDocument({ parentVersionId: null, tags: [], compliance: undefined, provenance: undefined }))
            .toEqual({ parentVersionId: null, tags: [] });
    });
    it('preserves failed compliance, zero scores, and supplied provenance while removing nested undefined', () => {
        const input = { compliance: { passed: false, score: 0, overrideReason: undefined }, provenance: { note: 'Print preparation', model: undefined } };
        expect(assetVersionDocument(input)).toEqual({ compliance: { passed: false, score: 0 }, provenance: { note: 'Print preparation' } });
        expect(input.compliance).toHaveProperty('overrideReason');
    });
});
