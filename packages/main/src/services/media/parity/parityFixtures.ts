/**
 * Golden parity fixtures (MIG-007).
 *
 * Canonical source of truth = IndiiVideoProject JSON. Engine-native
 * translations (Remotion props today, generated HyperFrames HTML at MIG-008)
 * hang off these definitions; the harness never hardcodes either shape.
 *
 * All fixtures are SHORT (≤90 frames @30fps, ≤360p-class canvases in tests)
 * and fully deterministic: no clocks, no randomness, no network media.
 */

import type { IndiiVideoProject } from '@indii/shared';

export interface ParityFixture {
    id: string;
    description: string;
    /** What the fixture exercises, for report grouping + sign-off tracking. */
    covers: Array<'timing' | 'trim' | 'typography' | 'overlay' | 'effects' | 'transitions' | 'captions'>;
    project: Pick<IndiiVideoProject, 'id' | 'name' | 'fps' | 'durationInFrames' | 'width' | 'height' | 'tracks' | 'clips'>;
}

const base = (id: string, name: string) => ({
    id,
    name,
    fps: 30,
    width: 320,
    height: 180,
    tracks: [{ id: 't1', name: 'V1', type: 'video' as const }],
});

export const PARITY_FIXTURES: Record<string, ParityFixture> = {
    'single-trim': {
        id: 'single-trim',
        description: 'One source clip cut to a µs span — DIRECT MEDIA route sanity.',
        covers: ['timing', 'trim'],
        project: {
            ...base('fx-single-trim', 'Fixture: single trim'),
            durationInFrames: 30,
            clips: [{
                id: 'c1', type: 'video', src: 'input.mp4', name: 'src',
                startFrame: 0, durationInFrames: 30, trackId: 't1',
                sourceInUs: 250_000, sourceOutUs: 1_250_000,
            }],
        },
    },
    'text-title': {
        id: 'text-title',
        description: 'Single text clip — typography through the composition engine.',
        covers: ['timing', 'typography'],
        project: {
            ...base('fx-text-title', 'Fixture: text title'),
            durationInFrames: 60,
            tracks: [
                { id: 't1', name: 'V1', type: 'video' },
                { id: 't2', name: 'TXT', type: 'text' },
            ],
            clips: [
                { id: 'bg', type: 'video', src: 'input.mp4', name: 'bed', startFrame: 0, durationInFrames: 60, trackId: 't1' },
                {
                    id: 'title', type: 'text', text: 'indii', name: 'title',
                    startFrame: 15, durationInFrames: 45, trackId: 't2',
                    textColor: '#ffffff', fontSize: 42, fontWeight: '700', textAlign: 'center',
                },
            ],
        },
    },
    'overlay-fx': {
        id: 'overlay-fx',
        description: 'Video bed + image overlay + color filter + fade transition.',
        covers: ['timing', 'overlay', 'effects', 'transitions'],
        project: {
            ...base('fx-overlay-fx', 'Fixture: overlay + effects'),
            durationInFrames: 90,
            tracks: [
                { id: 't1', name: 'V1', type: 'video' },
                { id: 't2', name: 'GFX', type: 'video' },
            ],
            clips: [
                { id: 'bed', type: 'video', src: 'input.mp4', name: 'bed', startFrame: 0, durationInFrames: 90, trackId: 't1' },
                {
                    id: 'art', type: 'image', src: 'cover.png', name: 'cover-art',
                    startFrame: 10, durationInFrames: 70, trackId: 't2',
                    x: 0.62, y: 0.18, width: 0.3, opacity: 0.92, rotation: 4,
                    filter: { type: 'sepia', intensity: 20 },
                    transitionIn: { type: 'fade', duration: 10 },
                },
            ],
        },
    },
    captions: {
        id: 'captions',
        description: 'Timed caption rail over footage — three sequential text clips.',
        covers: ['timing', 'captions'],
        project: {
            ...base('fx-captions', 'Fixture: caption rail'),
            durationInFrames: 90,
            tracks: [
                { id: 't1', name: 'V1', type: 'video' },
                { id: 't2', name: 'CC', type: 'text' },
            ],
            clips: [
                { id: 'bed', type: 'video', src: 'input.mp4', name: 'bed', startFrame: 0, durationInFrames: 90, trackId: 't1' },
                { id: 'cc1', type: 'text', text: 'line one', name: 'cc1', startFrame: 5, durationInFrames: 25, trackId: 't2', textColor: '#ffffff', fontSize: 18, textAlign: 'center' },
                { id: 'cc2', type: 'text', text: 'line two', name: 'cc2', startFrame: 35, durationInFrames: 25, trackId: 't2', textColor: '#ffffff', fontSize: 18, textAlign: 'center' },
                { id: 'cc3', type: 'text', text: 'line three', name: 'cc3', startFrame: 65, durationInFrames: 25, trackId: 't2', textColor: '#ffffff', fontSize: 18, textAlign: 'center' },
            ],
        },
    },
};
