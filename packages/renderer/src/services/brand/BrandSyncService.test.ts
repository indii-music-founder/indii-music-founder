import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
    BrandSyncService,
    BRAND_COLORS_UPDATED_EVENT,
    type BrandColorItem,
} from './BrandSyncService';
import { artistDirectiveService } from '@/services/agent/skills/ArtistDirectiveService';
import { DEFAULT_ARTIST_MASTER_DIRECTIVE } from '@indii/shared';

const mockUpdateBrandKit = vi.fn().mockResolvedValue(undefined);
let mockStoreState: any = {};

vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => mockStoreState,
    },
}));

vi.mock('@/services/agent/skills/ArtistDirectiveService', () => ({
    artistDirectiveService: {
        getDirective: vi.fn(),
        saveDirective: vi.fn(),
    },
}));

describe('BrandSyncService', () => {
    let service: BrandSyncService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new BrandSyncService();
        mockStoreState = {
            userProfile: {
                brandKit: {
                    colors: ['Neon Cyan (#00f0ff)', 'Deep Violet (#1a0033)', '#ff0055'],
                    aestheticStyle: 'Cyberpunk Neon',
                },
            },
            updateBrandKit: mockUpdateBrandKit,
        };

        vi.mocked(artistDirectiveService.getDirective).mockResolvedValue(
            JSON.parse(JSON.stringify(DEFAULT_ARTIST_MASTER_DIRECTIVE))
        );
        vi.mocked(artistDirectiveService.saveDirective).mockResolvedValue({
            success: true,
        });
    });

    describe('normalizeColors', () => {
        it('normalizes valid hex codes and color names', () => {
            const raw = ['#ff0055', 'cyan', '#1a0033'];
            const normalized = service.normalizeColors(raw);

            expect(normalized.length).toBe(3);
            expect(normalized[0].hex.toLowerCase()).toBe('#ff0055');
            expect(normalized[1].hex.toLowerCase()).toBe('#00ffff');
            expect(normalized[2].hex.toLowerCase()).toBe('#1a0033');
        });

        it('returns empty array on empty or invalid inputs', () => {
            expect(service.normalizeColors([])).toEqual([]);
            expect(service.normalizeColors(['', '   '])).toEqual([]);
            expect(service.normalizeColors(null as any)).toEqual([]);
        });
    });

    describe('applyCssVariables', () => {
        it('sets CSS variables on document.documentElement', () => {
            const palette: BrandColorItem[] = [
                { hex: '#112233', label: 'Dark Slate', raw: 'Dark Slate (#112233)' },
                { hex: '#445566', label: 'Mid Gray', raw: 'Mid Gray (#445566)' },
                { hex: '#778899', label: 'Light Slate', raw: 'Light Slate (#778899)' },
            ];

            service.applyCssVariables(palette);

            const root = document.documentElement;
            expect(root.style.getPropertyValue('--artist-brand-primary')).toBe('#112233');
            expect(root.style.getPropertyValue('--artist-brand-secondary')).toBe('#445566');
            expect(root.style.getPropertyValue('--artist-brand-accent')).toBe('#778899');
            expect(root.style.getPropertyValue('--artist-brand-palette')).toBe('#112233, #445566, #778899');
        });

        it('falls back gracefully when palette has fewer than 3 colors', () => {
            const palette: BrandColorItem[] = [
                { hex: '#ff0000', label: 'Red', raw: '#ff0000' },
            ];

            service.applyCssVariables(palette);

            const root = document.documentElement;
            expect(root.style.getPropertyValue('--artist-brand-primary')).toBe('#ff0000');
            expect(root.style.getPropertyValue('--artist-brand-secondary')).toBe('#ff0000');
            expect(root.style.getPropertyValue('--artist-brand-accent')).toBe('#ff0000');
        });
    });

    describe('broadcastUpdate', () => {
        it('dispatches custom event with palette detail', () => {
            const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
            const palette: BrandColorItem[] = [
                { hex: '#00ffaa', label: 'Mint', raw: 'Mint (#00ffaa)' },
            ];

            service.broadcastUpdate(palette);

            expect(dispatchSpy).toHaveBeenCalledTimes(1);
            const event = dispatchSpy.mock.calls[0][0] as CustomEvent<BrandColorItem[]>;
            expect(event.type).toBe(BRAND_COLORS_UPDATED_EVENT);
            expect(event.detail).toEqual(palette);
        });
    });

    describe('syncToArtistDirective', () => {
        it('updates brandingAesthetics rules and calls saveDirective', async () => {
            const palette: BrandColorItem[] = [
                { hex: '#ff0088', label: 'Magenta', raw: 'Magenta (#ff0088)' },
                { hex: '#000000', label: 'Black', raw: '#000000' },
            ];

            const result = await service.syncToArtistDirective(
                palette,
                'Dark Synthwave',
                'Calibrated for album rollout'
            );

            expect(result).toBe(true);
            expect(artistDirectiveService.saveDirective).toHaveBeenCalledTimes(1);

            const savedDirective = vi.mocked(artistDirectiveService.saveDirective).mock.calls[0][0];
            const rules = savedDirective.sections.brandingAesthetics.rules;

            expect(rules).toContain('Brand Color Palette: Magenta (#ff0088), #000000');
            expect(rules).toContain('Visual Aesthetic Style: Dark Synthwave');
            expect(savedDirective.lastModifiedReason).toBe('Calibrated for album rollout');
            expect(savedDirective.lastModifiedBy).toBe('agent');
        });

        it('replaces existing brand color rule instead of duplicating', async () => {
            const initialDirective = JSON.parse(JSON.stringify(DEFAULT_ARTIST_MASTER_DIRECTIVE));
            initialDirective.sections.brandingAesthetics.rules = [
                'Brand Color Palette: Old Blue (#0000ff)',
                'Visual Aesthetic Style: Minimalist',
                'Never use comic sans',
            ];
            vi.mocked(artistDirectiveService.getDirective).mockResolvedValueOnce(initialDirective);

            const palette: BrandColorItem[] = [
                { hex: '#111111', label: 'Obsidian', raw: '#111111' },
            ];

            await service.syncToArtistDirective(palette);

            const savedDirective = vi.mocked(artistDirectiveService.saveDirective).mock.calls[0][0];
            const rules = savedDirective.sections.brandingAesthetics.rules;

            expect(rules).toContain('Brand Color Palette: #111111');
            expect(rules).not.toContain('Brand Color Palette: Old Blue (#0000ff)');
            expect(rules).toContain('Never use comic sans');
        });
    });

    describe('syncBrandPalette', () => {
        it('fails with EMPTY_PALETTE if given empty color array', async () => {
            const res = await service.syncBrandPalette([]);
            expect(res.success).toBe(false);
            expect(res.error).toBe('EMPTY_PALETTE');
        });

        it('executes full cascade across store, CSS, directive, and events', async () => {
            const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

            const res = await service.syncBrandPalette(['#123456', '#abcdef'], {
                aestheticStyle: 'Futuristic Gold',
                reason: 'Release campaign update',
            });

            expect(res.success).toBe(true);
            expect(res.palette.length).toBe(2);

            // Store update
            expect(mockUpdateBrandKit).toHaveBeenCalledWith({
                colors: expect.arrayContaining([expect.stringContaining('#123456')]),
                aestheticStyle: 'Futuristic Gold',
            });

            // CSS variable
            expect(document.documentElement.style.getPropertyValue('--artist-brand-primary')).toBe('#123456');

            // Directive saved
            expect(artistDirectiveService.saveDirective).toHaveBeenCalled();

            // Event dispatched
            expect(dispatchSpy).toHaveBeenCalled();
        });
    });

    describe('getActivePalette', () => {
        it('retrieves and normalizes colors from store', async () => {
            const palette = await service.getActivePalette();
            expect(palette.length).toBe(3);
            expect(palette[0].hex.toLowerCase()).toBe('#00f0ff');
        });
    });
});
