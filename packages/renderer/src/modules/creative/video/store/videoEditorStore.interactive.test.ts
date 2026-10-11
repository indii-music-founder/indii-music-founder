import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useVideoEditorStore, VideoProject } from './videoEditorStore';

vi.unmock('@/modules/creative/video/store/videoEditorStore');
vi.unmock('@/services/MembershipService');

describe('useVideoEditorStore — Interactive NLE Timeline Tools', () => {
    const baseProject: VideoProject = {
        id: 'test-nle-project',
        name: 'NLE Interactive Test',
        fps: 30,
        durationInFrames: 600,
        width: 1920,
        height: 1080,
        tracks: [
            { id: 'track-v1', name: 'Video 1', type: 'video' },
            { id: 'track-v2', name: 'Video 2', type: 'video' },
        ],
        clips: [
            {
                id: 'clip-1',
                trackId: 'track-v1',
                type: 'video',
                name: 'Clip 1',
                startFrame: 0,
                durationInFrames: 100,
                sourceInUs: 0,
                sourceOutUs: 3_333_333, // 100 frames @ 30fps
            },
            {
                id: 'clip-2',
                trackId: 'track-v1',
                type: 'video',
                name: 'Clip 2',
                startFrame: 100,
                durationInFrames: 80,
                sourceInUs: 1_000_000,
                sourceOutUs: 3_666_667, // 80 frames @ 30fps
            },
            {
                id: 'clip-3',
                trackId: 'track-v1',
                type: 'video',
                name: 'Clip 3',
                startFrame: 220,
                durationInFrames: 50,
            },
            {
                id: 'clip-other-track',
                trackId: 'track-v2',
                type: 'video',
                name: 'Clip Other Track',
                startFrame: 150,
                durationInFrames: 60,
            },
        ],
    };

    beforeEach(() => {
        const store = useVideoEditorStore.getState();
        store.setProject(JSON.parse(JSON.stringify(baseProject)));
        store.setActiveTool('select');
        useVideoEditorStore.setState({ past: [], future: [] });
    });

    describe('Timeline Tool Switcher State', () => {
        it('initializes with "select" tool active by default', () => {
            expect(useVideoEditorStore.getState().activeTool).toBe('select');
        });

        it('switches between all NLE editing tools correctly', () => {
            const store = useVideoEditorStore.getState();

            store.setActiveTool('razor');
            expect(useVideoEditorStore.getState().activeTool).toBe('razor');

            store.setActiveTool('ripple');
            expect(useVideoEditorStore.getState().activeTool).toBe('ripple');

            store.setActiveTool('slip');
            expect(useVideoEditorStore.getState().activeTool).toBe('slip');

            store.setActiveTool('select');
            expect(useVideoEditorStore.getState().activeTool).toBe('select');
        });
    });

    describe('Ripple Trim Tool (rippleTrimClip)', () => {
        it('ripple trims right edge (lengthening) and shifts downstream clips on the same track', () => {
            const store = useVideoEditorStore.getState();

            // Lengthen clip-1 by +30 frames (from 100 to 130 frames)
            store.rippleTrimClip('clip-1', 'resize-right', 30);

            const clips = useVideoEditorStore.getState().project.clips;
            const clip1 = clips.find(c => c.id === 'clip-1')!;
            const clip2 = clips.find(c => c.id === 'clip-2')!;
            const clip3 = clips.find(c => c.id === 'clip-3')!;
            const clipOther = clips.find(c => c.id === 'clip-other-track')!;

            // Clip 1 duration increased
            expect(clip1.durationInFrames).toBe(130);
            expect(clip1.startFrame).toBe(0);
            // Source out shifted proportionally
            expect(clip1.sourceOutUs).toBeGreaterThan(3_333_333);

            // Clip 2 and Clip 3 downstream on track-v1 shifted by +30 frames
            expect(clip2.startFrame).toBe(130); // Originally 100
            expect(clip2.durationInFrames).toBe(80); // Unchanged

            expect(clip3.startFrame).toBe(250); // Originally 220 + 30
            expect(clip3.durationInFrames).toBe(50); // Unchanged

            // Clip on track-v2 was unaffected
            expect(clipOther.startFrame).toBe(150);
            expect(clipOther.durationInFrames).toBe(60);
        });

        it('ripple trims right edge (shortening) and closes the gap for downstream clips', () => {
            const store = useVideoEditorStore.getState();

            // Shorten clip-1 by -40 frames (from 100 to 60 frames)
            store.rippleTrimClip('clip-1', 'resize-right', -40);

            const clips = useVideoEditorStore.getState().project.clips;
            const clip1 = clips.find(c => c.id === 'clip-1')!;
            const clip2 = clips.find(c => c.id === 'clip-2')!;
            const clip3 = clips.find(c => c.id === 'clip-3')!;

            expect(clip1.durationInFrames).toBe(60);
            expect(clip2.startFrame).toBe(60); // Downstream moved left by 40 frames
            expect(clip3.startFrame).toBe(180); // Originally 220 - 40
        });

        it('enforces minimum clip duration of 1 frame on right edge ripple trim', () => {
            const store = useVideoEditorStore.getState();

            // Attempt to shrink clip-1 by 200 frames (more than its 100-frame duration)
            store.rippleTrimClip('clip-1', 'resize-right', -200);

            const clip1 = useVideoEditorStore.getState().project.clips.find(c => c.id === 'clip-1')!;
            expect(clip1.durationInFrames).toBe(1);

            // Downstream shifted by effective delta (-99 frames)
            const clip2 = useVideoEditorStore.getState().project.clips.find(c => c.id === 'clip-2')!;
            expect(clip2.startFrame).toBe(1);
        });

        it('ripple trims left edge (head) and shifts downstream clips to prevent timeline gaps', () => {
            const store = useVideoEditorStore.getState();

            // Trim 20 frames from the head of clip-2
            store.rippleTrimClip('clip-2', 'resize-left', 20);

            const clips = useVideoEditorStore.getState().project.clips;
            const clip1 = clips.find(c => c.id === 'clip-1')!;
            const clip2 = clips.find(c => c.id === 'clip-2')!;
            const clip3 = clips.find(c => c.id === 'clip-3')!;

            // Clip 1 unchanged
            expect(clip1.startFrame).toBe(0);
            expect(clip1.durationInFrames).toBe(100);

            // Clip 2 duration shrank by 20 frames (from 80 to 60)
            expect(clip2.durationInFrames).toBe(60);
            expect(clip2.startFrame).toBe(100);
            // Source in moved forward in time
            expect(clip2.sourceInUs).toBeGreaterThan(1_000_000);

            // Clip 3 downstream shifted left by 20 frames to close the gap
            expect(clip3.startFrame).toBe(200); // Originally 220 - 20
        });

        it('records undo history and allows undo/redo for ripple trim actions', () => {
            const store = useVideoEditorStore.getState();

            store.rippleTrimClip('clip-1', 'resize-right', 25);
            expect(useVideoEditorStore.getState().project.clips[0]!.durationInFrames).toBe(125);
            expect(useVideoEditorStore.getState().past.length).toBe(1);

            // Undo
            store.undo();
            expect(useVideoEditorStore.getState().project.clips[0]!.durationInFrames).toBe(100);
            expect(useVideoEditorStore.getState().project.clips[1]!.startFrame).toBe(100);

            // Redo
            store.redo();
            expect(useVideoEditorStore.getState().project.clips[0]!.durationInFrames).toBe(125);
            expect(useVideoEditorStore.getState().project.clips[1]!.startFrame).toBe(125);
        });
    });

    describe('Slip Tool (slipClip)', () => {
        it('slides source media window without modifying clip placement or duration', () => {
            const store = useVideoEditorStore.getState();

            const initialClip2 = store.project.clips.find(c => c.id === 'clip-2')!;
            const initialStart = initialClip2.startFrame;
            const initialDuration = initialClip2.durationInFrames;
            const initialSourceIn = initialClip2.sourceInUs!;
            const initialSourceOut = initialClip2.sourceOutUs!;
            const sourceWindow = initialSourceOut - initialSourceIn;

            // Slip clip-2 forward by +10 frames
            store.slipClip('clip-2', 10);

            const slippedClip2 = useVideoEditorStore.getState().project.clips.find(c => c.id === 'clip-2')!;

            // Position and duration strictly unchanged
            expect(slippedClip2.startFrame).toBe(initialStart);
            expect(slippedClip2.durationInFrames).toBe(initialDuration);

            // Source range shifted forward
            const expectedDeltaUs = Math.round((10 * 1_000_000) / 30);
            expect(slippedClip2.sourceInUs).toBe(initialSourceIn + expectedDeltaUs);
            expect(slippedClip2.sourceOutUs).toBe(slippedClip2.sourceInUs! + sourceWindow);
        });

        it('clamps sourceInUs to 0 when slipping backward past media start', () => {
            const store = useVideoEditorStore.getState();

            // clip-1 starts at sourceInUs = 0. Attempting to slip backward by -50 frames
            store.slipClip('clip-1', -50);

            const slippedClip1 = useVideoEditorStore.getState().project.clips.find(c => c.id === 'clip-1')!;
            expect(slippedClip1.sourceInUs).toBe(0);
            expect(slippedClip1.sourceOutUs).toBeGreaterThan(0);
        });

        it('records undo history for slip edits', () => {
            const store = useVideoEditorStore.getState();
            const originalSourceIn = store.project.clips.find(c => c.id === 'clip-2')!.sourceInUs;

            store.slipClip('clip-2', 15);
            expect(useVideoEditorStore.getState().past.length).toBe(1);

            store.undo();
            expect(useVideoEditorStore.getState().project.clips.find(c => c.id === 'clip-2')!.sourceInUs).toBe(originalSourceIn);
        });
    });

    describe('Continuous Transient Drag Updates for Ripple & Slip', () => {
        it('does not push undo history during continuous updateRippleTransient', () => {
            const store = useVideoEditorStore.getState();

            // Simulate drag moves
            store.updateRippleTransient('clip-1', 'resize-right', 10);
            store.updateRippleTransient('clip-1', 'resize-right', 20);
            store.updateRippleTransient('clip-1', 'resize-right', 30);

            // History should NOT be flooded with intermediate steps
            expect(useVideoEditorStore.getState().past.length).toBe(0);

            // Commit final drag state
            store.commitTransientUpdate();

            // Single undo entry recorded
            expect(useVideoEditorStore.getState().past.length).toBe(1);
            expect(useVideoEditorStore.getState().project.clips[0]!.durationInFrames).toBe(130);

            // Undo reverts back to base
            store.undo();
            expect(useVideoEditorStore.getState().project.clips[0]!.durationInFrames).toBe(100);
        });
    });
});
