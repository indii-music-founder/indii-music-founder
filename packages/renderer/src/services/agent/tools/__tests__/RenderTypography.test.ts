import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as opentype from 'opentype.js';

vi.mock('@/services/typography/FontLibrary', () => ({
    FontLibrary: {
        listFonts: vi.fn(),
        loadOpenTypeFont: vi.fn()
    }
}));

vi.mock('@/services/assets/AssetVersionService', () => ({
    AssetVersionService: { recordVersion: vi.fn(async (input: unknown) => input) }
}));

vi.mock('@/core/store', () => {
    const mockStore = { addToHistory: vi.fn(), currentProjectId: 'proj_1' };
    return { useStore: { getState: () => mockStore } };
});

import { DirectorTools } from '../DirectorTools';
import { FontLibrary } from '@/services/typography/FontLibrary';

const tool = (DirectorTools as unknown as {
    render_typography: (args: Record<string, unknown>) => Promise<{ success: boolean; data: Record<string, unknown>; message: string }>;
}).render_typography;

function buildFont(): opentype.Font {
    const box = (name: string, unicode: number, adv: number, w = 500, h = 700) => {
        const p = new opentype.Path();
        p.moveTo(0, 0); p.lineTo(w, 0); p.lineTo(w, h); p.lineTo(0, h); p.close();
        return new opentype.Glyph({ name, unicode, advanceWidth: adv, path: p });
    };
    const glyphs = [box('D', 68, 650), box('i', 105, 250, 80), box('space', 32, 250, 0, 0)];
    glyphs[2] = new opentype.Glyph({ name: 'space', unicode: 32, advanceWidth: 250, path: new opentype.Path() });
    const f = new opentype.Font({ familyName: 'Dii', styleName: 'Regular', unitsPerEm: 1000, ascender: 900, descender: -100, glyphs });
    f.kerningPairs = {};
    return f;
}

describe('render_typography tool (B2.2)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders deterministic vector text and records a typography_layer history item', async () => {
        (FontLibrary.listFonts as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 'font_1', family: 'Dii', style: 'Regular', format: 'ttf', addedAt: 1 }]);
        (FontLibrary.loadOpenTypeFont as ReturnType<typeof vi.fn>).mockResolvedValue(buildFont());

        const res = await tool({ text: 'Dii', fontSize: 100 });
        expect(res.success).toBe(true);
        expect(res.data.svgPathD).toBeTruthy();
        expect(res.data.width).toBeGreaterThan(0);
        expect(res.data.fontId).toBe('font_1');

        const { addToHistory } = await import('@/core/store').then(m => (m.useStore.getState() as unknown as { addToHistory: ReturnType<typeof vi.fn> }));
        expect(addToHistory).toHaveBeenCalledWith(expect.objectContaining({
            type: 'image',
            meta: expect.stringContaining('typography_layer')
        }));
    });

    it('fails with an actionable error for an unknown fontId', async () => {
        (FontLibrary.listFonts as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 'font_1', family: 'Dii', style: 'R', format: 'ttf', addedAt: 1 }]);
        const res = await tool({ text: 'Dii', fontId: 'font_nope' });
        expect(res.success).toBe(false);
        expect(res.message).toContain('font_nope');
        expect(res.message).toContain('font_1');
    });

    it('fails when no font is registered', async () => {
        (FontLibrary.listFonts as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        const res = await tool({ text: 'Dii' });
        expect(res.success).toBe(false);
        expect(res.message).toContain('No font registered');
    });

    it('fails closed on empty text', async () => {
        const res = await tool({ text: '' });
        expect(res.success).toBe(false);
    });
});
