import { parseColor } from '@/utils/colorUtils';
import { importWithRetry } from '@/utils/dynamicImport';

export interface UpdateBrandColorResult {
    success: boolean;
    message: string;
    matchedColor?: string;
    newColor?: string;
    availableColors?: string[];
}

/**
 * Renames a color in the artist's saved Brand Kit palette by fuzzy name match
 * (e.g. "Golden Hour Amber" -> "Silver Hour Amber"), preserving any hex code
 * embedded in the original entry. Used by the chat tool so an artist can just
 * say the color's name rather than editing the swatch picker directly.
 */
export async function updateBrandColorByName(from: string, to: string): Promise<UpdateBrandColorResult> {
    if (!from?.trim() || !to?.trim()) {
        return { success: false, message: 'Both the current color name and the new name are required.' };
    }

    const { useStore } = await importWithRetry(() => import('@/core/store'));
    const state = useStore.getState();
    const colors = state.userProfile?.brandKit?.colors || [];

    if (colors.length === 0) {
        return { success: false, message: 'No brand colors are set yet — add a color first.' };
    }

    const normalize = (s: string) => s.trim().toLowerCase();
    const fromNorm = normalize(from);

    const labeled = colors.map((raw, index) => ({ index, raw, label: normalize(parseColor(raw).label) }));

    let matches = labeled.filter(c => c.label === fromNorm);
    if (matches.length === 0) {
        matches = labeled.filter(c => c.label.includes(fromNorm) || fromNorm.includes(c.label));
    }

    if (matches.length === 0) {
        return {
            success: false,
            message: `No color matching "${from}" found in the current palette.`,
            availableColors: colors.map(c => parseColor(c).label),
        };
    }
    if (matches.length > 1) {
        return {
            success: false,
            message: `"${from}" matches more than one color (${matches.map(m => parseColor(m.raw).label).join(', ')}) — be more specific.`,
        };
    }

    const match = matches[0]!;
    const parsed = parseColor(match.raw);
    // Preserve an explicitly embedded hex (e.g. "Name (#RRGGBB)"); a pure name-only
    // entry stays name-only so it still resolves through parseColor's own fallback.
    const hexMatch = match.raw.match(/#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})/);
    const newRaw = hexMatch ? `${to} (${hexMatch[0]})` : to;

    const newColors = [...colors];
    newColors[match.index] = newRaw;

    await state.updateBrandKit({ colors: newColors });

    return {
        success: true,
        message: `Renamed "${parsed.label}" to "${to}".`,
        matchedColor: parsed.label,
        newColor: to,
    };
}
