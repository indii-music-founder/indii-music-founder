import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as opentype from 'opentype.js';

vi.mock('@/services/typography/FontLibrary', () => ({
    FontLibrary: { listFonts: vi.fn(), registerFont: vi.fn(), loadOpenTypeFont: vi.fn() }
}));
vi.mock('@/core/store', () => {
    const mockStore = { addToHistory: vi.fn(), currentProjectId: 'proj_1' };
    return { useStore: { getState: () => mockStore } };
});

import TypographyPanel from '../TypographyPanel';
import { FontLibrary } from '@/services/typography/FontLibrary';

function buildFont(): opentype.Font {
    const box = (name: string, unicode: number, adv: number, w = 500, h = 700) => {
        const p = new opentype.Path();
        p.moveTo(0, 0); p.lineTo(w, 0); p.lineTo(w, h); p.lineTo(0, h); p.close();
        return new opentype.Glyph({ name, unicode, advanceWidth: adv, path: p });
    };
    const glyphs = [box('D', 68, 650), box('i', 105, 250, 80), box('space', 32, 250, 0, 0)];
    glyphs[2] = new opentype.Glyph({ name: 'space', unicode: 32, advanceWidth: 250, path: new opentype.Path() });
    const f = new opentype.Font({ familyName: 'Dii', styleName: 'R', unitsPerEm: 1000, ascender: 900, descender: -100, glyphs });
    f.kerningPairs = {};
    return f;
}

describe('TypographyPanel (B2.1 — RTL)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (FontLibrary.listFonts as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 'font_1', family: 'Dii', style: 'R', format: 'ttf', addedAt: 1 }]);
        (FontLibrary.loadOpenTypeFont as ReturnType<typeof vi.fn>).mockResolvedValue(buildFont());
    });

    it('renders a font list and exposes render controls', async () => {
        render(<TypographyPanel />);
        expect(screen.getByTestId('typography-panel')).toBeInTheDocument();
        await waitFor(() => expect(screen.getByTestId('font-select')).toHaveValue('font_1'));
        expect(screen.getByTestId('text-input')).toHaveValue('Dii');
    });

    it('uploads a mock font and populates the select', async () => {
        const user = userEvent.setup();
        (FontLibrary.registerFont as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'font_new', family: 'New', style: 'R', format: 'ttf', addedAt: 2 });
        (FontLibrary.listFonts as ReturnType<typeof vi.fn>).mockResolvedValue([
            { id: 'font_1', family: 'Dii', style: 'R', format: 'ttf', addedAt: 1 },
            { id: 'font_new', family: 'New', style: 'R', format: 'ttf', addedAt: 2 }
        ]);

        render(<TypographyPanel />);
        const file = new File(['x'], 'new.ttf', { type: 'font/ttf' });
        await user.upload(screen.getByTestId('font-upload'), file);
        await waitFor(() => expect(FontLibrary.registerFont).toHaveBeenCalledWith(file));
        await waitFor(() => expect(screen.getByTestId('font-select')).toHaveValue('font_new'));
    });

    it('renders a wordmark and records a typography_layer history item', async () => {
        const user = userEvent.setup();
        render(<TypographyPanel />);
        await waitFor(() => expect(screen.getByTestId('font-select')).toHaveValue('font_1'));
        await user.click(screen.getByTestId('render-btn'));

        await waitFor(() => expect(screen.getByTestId('render-result')).toBeInTheDocument());
        const { addToHistory } = await import('@/core/store').then(m => (m.useStore.getState() as unknown as { addToHistory: ReturnType<typeof vi.fn> }));
        expect(addToHistory).toHaveBeenCalledWith(expect.objectContaining({
            type: 'image',
            meta: expect.stringContaining('typography_layer')
        }));
    });

    it('shows an actionable error when no font is registered', async () => {
        (FontLibrary.listFonts as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        render(<TypographyPanel />);
        fireEvent.click(screen.getByTestId('render-btn'));
        await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent(/Upload a font first/));
    });
});
