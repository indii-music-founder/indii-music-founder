import { describe, it, expect } from 'vitest';
import * as opentype from 'opentype.js';
import { renderTextPath, rasterizeVectorText, assertLatinText } from '../TextVectorRenderer';

// ---------------------------------------------------------------------------
// Deterministic programmatic fixture font. B1 deliberately builds the font at
// runtime (opentype.js supports Font construction) rather than bundling a
// binary, which sidesteps any font-licensing concern while keeping the render
// math fully deterministic.
// a simple box glyph per char with a fixed advance.
// ---------------------------------------------------------------------------

function boxGlyph(name: string, unicode: number, advanceWidth: number, w = 500, h = 700, index?: number): opentype.Glyph {
    const p = new opentype.Path();
    p.moveTo(0, 0);
    p.lineTo(w, 0);
    p.lineTo(w, h);
    p.lineTo(0, h);
    p.close();
    return new opentype.Glyph({ name, unicode, advanceWidth, path: p, index: index ?? unicode });
}

function makeFont(): opentype.Font {
    const glyphs = [
        boxGlyph('D', 68, 650),
        boxGlyph('i', 105, 250, 80),
        boxGlyph('A', 65, 600),
        boxGlyph('V', 86, 600),
        boxGlyph('space', 32, 250, 0, 0)
    ];
    // Space needs no visual path but must be a valid glyph.
    glyphs[4] = new opentype.Glyph({ name: 'space', unicode: 32, advanceWidth: 250, path: new opentype.Path() });
    const f = new opentype.Font({
        familyName: 'DiiTest', styleName: 'Regular', unitsPerEm: 1000, ascender: 900, descender: -100, glyphs
    });
    // This constructed fixture has no kern table; getKerningValue returns 0.
    f.kerningPairs = {};
    return f;
}

const font = makeFont();

describe('renderTextPath (B1.2 golden)', () => {
    it('produces a deterministic svgPathD + advanceWidth', () => {
        const v = renderTextPath('Dii', font, { fontSize: 100, x: 0, y: 100, kerning: true });
        expect(v.svgPathD).toBeTruthy();
        expect(v.svgPathD.length).toBeGreaterThan(0);
        // D=650, i=250, i=250 at 100px on a unitsPerEm=1000 font → 115.0
        expect(v.advanceWidth).toBeCloseTo(115, 6);
        expect(v.glyphCount).toBe(3);
        expect(v.baselineY).toBe(100);
    });

    it('letterSpacing increases advanceWidth by tracking * gaps in px (formula, not magic)', () => {
        const base = renderTextPath('Dii', font, { fontSize: 100, x: 0, y: 100 });
        const spaced = renderTextPath('Dii', font, { fontSize: 100, x: 0, y: 100, letterSpacing: 100 });
        const trackingPx = (100 / font.unitsPerEm) * 100; // 10px
        const gaps = 3 - 1; // 2 gaps
        expect(spaced.advanceWidth - base.advanceWidth).toBeCloseTo(trackingPx * gaps, 6);
    });

    it('letterSpacing shifts actual glyph command coordinates in svgPathD', () => {
        const base = renderTextPath('Dii', font, { fontSize: 100, x: 0, y: 100 });
        const spaced = renderTextPath('Dii', font, { fontSize: 100, x: 0, y: 100, letterSpacing: 100 });
        // Tracking adds 10px after 'D' (index 1 shifted by +10) and another 10px after 'i' (index 2 shifted by +20)
        expect(spaced.svgPathD).not.toBe(base.svgPathD);
        expect(spaced.svgPathD).toContain('75'); // 65 + 10 = 75
        expect(spaced.svgPathD).toContain('110'); // 90 + 20 = 110
    });

    it('align shifts the starting x coordinate in svgPathD', () => {
        const left = renderTextPath('Dii', font, { fontSize: 100, x: 0, y: 100, align: 'left' });
        const center = renderTextPath('Dii', font, { fontSize: 100, x: 0, y: 100, align: 'center' });
        const right = renderTextPath('Dii', font, { fontSize: 100, x: 0, y: 100, align: 'right' });

        // Total advance = 115
        expect(left.svgPathD.startsWith('M0 ')).toBe(true);
        expect(center.svgPathD.startsWith('M-57.5')).toBe(true);
        expect(right.svgPathD.startsWith('M-115')).toBe(true);
    });

    it('kerning table active pairs shift glyph positions when kerning is enabled', () => {
        const gA = boxGlyph('A', 65, 600, 500, 700, 65);
        const gV = boxGlyph('V', 86, 600, 500, 700, 86);
        const kernFont = new opentype.Font({
            familyName: 'KernedDii',
            styleName: 'Regular',
            unitsPerEm: 1000,
            ascender: 900,
            descender: -100,
            glyphs: [boxGlyph('space', 32, 250), gA, gV]
        });
        // -80 font units kerning between 'A' (index 65) and 'V' (index 86)
        kernFont.kerningPairs = { '65,86': -80 };

        const kerned = renderTextPath('AV', kernFont, { fontSize: 100, x: 0, y: 100, kerning: true });
        const unkerned = renderTextPath('AV', kernFont, { fontSize: 100, x: 0, y: 100, kerning: false });

        // A is 600 units = 60px. Unkerned V starts at 60.
        // Kerned V starts at 60 - (80/1000 * 100) = 52px.
        expect(unkerned.svgPathD).toContain('60');
        expect(kerned.svgPathD).toContain('52');
        expect(kerned.svgPathD).not.toBe(unkerned.svgPathD);
    });

    it('kerning true/false yield identical output when the font has no kern table', () => {
        const a = renderTextPath('AV', font, { fontSize: 100, x: 0, y: 100, kerning: true });
        const b = renderTextPath('AV', font, { fontSize: 100, x: 0, y: 100, kerning: false });
        // Fixture has no kern table (constructed font): note in code that this
        // asserts getKerningValue(...) === 0 so kerning is a no-op.
        expect(font.getKerningValue('A', 'V')).toBe(0);
        expect(a.svgPathD).toBe(b.svgPathD);
        expect(a.advanceWidth).toBeCloseTo(b.advanceWidth, 6);
    });

    it('is byte-identical across runs (determinism)', () => {
        const one = renderTextPath('Dii', font, { fontSize: 100, x: 0, y: 100, kerning: true });
        const two = renderTextPath('Dii', font, { fontSize: 100, x: 0, y: 100, kerning: true });
        expect(one.svgPathD).toBe(two.svgPathD);
        expect(one.width).toBe(two.width);
    });

    it('rejects empty text and bad fontSize', () => {
        expect(() => renderTextPath('', font, { fontSize: 100, x: 0, y: 100 })).toThrow(/non-empty/);
        expect(() => renderTextPath('A', font, { fontSize: 0, x: 0, y: 100 })).toThrow(/positive/);
        expect(() => renderTextPath('A', null as unknown as opentype.Font, { fontSize: 100, x: 0, y: 100 })).toThrow(/opentype.Font/);
    });
});

describe('non-Latin rejection (B1.3)', () => {
    it('rejects multi-byte / complex-script text with an actionable error', () => {
        expect(() => assertLatinText('Привет')).toThrow(/non-Latin/);
        expect(() => assertLatinText('你好')).toThrow(/non-Latin/);
        expect(() => assertLatinText('Dii')).not.toThrow();
    });

});

describe('rasterizeVectorText (B1.4 — canvas-mocked, dimensional)', () => {
    it('produces a transparent PNG at the requested scale with exact dimensions', async () => {
        const v = renderTextPath('Dii', font, { fontSize: 100, x: 0, y: 100 });
        const out = await rasterizeVectorText(v, '#ffffff', 2);
        expect(out.dataUrl).toMatch(/^data:image\/png/);
        expect(out.width).toBe(v.width * 2);
        expect(out.height).toBe(v.height * 2);
    });

    it('scales 1:1 when scale is 1', async () => {
        const v = renderTextPath('D', font, { fontSize: 50, x: 0, y: 50 });
        const out = await rasterizeVectorText(v, '#000000', 1);
        expect(out.width).toBe(v.width);
        expect(out.height).toBe(v.height);
    });
});
