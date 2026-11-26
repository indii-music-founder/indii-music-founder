import { describe, it, expect } from 'vitest';
import {
    AD_SHAPE_SPECS,
    compileAdMatrixProjects,
    compileAdMatrixVariant,
    type AdMatrixBrief,
} from './adMatrixTemplates.js';

const SAMPLE_BRIEF: AdMatrixBrief = {
    campaignId: 'camp_launch_01',
    title: 'Midnight Avenue',
    brandOrArtistName: 'indii',
    hookHeadline: 'One track. Full music video + 4 ad cuts.',
    subHeadline: 'Beat-synced, scored 9+/10 before you spend.',
    ctaText: 'Try indii free',
    verticalFootageUrl: 'https://storage.googleapis.com/bucket/vertical.mp4',
    landscapeFootageUrl: 'https://storage.googleapis.com/bucket/landscape.mp4',
    audioHookUrl: 'https://storage.googleapis.com/bucket/hook_15s.wav',
};

describe('adMatrixTemplates', () => {
    it('compiles all 4 shapes by default with platform-native canvas dimensions', () => {
        const variants = compileAdMatrixProjects(SAMPLE_BRIEF);
        expect(variants).toHaveLength(4);
        expect(variants.map(v => v.shape)).toEqual(['9:16', '1:1', '4:5', '16:9']);

        const vertical = variants.find(v => v.shape === '9:16')!;
        const square = variants.find(v => v.shape === '1:1')!;
        const feed = variants.find(v => v.shape === '4:5')!;
        const wide = variants.find(v => v.shape === '16:9')!;

        expect({ w: vertical.project.width, h: vertical.project.height }).toEqual({ w: 1080, h: 1920 });
        expect({ w: square.project.width, h: square.project.height }).toEqual({ w: 1080, h: 1080 });
        expect({ w: feed.project.width, h: feed.project.height }).toEqual({ w: 1080, h: 1350 });
        expect({ w: wide.project.width, h: wide.project.height }).toEqual({ w: 1920, h: 1080 });
    });

    it('keeps 9:16 hook headline & CTA inside mobile safe zones and visible within 0-2s', () => {
        const variant = compileAdMatrixVariant(SAMPLE_BRIEF, '9:16', 15);
        const hook = variant.project.clips.find(c => c.id.endsWith('_hook'))!;
        const cta = variant.project.clips.find(c => c.id.endsWith('_cta'))!;
        const spec = AD_SHAPE_SPECS['9:16'];

        expect(hook.startFrame).toBeLessThan(60); // Within 0-2s at 30fps
        expect(hook.y!).toBeGreaterThanOrEqual(Math.round(spec.height * spec.safeTopPct));
        expect(cta.y!).toBeLessThanOrEqual(Math.round(spec.height * (1 - spec.safeBottomPct)));
        expect(hook.x! + hook.width!).toBeLessThanOrEqual(Math.round(spec.width * (1 - spec.safeRightPct)) + 1);
    });

    it('applies refinement patches cleanly for the < 9.0/10 auto-redo loop', () => {
        const base = compileAdMatrixVariant(SAMPLE_BRIEF, '1:1', 15);
        const refined = compileAdMatrixVariant(SAMPLE_BRIEF, '1:1', 15, {
            fontScaleMultiplier: 0.85,
            extraSafeMarginPct: 0.05,
            headlineOverride: 'Shorter punchier hook',
        });

        const baseHook = base.project.clips.find(c => c.id.endsWith('_hook'))!;
        const refinedHook = refined.project.clips.find(c => c.id.endsWith('_hook'))!;

        expect(refinedHook.text).toBe('Shorter punchier hook');
        expect(refinedHook.fontSize!).toBeLessThan(baseHook.fontSize!);
        expect(refinedHook.x!).toBeGreaterThan(baseHook.x!);
    });
});
