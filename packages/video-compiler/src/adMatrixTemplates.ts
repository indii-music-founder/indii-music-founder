/**
 * Multi-Shape Ad Matrix Compiler — @indii/video-compiler
 *
 * Deterministically compiles one creative brief + canonical visual/audio assets
 * into platform-native IndiiVideoProject definitions across every major ad shape
 * (9:16 Reels/TikTok/Shorts, 1:1 Square Feed, 4:5 Meta/IG Feed, 16:9 YouTube/Web)
 * and duration (6s Bumper, 15s Hook Ad, 30s Story Ad), with enforced mobile
 * safe zones and iterative refinement patches for the >= 9/10 autorater loop.
 */

import type { IndiiVideoClip, IndiiVideoProject } from '@indii/shared';

export type AdAspectShape = '9:16' | '1:1' | '4:5' | '16:9';
export type AdDurationSec = 6 | 15 | 30;

export interface AdShapeSafeZone {
    shape: AdAspectShape;
    width: number;
    height: number;
    channelLabel: string;
    safeTopPct: number;
    safeBottomPct: number;
    safeLeftPct: number;
    safeRightPct: number;
    baseHeadlineFontSize: number;
    baseCtaFontSize: number;
}

export const AD_SHAPE_SPECS: Record<AdAspectShape, AdShapeSafeZone> = {
    '9:16': {
        shape: '9:16',
        width: 1080,
        height: 1920,
        channelLabel: 'Reels / TikTok / YouTube Shorts',
        safeTopPct: 0.14,
        safeBottomPct: 0.24, // Clears TikTok/Reels bottom caption & audio ticker
        safeLeftPct: 0.08,
        safeRightPct: 0.16, // Clears TikTok/Reels right-side action buttons
        baseHeadlineFontSize: 66,
        baseCtaFontSize: 36,
    },
    '1:1': {
        shape: '1:1',
        width: 1080,
        height: 1080,
        channelLabel: 'Instagram / X / Meta Square Feed',
        safeTopPct: 0.10,
        safeBottomPct: 0.12,
        safeLeftPct: 0.08,
        safeRightPct: 0.08,
        baseHeadlineFontSize: 56,
        baseCtaFontSize: 32,
    },
    '4:5': {
        shape: '4:5',
        width: 1080,
        height: 1350,
        channelLabel: 'Meta / Instagram Vertical Feed',
        safeTopPct: 0.11,
        safeBottomPct: 0.14,
        safeLeftPct: 0.08,
        safeRightPct: 0.08,
        baseHeadlineFontSize: 60,
        baseCtaFontSize: 34,
    },
    '16:9': {
        shape: '16:9',
        width: 1920,
        height: 1080,
        channelLabel: 'YouTube In-Stream / Web Hero',
        safeTopPct: 0.10,
        safeBottomPct: 0.14,
        safeLeftPct: 0.08,
        safeRightPct: 0.08,
        baseHeadlineFontSize: 64,
        baseCtaFontSize: 34,
    },
};

export interface AdRefinementPatch {
    fontScaleMultiplier?: number;
    extraSafeMarginPct?: number;
    headlineOverride?: string;
    ctaOverride?: string;
}

export interface AdMatrixBrief {
    campaignId: string;
    title: string;
    brandOrArtistName: string;
    hookHeadline: string;
    subHeadline?: string;
    ctaText: string;
    accentColor?: string;
    backgroundColor?: string;
    /** Portrait/vertical source footage URL or gs:// URI for 9:16, 4:5, 1:1 */
    verticalFootageUrl: string;
    /** Optional landscape footage URL for 16:9 (falls back to verticalFootageUrl if omitted) */
    landscapeFootageUrl?: string;
    /** Synchronized audio hook URL */
    audioHookUrl?: string;
    shapes?: AdAspectShape[];
    durations?: AdDurationSec[];
    bpm?: number;
}

export interface CompiledAdMatrixVariant {
    variantId: string;
    shape: AdAspectShape;
    durationSeconds: AdDurationSec;
    channelLabel: string;
    safeZone: AdShapeSafeZone;
    project: IndiiVideoProject;
}

/**
 * Compiles one variant of the ad matrix for a specific shape and duration,
 * optionally applying a corrective refinement patch from `VideoAdAutorater`.
 */
export function compileAdMatrixVariant(
    brief: AdMatrixBrief,
    shape: AdAspectShape,
    durationSeconds: AdDurationSec,
    patch?: AdRefinementPatch,
): CompiledAdMatrixVariant {
    const fps = 30;
    const spec = AD_SHAPE_SPECS[shape];
    const durationInFrames = durationSeconds * fps;
    const extraMargin = Math.max(0, Math.min(0.10, patch?.extraSafeMarginPct ?? 0));
    const fontScale = Math.max(0.75, Math.min(1.25, patch?.fontScaleMultiplier ?? 1.0));

    const safeLeft = Math.round(spec.width * (spec.safeLeftPct + extraMargin));
    const safeRight = Math.round(spec.width * (spec.safeRightPct + extraMargin));
    const safeWidth = Math.max(240, spec.width - safeLeft - safeRight);

    const headlineY = Math.round(spec.height * (spec.safeTopPct + extraMargin));
    const ctaHeightEstimate = 84;
    const ctaY = Math.max(
        headlineY + 220,
        Math.round(spec.height * (1 - spec.safeBottomPct - extraMargin)) - ctaHeightEstimate,
    );

    const headlineText = (patch?.headlineOverride ?? brief.hookHeadline).trim();
    const ctaText = (patch?.ctaOverride ?? brief.ctaText).trim();
    const accent = brief.accentColor || '#FFE135';
    const footageSrc = shape === '16:9'
        ? (brief.landscapeFootageUrl || brief.verticalFootageUrl)
        : brief.verticalFootageUrl;

    const variantId = `${brief.campaignId}_${shape.replace(':', 'x')}_${durationSeconds}s`;

    // Hook headline enters at frame 4 (~0.13s) so the hook is unmistakably visible within 0–2s
    const headlineDuration = durationSeconds === 6
        ? Math.max(fps * 3, durationInFrames - fps * 2)
        : Math.min(durationInFrames - fps * 3, fps * 6);
    const ctaStart = Math.max(fps * 2, durationInFrames - (durationSeconds === 6 ? fps * 2 : fps * 4));

    const clips: IndiiVideoClip[] = [
        {
            id: `${variantId}_footage`,
            type: 'video',
            src: footageSrc,
            ...(footageSrc.startsWith('gs://') ? { canonicalSourceUri: footageSrc } : {}),
            startFrame: 0,
            durationInFrames,
            trackId: 'video-bg',
            name: `${brief.title} Footage (${shape})`,
            width: spec.width,
            height: spec.height,
            hasAudio: false,
        },
        {
            id: `${variantId}_brand`,
            type: 'text',
            text: brief.brandOrArtistName.toUpperCase(),
            startFrame: 0,
            durationInFrames,
            trackId: 'overlay-brand',
            name: 'Brand / Artist Tag',
            x: safeLeft,
            y: Math.max(24, headlineY - 56),
            width: safeWidth,
            textColor: accent,
            fontSize: Math.round(24 * fontScale),
            fontWeight: '800',
            textAlign: 'left',
            fontFamily: 'Space Mono',
            letterSpacing: 0.12,
        },
        {
            id: `${variantId}_hook`,
            type: 'text',
            text: headlineText,
            startFrame: 4,
            durationInFrames: Math.max(fps * 2, headlineDuration),
            trackId: 'overlay-hook',
            name: '0-2s Hook Headline',
            x: safeLeft,
            y: headlineY,
            width: safeWidth,
            textColor: '#FFFFFF',
            fontSize: Math.round(spec.baseHeadlineFontSize * fontScale),
            fontWeight: '900',
            textAlign: 'left',
            fontFamily: 'Archivo Black',
            textShadow: { color: 'rgba(0,0,0,0.8)', blur: 20, offsetX: 0, offsetY: 4 },
            entrance: { type: 'waterfall', staggerSeconds: 0.04 },
        },
        {
            id: `${variantId}_cta`,
            type: 'text',
            text: ctaText,
            startFrame: ctaStart,
            durationInFrames: Math.max(fps * 2, durationInFrames - ctaStart),
            trackId: 'overlay-cta',
            name: 'CTA End-Card',
            x: safeLeft,
            y: ctaY,
            width: safeWidth,
            textColor: '#0A0A0A',
            fontSize: Math.round(spec.baseCtaFontSize * fontScale),
            fontWeight: '800',
            textAlign: 'center',
            fontFamily: 'Space Mono',
            textBackground: { color: accent, padding: 18, radius: 14 },
            transitionIn: { type: 'fade', duration: 8 },
        },
    ];

    if (brief.subHeadline?.trim() && durationSeconds >= 15) {
        const subStart = Math.min(ctaStart - fps * 2, headlineDuration);
        const subDuration = Math.max(fps * 2, ctaStart - subStart);
        clips.push({
            id: `${variantId}_sub`,
            type: 'text',
            text: brief.subHeadline.trim(),
            startFrame: Math.max(fps * 3, subStart),
            durationInFrames: subDuration,
            trackId: 'overlay-hook',
            name: 'Mid-Cut Value Proof',
            x: safeLeft,
            y: headlineY + 24,
            width: safeWidth,
            textColor: '#F4F4F5',
            fontSize: Math.round(spec.baseHeadlineFontSize * 0.72 * fontScale),
            fontWeight: '700',
            textAlign: 'left',
            fontFamily: 'Archivo Black',
            textShadow: { color: 'rgba(0,0,0,0.8)', blur: 16, offsetX: 0, offsetY: 3 },
            transitionIn: { type: 'fade', duration: 8 },
        });
    }

    if (brief.audioHookUrl) {
        clips.push({
            id: `${variantId}_audio`,
            type: 'audio',
            src: brief.audioHookUrl,
            startFrame: 0,
            durationInFrames,
            trackId: 'audio-hook',
            name: `${brief.title} Audio Hook`,
            volume: 1,
            audioFade: { inSeconds: 0.1, outSeconds: 0.45 },
        });
    }

    const project: IndiiVideoProject = {
        id: variantId,
        name: `${brief.title} [${shape} · ${durationSeconds}s]`,
        fps,
        durationInFrames,
        width: spec.width,
        height: spec.height,
        tracks: [
            { id: 'video-bg', name: 'Footage', type: 'video' },
            { id: 'overlay-brand', name: 'Brand Tag', type: 'text' },
            { id: 'overlay-hook', name: 'Hook Copy', type: 'text' },
            { id: 'overlay-cta', name: 'CTA End-Card', type: 'text' },
            ...(brief.audioHookUrl ? [{ id: 'audio-hook', name: 'Audio Hook', type: 'audio' as const }] : []),
        ],
        clips,
    };

    return {
        variantId,
        shape,
        durationSeconds,
        channelLabel: spec.channelLabel,
        safeZone: spec,
        project,
    };
}

/**
 * Compiles the full multi-shape ad matrix (defaults to all 4 shapes x 15s).
 */
export function compileAdMatrixProjects(brief: AdMatrixBrief): CompiledAdMatrixVariant[] {
    const shapes: AdAspectShape[] = brief.shapes && brief.shapes.length > 0
        ? brief.shapes
        : ['9:16', '1:1', '4:5', '16:9'];
    const durations: AdDurationSec[] = brief.durations && brief.durations.length > 0
        ? brief.durations
        : [15];

    const variants: CompiledAdMatrixVariant[] = [];
    for (const shape of shapes) {
        for (const duration of durations) {
            variants.push(compileAdMatrixVariant(brief, shape, duration));
        }
    }
    return variants;
}
