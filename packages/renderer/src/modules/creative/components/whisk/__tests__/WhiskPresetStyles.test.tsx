import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WhiskPresetStyles, { STYLE_PRESETS } from '../WhiskPresetStyles';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockSetTargetMedia = vi.fn();

vi.mock('@/core/store', () => ({
    useStore: () => ({
        whiskState: {
            styles: [],
            subject: null,
            scene: null,
        },
        setTargetMedia: mockSetTargetMedia,
    }),
}));

vi.mock('zustand/react/shallow', () => ({
    useShallow: (fn: unknown) => fn,
}));

// ── Tests ──────────────────────────────────────────────────────────────────

describe('WhiskPresetStyles', () => {
    const mockOnSelectPreset = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the Image Styles heading', () => {
        render(<WhiskPresetStyles onSelectPreset={mockOnSelectPreset} />);
        expect(screen.getByText('Image Styles')).toBeInTheDocument();
    });

    it('renders all 6 style presets', () => {
        render(<WhiskPresetStyles onSelectPreset={mockOnSelectPreset} />);
        expect(screen.getByText('Album Cover')).toBeInTheDocument();
        expect(screen.getByText('Poster')).toBeInTheDocument();
        expect(screen.getByText('Social')).toBeInTheDocument();
        expect(screen.getByText('Vinyl')).toBeInTheDocument();
        expect(screen.getByText('Merch')).toBeInTheDocument();
        expect(screen.getByText('Promo')).toBeInTheDocument();
    });

    it('calls onSelectPreset when a preset is clicked', () => {
        render(<WhiskPresetStyles onSelectPreset={mockOnSelectPreset} />);
        fireEvent.click(screen.getByText('Album Cover'));
        expect(mockOnSelectPreset).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'album-cover',
                label: 'Album Cover',
                aspectRatio: '1:1',
            })
        );
    });

    it('sets target media to image for image-only presets', () => {
        render(<WhiskPresetStyles onSelectPreset={mockOnSelectPreset} />);
        fireEvent.click(screen.getByText('Album Cover'));
        expect(mockSetTargetMedia).toHaveBeenCalledWith('image');
    });

    it('does not force target media for "both" presets', () => {
        render(<WhiskPresetStyles onSelectPreset={mockOnSelectPreset} />);
        fireEvent.click(screen.getByText('Social'));
        // Social has targetMedia: 'both', so setTargetMedia should NOT be called
        expect(mockSetTargetMedia).not.toHaveBeenCalled();
    });

    it('STYLE_PRESETS exports the correct number of presets', () => {
        expect(STYLE_PRESETS).toHaveLength(6);
    });

    it('Album Cover preset has correct aspect ratio and prompt', () => {
        const albumCover = STYLE_PRESETS.find(p => p.id === 'album-cover');
        expect(albumCover).toBeDefined();
        expect(albumCover!.aspectRatio).toBe('1:1');
        expect(albumCover!.prompt).toContain('album cover');
    });

    it('Poster preset uses 2:3 aspect ratio', () => {
        const poster = STYLE_PRESETS.find(p => p.id === 'poster');
        expect(poster).toBeDefined();
        expect(poster!.aspectRatio).toBe('2:3');
    });

    it('Promo preset uses 16:9 aspect ratio', () => {
        const promo = STYLE_PRESETS.find(p => p.id === 'promo-still');
        expect(promo).toBeDefined();
        expect(promo!.aspectRatio).toBe('16:9');
    });

    it('all presets have unique IDs', () => {
        const ids = STYLE_PRESETS.map(p => p.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
    });
});
