import {
    judgeAestheticThemeDerivation,
    THEME_PALETTES,
    type ThemeTokens,
    type ThemeDerivationMetadata,
} from '@/config/typesafeJudgments';

/**
 * Apply resolved CSS tokens directly to document root variables.
 */
export function applyThemeTokens(tokens: ThemeTokens) {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.style.setProperty('--color-surface-dynamic', tokens.surfaceHex);
    root.style.setProperty('--color-accent-dynamic', tokens.accentHex);
    root.style.setProperty('--color-text-dynamic', tokens.textHex);
    root.style.setProperty('--waveform-start', tokens.waveformGradient[0]);
    root.style.setProperty('--waveform-end', tokens.waveformGradient[1]);
}

/**
 * Deterministic genre-to-palette mapping baseline:
 * Operates synchronously with zero latency.
 */
export function deriveThemeDeterministic(metadata: ThemeDerivationMetadata): ThemeTokens {
    const combined = `${metadata.genre} ${metadata.subgenre || ''} ${metadata.moodDescriptors.join(' ')}`.toLowerCase();

    if (combined.includes('vinyl') || combined.includes('soul') || combined.includes('acoustic') || combined.includes('jazz')) {
        return THEME_PALETTES['amber-vinyl'];
    }
    if (combined.includes('cyber') || combined.includes('synth') || combined.includes('retro') || combined.includes('electro')) {
        return THEME_PALETTES['cyber-neon'];
    }
    if (combined.includes('lofi') || combined.includes('lo-fi') || combined.includes('chill') || combined.includes('ambient')) {
        return THEME_PALETTES['midnight-lofi'];
    }
    if (combined.includes('acid') || combined.includes('rave') || combined.includes('techno') || combined.includes('club')) {
        return THEME_PALETTES['acid-house'];
    }
    if (combined.includes('rock') || combined.includes('punk') || combined.includes('metal') || combined.includes('grunge')) {
        return THEME_PALETTES['grunge-charcoal'];
    }
    if (combined.includes('pop') || combined.includes('dream') || combined.includes('indie')) {
        return THEME_PALETTES['dream-pastel'];
    }

    return THEME_PALETTES['detroit-industrial'];
}

/**
 * Derive high-fidelity theme tokens using fast Jev classification and apply them to the DOM.
 * Falls back immediately to the deterministic genre mapping if offline.
 */
export async function deriveAndApplyTheme(metadata: ThemeDerivationMetadata): Promise<ThemeTokens> {
    try {
        const jevTokens = await judgeAestheticThemeDerivation(metadata);
        if (jevTokens) {
            applyThemeTokens(jevTokens);
            return jevTokens;
        }
    } catch {
        // Fall through to deterministic palette
    }

    const fallbackTokens = deriveThemeDeterministic(metadata);
    applyThemeTokens(fallbackTokens);
    return fallbackTokens;
}
