import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateBrandColorByName } from './updateBrandColor';

const updateBrandKit = vi.fn().mockResolvedValue(undefined);
let colors: string[] = [];

vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({
            userProfile: { brandKit: { colors } },
            updateBrandKit,
        }),
    },
}));

describe('updateBrandColorByName', () => {
    beforeEach(() => {
        updateBrandKit.mockClear();
        colors = ['Morning Mist Blue', 'Golden Hour Amber', 'Twilight Plum', 'Midnight Shadow'];
    });

    it('renames a color matched by exact name', async () => {
        const result = await updateBrandColorByName('Golden Hour Amber', 'Silver Hour Amber');

        expect(result.success).toBe(true);
        expect(result.matchedColor).toBe('Golden Hour Amber');
        expect(updateBrandKit).toHaveBeenCalledWith({
            colors: ['Morning Mist Blue', 'Silver Hour Amber', 'Twilight Plum', 'Midnight Shadow'],
        });
    });

    it('matches case-insensitively', async () => {
        const result = await updateBrandColorByName('golden hour amber', 'Silver Hour Amber');
        expect(result.success).toBe(true);
    });

    it('matches a partial name', async () => {
        const result = await updateBrandColorByName('Golden Hour', 'Silver Hour Amber');
        expect(result.success).toBe(true);
        expect(result.matchedColor).toBe('Golden Hour Amber');
    });

    it('preserves an embedded hex code when renaming', async () => {
        colors = ['Golden Hour Amber (#F5A623)'];
        const result = await updateBrandColorByName('Golden Hour Amber', 'Silver Hour Amber');

        expect(result.success).toBe(true);
        expect(updateBrandKit).toHaveBeenCalledWith({ colors: ['Silver Hour Amber (#F5A623)'] });
    });

    it('fails with the available color list when nothing matches', async () => {
        const result = await updateBrandColorByName('Nonexistent Color', 'New Name');

        expect(result.success).toBe(false);
        expect(result.availableColors).toEqual(colors);
        expect(updateBrandKit).not.toHaveBeenCalled();
    });

    it('fails when the palette is empty', async () => {
        colors = [];
        const result = await updateBrandColorByName('Golden Hour Amber', 'Silver Hour Amber');

        expect(result.success).toBe(false);
        expect(updateBrandKit).not.toHaveBeenCalled();
    });

    it('fails when the name is ambiguous', async () => {
        colors = ['Golden Hour Amber', 'Sunset Amber'];
        const result = await updateBrandColorByName('Amber', 'New Name');

        expect(result.success).toBe(false);
        expect(updateBrandKit).not.toHaveBeenCalled();
    });
});
