/**
 * packages/renderer/src/services/brand/BrandSyncService.ts
 *
 * Universal Brand Identity & Color Cascading Engine (Living Skill Protocol).
 *
 * Ensures that when an artist or an agent updates brand colors or visual identity,
 * the change instantly and automatically cascades across:
 * 1. The Zustand profile store (`userProfile.brandKit.colors`) & Firestore backup.
 * 2. The Tier 0 Artist Master Directive (`brandingAesthetics` section).
 * 3. Root CSS variables (`--artist-brand-primary`, `--artist-brand-secondary`, `--artist-brand-accent`).
 * 4. Context Pipeline and system prompts for all 23 specialist agents.
 * 5. Window event bus (`indii:brand-colors-updated`).
 */

import { parseColor } from '@/utils/colorUtils';
import { importWithRetry } from '@/utils/dynamicImport';
import { artistDirectiveService } from '@/services/agent/skills/ArtistDirectiveService';
import { logger } from '@/utils/logger';

export interface BrandColorItem {
    hex: string;
    label: string;
    raw: string;
}

export interface BrandSyncResult {
    success: boolean;
    message: string;
    palette: BrandColorItem[];
    formattedRules?: string[];
    error?: string;
}

export const BRAND_COLORS_UPDATED_EVENT = 'indii:brand-colors-updated';

export class BrandSyncService {
    /**
     * Normalizes a raw array of color inputs (hex, name, or combined string)
     * into validated BrandColorItem objects.
     */
    normalizeColors(colors: string[]): BrandColorItem[] {
        if (!Array.isArray(colors)) return [];

        return colors
            .filter(c => typeof c === 'string' && c.trim().length > 0)
            .map(c => {
                const parsed = parseColor(c);
                const raw = parsed.label !== parsed.hex
                    ? `${parsed.label} (${parsed.hex})`
                    : parsed.hex;
                return {
                    hex: parsed.hex,
                    label: parsed.label,
                    raw,
                };
            });
    }

    /**
     * Applies brand colors to the DOM via CSS custom properties.
     */
    applyCssVariables(palette: BrandColorItem[]): void {
        if (typeof document === 'undefined' || !palette.length) return;

        try {
            const root = document.documentElement;
            const primary = palette[0]?.hex || '#000000';
            const secondary = palette[1]?.hex || primary;
            const accent = palette[2]?.hex || secondary;

            root.style.setProperty('--artist-brand-primary', primary);
            root.style.setProperty('--artist-brand-secondary', secondary);
            root.style.setProperty('--artist-brand-accent', accent);
            root.style.setProperty('--artist-brand-palette', palette.map(p => p.hex).join(', '));
        } catch (err) {
            logger.warn('[BrandSyncService] Failed to set CSS custom properties:', err);
        }
    }

    /**
     * Broadcasts the palette change to the UI event bus.
     */
    broadcastUpdate(palette: BrandColorItem[]): void {
        if (typeof window === 'undefined') return;

        try {
            window.dispatchEvent(
                new CustomEvent<BrandColorItem[]>(BRAND_COLORS_UPDATED_EVENT, { detail: palette })
            );
        } catch (err) {
            logger.warn('[BrandSyncService] Failed to dispatch update event:', err);
        }
    }

    /**
     * Cascades the brand palette to the living Artist Master Directive
     * under the 'brandingAesthetics' section.
     */
    async syncToArtistDirective(
        palette: BrandColorItem[],
        aestheticStyle?: string,
        reason: string = 'Brand color palette updated'
    ): Promise<boolean> {
        try {
            const paletteSummary = palette.map(p => p.raw).join(', ');
            const directive = await artistDirectiveService.getDirective();
            const currentRules = directive.sections.brandingAesthetics?.rules || [];

            // Remove previous brand color palette rule if present
            const filteredRules = currentRules.filter(
                r => !r.toLowerCase().startsWith('brand color palette:')
            );

            // Create fresh authoritative palette rule
            const newPaletteRule = `Brand Color Palette: ${paletteSummary}`;
            const updatedRules = [...filteredRules, newPaletteRule];

            if (aestheticStyle?.trim()) {
                const filteredStyleRules = updatedRules.filter(
                    r => !r.toLowerCase().startsWith('visual aesthetic style:')
                );
                filteredStyleRules.push(`Visual Aesthetic Style: ${aestheticStyle.trim()}`);
                updatedRules.length = 0;
                updatedRules.push(...filteredStyleRules);
            }

            const updatedDirective = {
                ...directive,
                lastModifiedBy: 'agent' as const,
                lastModifiedReason: reason,
                updatedAt: new Date().toISOString(),
                sections: {
                    ...directive.sections,
                    brandingAesthetics: {
                        ...directive.sections.brandingAesthetics,
                        rules: updatedRules,
                        content: updatedRules.map(r => `- ${r}`).join('\n'),
                        updatedAt: new Date().toISOString(),
                    },
                },
            };

            const saveResult = await artistDirectiveService.saveDirective(
                updatedDirective,
                'agent',
                reason
            );

            return saveResult.success;
        } catch (err) {
            logger.error('[BrandSyncService] syncToArtistDirective failed:', err);
            return false;
        }
    }

    /**
     * Universal method to set, persist, and propagate brand colors across the entire app.
     */
    async syncBrandPalette(
        colors: string[],
        options: {
            aestheticStyle?: string;
            reason?: string;
            modifiedBy?: 'user' | 'agent';
        } = {}
    ): Promise<BrandSyncResult> {
        if (!colors || colors.length === 0) {
            return {
                success: false,
                message: 'At least one color is required to set a brand palette.',
                palette: [],
                error: 'EMPTY_PALETTE',
            };
        }

        const normalized = this.normalizeColors(colors);
        if (normalized.length === 0) {
            return {
                success: false,
                message: 'No valid colors could be parsed from input.',
                palette: [],
                error: 'INVALID_COLORS',
            };
        }

        const reason = options.reason || 'Synchronized brand palette across app';

        try {
            // 1. Update Zustand store & trigger Firestore profile sync
            const { useStore } = await importWithRetry(() => import('@/core/store'));
            const store = useStore.getState();

            const rawColorStrings = normalized.map(c => c.raw);
            const brandKitUpdates: { colors: string[]; aestheticStyle?: string } = {
                colors: rawColorStrings,
            };

            if (options.aestheticStyle?.trim()) {
                brandKitUpdates.aestheticStyle = options.aestheticStyle.trim();
            }

            await store.updateBrandKit(brandKitUpdates);

            // 2. Cascade to CSS Custom Properties
            this.applyCssVariables(normalized);

            // 3. Cascade to Tier 0 Artist Master Directive
            await this.syncToArtistDirective(normalized, options.aestheticStyle, reason);

            // 4. Broadcast to UI Event Bus
            this.broadcastUpdate(normalized);

            return {
                success: true,
                message: `Brand palette successfully updated with ${normalized.length} colors.`,
                palette: normalized,
                formattedRules: [
                    `Brand Color Palette: ${normalized.map(c => c.raw).join(', ')}`,
                    ...(options.aestheticStyle ? [`Visual Aesthetic Style: ${options.aestheticStyle}`] : []),
                ],
            };
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.error('[BrandSyncService] syncBrandPalette failed:', err);
            return {
                success: false,
                message: `Failed to update brand palette: ${msg}`,
                palette: normalized,
                error: msg,
            };
        }
    }

    /**
     * Gets current active brand colors from store or fallback.
     */
    async getActivePalette(): Promise<BrandColorItem[]> {
        try {
            const { useStore } = await importWithRetry(() => import('@/core/store'));
            const colors = useStore.getState().userProfile?.brandKit?.colors || [];
            return this.normalizeColors(colors);
        } catch {
            return [];
        }
    }
}

export const brandSyncService = new BrandSyncService();
