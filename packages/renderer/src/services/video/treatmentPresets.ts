import type { IndiiAudioFade, IndiiBackground, IndiiSeam } from '@indii/shared';

/**
 * Named treatment presets (MIG-010). A user's plain-language direction
 * ("make it feel like an amber night") resolves to one of these; the preset
 * fills the project's `background`, `seam`, and per-clip entrance/audio-fade
 * defaults. Values are canonical IndiiVideoProject fields only — no engine
 * syntax may appear here.
 */

export type VideoTreatmentPresetId =
    | 'amber-night-cinematic'
    | 'clean-grid'
    | 'bold-arrival'
    | 'neon-night'
    | 'vinyl-warm'
    | 'cold-blue';

export interface VideoTreatmentPreset {
    id: VideoTreatmentPresetId;
    label: string;
    /** What the direction is FOR — helps the conductor pick a preset. */
    matches: string[];
    background: IndiiBackground;
    seam?: IndiiSeam;
    defaultTextEntrance?: 'waterfall' | 'inverse-zoom';
    audioFade?: { inSeconds?: number; outSeconds?: number };
}

export const VIDEO_TREATMENT_PRESETS: Record<VideoTreatmentPresetId, VideoTreatmentPreset> = {
    'amber-night-cinematic': {
        id: 'amber-night-cinematic',
        label: 'Amber Night Cinematic',
        matches: ['night', 'amber', 'warm', 'cinematic', 'detroit', 'dark', 'moody', 'streetlight'],
        background: {
            kind: 'radial-glow',
            color: '#0B0C0F',
            accent: '#F5B13D',
            glowOpacity: 0.16,
            glowPosition: 'bottom-left',
        },
        seam: { type: 'cut-the-curve', direction: 'LEFT' },
        defaultTextEntrance: 'waterfall',
        audioFade: { inSeconds: 1, outSeconds: 2 },
    },
    'clean-grid': {
        id: 'clean-grid',
        label: 'Clean Grid',
        matches: ['clean', 'tech', 'studio', 'grid', 'professional', 'ui', 'data'],
        background: {
            kind: 'grid',
            color: '#0B0C0F',
            accent: '#F4EFE4',
        },
        seam: { type: 'cut-the-curve', direction: 'LEFT' },
        defaultTextEntrance: 'waterfall',
    },
    'bold-arrival': {
        id: 'bold-arrival',
        label: 'Bold Arrival',
        matches: ['drop', 'release', 'arrival', 'impact', 'big', 'statement', 'reveal'],
        background: {
            kind: 'solid',
            color: '#0B0C0F',
            accent: '#F5B13D',
        },
        seam: { type: 'cut-the-curve', direction: 'LEFT' },
        defaultTextEntrance: 'inverse-zoom',
        audioFade: { inSeconds: 0.5, outSeconds: 2.5 },
    },
    'neon-night': {
        id: 'neon-night',
        label: 'Neon Night',
        matches: ['neon', 'electric', 'synthwave', 'vaporwave', 'club', 'rave', 'cyber'],
        background: {
            kind: 'radial-glow',
            color: '#07070D',
            accent: '#22D3EE',
            glowOpacity: 0.18,
            glowPosition: 'top-right',
        },
        seam: { type: 'cut-the-curve', direction: 'LEFT' },
        defaultTextEntrance: 'waterfall',
        audioFade: { inSeconds: 0.5, outSeconds: 2 },
    },
    'vinyl-warm': {
        id: 'vinyl-warm',
        label: 'Vinyl Warm',
        matches: ['vinyl', 'analog', 'soul', 'jazz', 'classic', 'retro', 'crackle'],
        background: {
            kind: 'ghost-text',
            color: '#100D0A',
            accent: '#E8A34B',
            ghostText: 'GROOVE',
        },
        seam: { type: 'cut-the-curve', direction: 'LEFT' },
        defaultTextEntrance: 'waterfall',
        audioFade: { inSeconds: 1.5, outSeconds: 2.5 },
    },
    'cold-blue': {
        id: 'cold-blue',
        label: 'Cold Blue',
        matches: ['cold', 'blue', 'clean', 'clinical', 'precise', 'winter', 'ice'],
        background: {
            kind: 'grid',
            color: '#080A10',
            accent: '#60A5FA',
        },
        seam: { type: 'cut-the-curve', direction: 'LEFT' },
        defaultTextEntrance: 'waterfall',
    },
};

export const VIDEO_TREATMENT_PRESET_IDS = Object.keys(VIDEO_TREATMENT_PRESETS) as VideoTreatmentPresetId[];

/** Preset whose `matches` vocabulary covers the direction words (best hit count). */
export function resolveTreatmentPreset(direction: string): VideoTreatmentPreset | undefined {
    const words = direction.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    if (words.length === 0) return undefined;
    let best: VideoTreatmentPreset | undefined;
    let bestScore = 0;
    for (const preset of Object.values(VIDEO_TREATMENT_PRESETS)) {
        const score = preset.matches.reduce((sum, match) => (words.includes(match) ? sum + 1 : sum), 0);
        if (score > bestScore) {
            best = preset;
            bestScore = score;
        }
    }
    return bestScore > 0 ? best : undefined;
}

/** The concrete treatment values a preset + inline overrides resolve to. */
export function resolveTreatment(options: {
    preset?: VideoTreatmentPresetId;
    background?: IndiiBackground;
    seam?: IndiiSeam;
    entrance?: 'waterfall' | 'inverse-zoom' | 'none';
    audioFadeInSeconds?: number;
    audioFadeOutSeconds?: number;
}): {
    background?: IndiiBackground;
    seam?: IndiiSeam;
    entrance?: 'waterfall' | 'inverse-zoom' | 'none';
    audioFade?: IndiiAudioFade;
} {
    const preset = options.preset ? VIDEO_TREATMENT_PRESETS[options.preset] : undefined;
    const fades: IndiiAudioFade = {
        ...(preset?.audioFade ?? {}),
        ...(options.audioFadeInSeconds !== undefined ? { inSeconds: options.audioFadeInSeconds } : {}),
        ...(options.audioFadeOutSeconds !== undefined ? { outSeconds: options.audioFadeOutSeconds } : {}),
    };
    return {
        ...(options.background ?? preset?.background ? { background: options.background ?? preset!.background } : {}),
        ...(options.seam ?? preset?.seam ? { seam: options.seam ?? preset!.seam } : {}),
        ...(options.entrance ?? preset?.defaultTextEntrance
            ? { entrance: options.entrance ?? preset!.defaultTextEntrance }
            : {}),
        ...(fades.inSeconds !== undefined || fades.outSeconds !== undefined ? { audioFade: fades } : {}),
    };
}
