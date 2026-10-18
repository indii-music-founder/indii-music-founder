import { describe, it, expect } from 'vitest';
import { createDocFromImage } from '../CanvasDoc';
import { readCanvasDocument, summarizeArtwork, newestArtworkFirst } from '../CanvasDocValidation';

// Replaces the former fake-user/in-memory-Firestore checks with pure boundary checks.
// Real save/load/list behavior is covered by the authenticated artwork acceptance workflow.
describe('artwork document boundary (structural only)', () => {
    it('round-trips canonical JSON without losing document identity or editable layers', () => {
        const document = createDocFromImage('unit-image.png', 'unit-fixture');
        const loaded = readCanvasDocument(JSON.parse(JSON.stringify(document)), document.id)!;
        expect(loaded.id).toBe(document.id);
        expect(loaded.projectId).toBe(document.projectId);
        expect(loaded.layers).toHaveLength(1);
        expect(loaded.layers[0]).toMatchObject({ kind: 'raster', src: 'unit-image.png', name: 'Background' });
        expect(loaded).not.toBe(document);
    });
    it('distinguishes absence from malformed or mismatched input', () => {
        expect(readCanvasDocument(null, 'unit-missing')).toBeNull();
        expect(() => readCanvasDocument({}, 'unit-invalid')).toThrow();
        const document = createDocFromImage('unit-image.png', 'unit-fixture');
        expect(() => readCanvasDocument(document, 'another-unit-id')).toThrow(/saved location/);
    });
    it('orders literal versions without mutating the input and keeps newer-schema metadata visible', () => {
        const earlier = summarizeArtwork('unit-first', 'unit-fixture', { name: 'First literal value', updatedAt: 100, schemaVersion: 2 });
        const later = summarizeArtwork('unit-second', 'unit-fixture', { name: 'Second literal value', updatedAt: 200, schemaVersion: 99 });
        const input = [earlier, later];
        expect(newestArtworkFirst(input).map(item => item.id)).toEqual(['unit-second', 'unit-first']);
        expect(input).toEqual([earlier, later]);
        expect(later.unsupportedVersion).toBe(true);
        expect(later.name).toBe('Second literal value');
    });
});
