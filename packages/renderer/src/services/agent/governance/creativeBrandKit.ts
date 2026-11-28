import type { BrandKit } from '@/types/User';

/**
 * The brand constraints the QC evaluates against — a flattened projection of
 * the stored `BrandKit`. Kept separate so callers can QC against an ad-hoc
 * brief (a one-off campaign look) without a full BrandKit on hand.
 */
export interface CreativeBrandKit {
    /** Hex or named colors the creative should be built around. */
    primaryColors: string[];
    /** Things that must never appear — the artist's hard no's. */
    forbiddenElements: string[];
    /** Overall mood/aesthetic in the artist's own words. */
    vibe: string;
}

/**
 * Projects a stored `BrandKit` onto the QC's input contract.
 *
 * `negativePrompt` is the artist's exclusion list as free text; it is split on
 * commas and newlines into discrete forbidden elements. The vibe falls back
 * through the increasingly general fields the onboarding flow may have filled.
 */
export function toCreativeBrandKit(brandKit: BrandKit): CreativeBrandKit {
    const forbiddenElements = (brandKit.negativePrompt ?? '')
        .split(/[,\n]/)
        .map(entry => entry.trim())
        .filter(entry => entry.length > 0);

    const vibe = [
        brandKit.visualIdentity,
        brandKit.aestheticStyle,
        ...(brandKit.digitalAura ?? []),
        brandKit.brandDescription,
    ].filter((part): part is string => Boolean(part && part.trim())).join(' — ');

    return {
        primaryColors: brandKit.colors ?? [],
        forbiddenElements,
        vibe: vibe || 'No stated visual identity.',
    };
}
