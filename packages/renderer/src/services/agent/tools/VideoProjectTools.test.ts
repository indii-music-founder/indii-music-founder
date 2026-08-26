import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const project = {
        id: 'project-1', name: 'Project', width: 1920, height: 1080, fps: 30,
        durationInFrames: 30,
        background: undefined as { kind?: string } | undefined,
        seam: undefined as { type?: string; direction?: string } | undefined,
        tracks: [
            { id: 'video-track', name: 'Video', type: 'video' as const },
            { id: 'text-track', name: 'Text', type: 'text' as const },
        ],
        clips: [{
            id: 'clip-1', name: 'Existing', type: 'text' as const, text: 'Before',
            trackId: 'text-track', startFrame: 0, durationInFrames: 30,
        }],
    };
    const getState = () => ({
        project,
        getMaxDurationFrames: () => 300,
        addClip: (clip: Record<string, unknown>) => { project.clips.push({ id: 'clip-2', ...clip } as never); },
        updateClip: (id: string, updates: Record<string, unknown>) => {
            const index = project.clips.findIndex(clip => clip.id === id);
            if (index >= 0) project.clips[index] = { ...project.clips[index], ...updates } as never;
        },
        updateProjectSettings: (settings: Record<string, unknown>) => {
            Object.assign(project, settings);
        },
    });
    return { project, getState, renderVideoProjectLocally: vi.fn() };
});

vi.mock('@/modules/creative/video/store/videoEditorStore', () => ({
    useVideoEditorStore: { getState: mocks.getState },
}));

vi.mock('@/services/video/LocalVideoProjectRenderer', () => ({
    renderVideoProjectLocally: mocks.renderVideoProjectLocally,
}));

import { VideoProjectTools } from './VideoProjectTools';

describe('VideoProjectTools.queue_video_render', () => {
    beforeEach(() => {
        mocks.project.clips.splice(1);
        Object.assign(mocks.project.clips[0]!, { name: 'Existing', text: 'Before', startFrame: 0, durationInFrames: 30 });
        mocks.renderVideoProjectLocally.mockReset().mockResolvedValue({
            status: 'completed',
            renderId: 'render-1',
            projectId: 'project-1',
            progress: 100,
            asset: {
                url: 'file:///managed/render.mp4',
                expiresAt: Number.MAX_SAFE_INTEGER,
                generation: 'local-1',
                mimeType: 'video/mp4',
            },
        });
    });

    it('renders the active canonical project and returns the receipt', async () => {
        const result = await VideoProjectTools.queue_video_render!({
            projectId: 'project-1',
            outputName: 'final.mp4',
        }, { orgId: 'org-1' });

        expect(result.success).toBe(true);
        expect(result.data).toMatchObject({ status: 'completed', renderId: 'render-1' });
        expect(mocks.renderVideoProjectLocally).toHaveBeenCalledWith(mocks.project, {
            outputName: 'final.mp4',
            organizationId: 'org-1',
        });
    });

    it('refuses a request for a project other than the active editor project', async () => {
        const result = await VideoProjectTools.queue_video_render!({ projectId: 'other-project' });

        expect(result.success).toBe(false);
        expect(result.metadata?.errorCode).toBe('VIDEO_PROJECT_NOT_ACTIVE');
        expect(mocks.renderVideoProjectLocally).not.toHaveBeenCalled();
    });

    it('lets the agent inspect, add, and update clips on the live editor project', async () => {
        const inspected = await VideoProjectTools.inspect_video_project!({});
        expect(inspected.data).toMatchObject({ project: { id: 'project-1' } });

        const added = await VideoProjectTools.add_video_clip!({
            type: 'text', name: 'Agent title', text: 'Hello',
            startFrame: 30, durationInFrames: 45,
        });
        expect(added.success).toBe(true);
        expect(mocks.project.clips.at(-1)).toMatchObject({
            id: 'clip-2', trackId: 'text-track', text: 'Hello', startFrame: 30,
        });

        const updated = await VideoProjectTools.update_video_clip!({
            clipId: 'clip-2', text: 'Hello Detroit', opacity: 0.8,
        });
        expect(updated.success).toBe(true);
        expect(mocks.project.clips.at(-1)).toMatchObject({ text: 'Hello Detroit', opacity: 0.8 });
    });

    it('rejects invalid media and incompatible tracks before changing the timeline', async () => {
        const missingSource = await VideoProjectTools.add_video_clip!({
            type: 'video', name: 'Missing', startFrame: 0, durationInFrames: 30,
        });
        expect(missingSource.success).toBe(false);

        const wrongTrack = await VideoProjectTools.add_video_clip!({
            type: 'text', name: 'Title', text: 'Nope', trackId: 'video-track',
            startFrame: 0, durationInFrames: 30,
        });
        expect(wrongTrack.success).toBe(false);
        expect(mocks.project.clips).toHaveLength(1);
    });

    it('applies a named treatment preset to the project, text clips, and audio clips', async () => {
        const result = await VideoProjectTools.apply_video_treatment!({ preset: 'amber-night-cinematic' });

        expect(result.success).toBe(true);
        expect(result.data).toMatchObject({ preset: 'amber-night-cinematic' });
        expect(mocks.project).toMatchObject({
            background: { kind: 'radial-glow', accent: '#F5B13D' },
            seam: { type: 'cut-the-curve', direction: 'LEFT' },
        });
        expect(mocks.project.clips[0]).toMatchObject({ entrance: { type: 'waterfall' } });
    });

    it('lets inline overrides win over the preset and clears entrances on request', async () => {
        const result = await VideoProjectTools.apply_video_treatment!({
            preset: 'amber-night-cinematic',
            seam: { type: 'cut-the-curve', direction: 'RIGHT' },
            entrance: 'none',
            audioFadeOutSeconds: 3,
        });

        expect(result.success).toBe(true);
        expect(mocks.project.seam).toMatchObject({ direction: 'RIGHT' });
        expect(mocks.project.clips[0]).not.toHaveProperty('entrance', { type: 'waterfall' });
    });

    it('refuses an unknown treatment preset without touching the project', async () => {
        const before = JSON.stringify(mocks.project);
        const result = await VideoProjectTools.apply_video_treatment!({ preset: 'nope' as never });

        expect(result.success).toBe(false);
        expect(result.metadata?.errorCode).toBe('INVALID_INPUT');
        expect(JSON.stringify(mocks.project)).toBe(before);
    });
});
