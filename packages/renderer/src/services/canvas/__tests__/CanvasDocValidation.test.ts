import { describe, expect, it } from 'vitest';
import { createDocFromImage } from '../CanvasDoc';
import { normalizeCanvasDoc } from '../CanvasDocValidation';

describe('artwork document compatibility', () => {
    it('normalizes missing legacy fields without upgrading adjustment behavior or dimensions', () => {
        const current = createDocFromImage('fixture.png', 'unit-fixture');
        const legacy = { ...current, schemaVersion: undefined, renderVersion: undefined, revision: undefined, width: 1080, height: 1080,
            layers: current.layers.map(photo => ({ ...photo, adjustmentVersion: undefined, transformAnchor: undefined, framing: undefined, adjustments: { contrast: -0.4 } })) };
        const normalized = normalizeCanvasDoc(legacy);
        expect(normalized.width).toBe(1080);
        expect(normalized.renderVersion).toBe(1);
        expect(normalized.layers[0]!.transformAnchor).toBe('center');
        expect(normalized.layers[0]).toMatchObject({ adjustmentVersion: 1, adjustments: { contrast: -0.4, brightness: 0 } });
        expect(legacy.layers[0]!.adjustments).toEqual({ contrast: -0.4 });
    });
    it('rejects unknown versions, impossible dimensions and ambiguous layer IDs', () => {
        const doc = createDocFromImage('fixture.png', 'unit-fixture');
        expect(() => normalizeCanvasDoc(doc, 'another-document')).toThrow(/saved location/);
        expect(() => normalizeCanvasDoc({ ...doc, schemaVersion: 3 })).toThrow(/unsupported/);
        expect(() => normalizeCanvasDoc({ ...doc, width: NaN })).toThrow(/width/);
        expect(() => normalizeCanvasDoc({ ...doc, layers: [doc.layers[0], doc.layers[0]] })).toThrow(/duplicate/);
    });
    it('round-trips new editable settings and rejects temporary image sources', () => {
        const doc = createDocFromImage('fixture.png', 'unit-fixture');
        expect(normalizeCanvasDoc(doc)).toEqual(doc);
        expect(doc.width).toBe(3000);
        expect(() => normalizeCanvasDoc({ ...doc, layers: [{ ...doc.layers[0], src: 'blob:temporary' }] })).toThrow(/persistent/);
    });
});
