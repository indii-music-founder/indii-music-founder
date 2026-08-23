/**
 * RenderPlanner routing tests (MIG-004) — table-driven, one row per rule.
 * Only external behavior: input → decision/error reason.
 */

import { describe, expect, it } from 'vitest';

import type { IndiiVideoClip, IndiiVideoProject } from './videoProject.js';
import { decisionToJobMetadata, planRenderRoute, VideoRouteError } from './videoRoute.js';

const clip = (over: Partial<IndiiVideoClip> = {}): IndiiVideoClip => ({
    id: 'c1',
    type: 'video',
    startFrame: 0,
    durationInFrames: 60,
    trackId: 't1',
    name: 'clip',
    ...over,
});

const project = (clips: IndiiVideoClip[]): Pick<IndiiVideoProject, 'clips' | 'tracks'> => ({
    clips,
    tracks: [{ id: 't1', name: 'V1', type: 'video' }],
});

describe('planRenderRoute', () => {
    it('routes explicit fast-path operations outright, before any other rule', () => {
        const decision = planRenderRoute({
            explicitOp: 'thumbnail',
            project: project([clip({ type: 'text', filter: { type: 'blur', intensity: 10 } })]),
        });
        expect(decision).toEqual({ route: 'direct_media', op: 'thumbnail', reason: 'explicit-direct-op' });
    });

    it('fails closed with no inputs', () => {
        expect(() => planRenderRoute({})).toThrow(VideoRouteError);
        try {
            planRenderRoute({});
            expect.unreachable();
        } catch (err) {
            expect((err as VideoRouteError).reason).toBe('no-routable-input');
        }
    });

    it('fails closed on an empty timeline instead of guessing', () => {
        expect(() => planRenderRoute({ project: project([]) })).toThrow(/empty-project/);
    });

    it('routes text clips to composition', () => {
        const d = planRenderRoute({ project: project([clip({ type: 'text', text: 'hi' })]) });
        expect(d.route).toBe('composed_visual');
        expect(d.reason).toBe('text-requires-composition');
    });

    it('routes effect-laden clips to composition (filter)', () => {
        const d = planRenderRoute({
            project: project([clip({ filter: { type: 'sepia', intensity: 50 } })]),
        });
        expect(d).toMatchObject({ route: 'composed_visual', reason: 'effects-require-composition' });
    });

    it('routes transition-carrying clips to composition', () => {
        const d = planRenderRoute({
            project: project([clip({ transitionIn: { type: 'fade', duration: 12 } })]),
        });
        expect(d.reason).toBe('effects-require-composition');
    });

    it('routes keyframed clips to composition', () => {
        const d = planRenderRoute({
            project: project([clip({ keyframes: { opacity: [{ frame: 0, value: 0 }] } })]),
        });
        expect(d.reason).toBe('effects-require-composition');
    });

    it('routes static visual transforms and timeline offsets to composition', () => {
        expect(planRenderRoute({ project: project([clip({ scale: 1.2 })]) }).reason)
            .toBe('effects-require-composition');
        expect(planRenderRoute({ project: project([clip({ startFrame: 10 })]) }).reason)
            .toBe('timeline-offset');
    });

    it('routes image overlays to composition (conservative)', () => {
        const d = planRenderRoute({ project: project([clip({ type: 'image' })]) });
        expect(d.reason).toBe('graphic-overlay');
    });

    it('routes multi-clip timelines to composition', () => {
        const d = planRenderRoute({ project: project([clip(), clip()]) });
        expect(d.reason).toBe('multi-clip-timeline');
    });

    it('fast-paths one video plus one aligned master audio as audio replacement', () => {
        const d = planRenderRoute({
            project: project([
                clip(),
                clip({ id: 'a1', type: 'audio', trackId: 't1', src: 'master.wav' }),
            ]),
        });
        expect(d).toEqual({
            route: 'direct_media',
            op: 'audio_replace',
            reason: 'single-video-master-audio',
        });
    });

    it('routes track mute/hidden controls to composition', () => {
        const muted = project([clip()]);
        muted.tracks[0] = { ...muted.tracks[0]!, isMuted: true };
        expect(planRenderRoute({ project: muted }).reason).toBe('track-controls-require-composition');
    });

    it('fast-paths a single trimmed source clip to µs-precision trim', () => {
        const d = planRenderRoute({
            project: project([clip({ sourceInUs: 500_000, sourceOutUs: 3_500_000 })]),
        });
        expect(d).toEqual({ route: 'direct_media', op: 'trim', reason: 'single-clip-trim' });
    });

    it('fast-paths a single untouched clip to transcode passthrough', () => {
        const d = planRenderRoute({ project: project([clip()]) });
        expect(d).toEqual({ route: 'direct_media', op: 'transcode', reason: 'single-clip-passthrough' });
    });
});

describe('decisionToJobMetadata', () => {
    it('flattens decisions into persisted metadata with op omitted when absent', () => {
        expect(decisionToJobMetadata({ route: 'composed_visual', reason: 'multi-clip-timeline' }))
            .toEqual({ videoRoute: 'composed_visual', routeReason: 'multi-clip-timeline' });
        expect(decisionToJobMetadata({ route: 'direct_media', op: 'trim', reason: 'single-clip-trim' }))
            .toEqual({ videoRoute: 'direct_media', videoOp: 'trim', routeReason: 'single-clip-trim' });
    });
});
