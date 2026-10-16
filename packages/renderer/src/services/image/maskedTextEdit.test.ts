import { describe, expect, it } from 'vitest';
import { maskedTextCandidates, textContrastColor, textFitsMask, textMaskBounds } from './maskedTextEdit';

describe('literal text candidates (pure source extraction, not a model judgment)', () => {
    it('copies punctuation and apostrophes verbatim from quoted text', () => {
        expect(maskedTextCandidates(`Write "Rock'n'Roll — Live!" in black Georgia lettering.`)[0]).toMatchObject({ text: "Rock'n'Roll — Live!", fontFamily: 'Georgia', fill: 'black' });
    });
    it('supports arbitrary letter commands and explicit case', () => {
        expect(maskedTextCandidates('Write the uppercase letter ñ in black Arial lettering. Keep the background white.')[0]).toMatchObject({ text: 'Ñ', fontFamily: 'Arial', fill: 'black', background: 'white' });
        expect(maskedTextCandidates('Write the lowercase character Q.')[0]?.text).toBe('q');
    });
    it('does not invent a text value for an image-only request', () => {
        expect(maskedTextCandidates('Add a blue butterfly above the dog.')).toEqual([]);
        expect(maskedTextCandidates('Add some interesting text.')).toEqual([]);
    });
    it('keeps candidate spans separate so the model can distinguish new and preserved text', () => {
        expect(maskedTextCandidates('Write “New Label”; preserve “Old Label”.').map(candidate => candidate.text)).toEqual(['New Label', 'Old Label']);
    });
    it('rejects invisible control characters and empty lettering', () => {
        expect(maskedTextCandidates('Write "\u0000".')).toEqual([]);
        expect(maskedTextCandidates('Write "   ".')).toEqual([]);
    });
    it('keeps alternate named fonts available without choosing their semantic role', () => {
        expect(maskedTextCandidates('Write "Live" in Georgia; preserve the Arial title.').map(candidate => candidate.fontFamily)).toEqual(['Arial', 'Georgia']);
    });
});

describe('text mask bounds', () => {
    it('ignores transparent white and colored pixels outside the selected area', () => {
        const pixels = new Uint8ClampedArray(4 * 3 * 4);
        pixels.set([255, 255, 255, 0], 0);
        pixels.set([255, 0, 0, 255], 3 * 4);
        pixels.set([255, 255, 255, 255], (1 * 4 + 1) * 4);
        pixels.set([255, 255, 255, 255], (2 * 4 + 2) * 4);
        expect(textMaskBounds(pixels, 4, 3)).toEqual({ left: 1, top: 1, width: 2, height: 2 });
    });
    it('reports an empty area instead of placing text elsewhere', () => {
        expect(textMaskBounds(new Uint8ClampedArray(16), 2, 2)).toBeNull();
    });
    it('rejects malformed dimensions before scanning', () => {
        expect(() => textMaskBounds(new Uint8ClampedArray(16), 2.5, 2)).toThrow();
        expect(() => textMaskBounds(new Uint8ClampedArray(16), 3, 2)).toThrow();
    });
});

describe('unspecified text contrast', () => {
    it('uses readable text on light and dark selected backgrounds', () => {
        const mask = new Uint8ClampedArray([255, 255, 255, 255]);
        expect(textContrastColor(new Uint8ClampedArray([255, 255, 255, 255]), mask)).toBe('black');
        expect(textContrastColor(new Uint8ClampedArray([0, 0, 0, 255]), mask)).toBe('white');
    });
    it('ignores bright pixels outside the marked region', () => {
        expect(textContrastColor(new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]),
            new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]))).toBe('white');
    });
});

describe('complete lettering coverage', () => {
    it('accepts lettering entirely inside the painted region', () => {
        expect(textFitsMask(new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 0]),
            new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]))).toBe(true);
    });
    it('rejects lettering that would lose a visible glyph in an unpainted gap', () => {
        expect(textFitsMask(new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 255]),
            new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]))).toBe(false);
    });
    it('rejects an empty glyph image instead of reporting text success', () => {
        expect(textFitsMask(new Uint8ClampedArray(4), new Uint8ClampedArray([255, 255, 255, 255]))).toBe(false);
    });
});
