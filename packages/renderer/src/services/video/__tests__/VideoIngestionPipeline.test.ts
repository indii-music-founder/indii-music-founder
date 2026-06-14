import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoIngestionPipeline } from '../VideoIngestionPipeline';
import { useStore } from '@/core/store';

// Mock the Zustand store hooks and actions
vi.mock('@/core/store', () => {
    const mockStore = {
        project: {
            fps: 30,
            tracks: [
                { id: 'track-1', name: 'Main Video', type: 'video' }
            ],
            clips: [] as any[]
        },
        updateProjectSettings: vi.fn((settings) => {
            mockStore.project = { ...mockStore.project, ...settings };
        }),
        addClip: vi.fn((clip) => {
            mockStore.project.clips.push(clip);
        })
    };
    return {
        useStore: {
            getState: () => mockStore
        }
    };
});

describe('VideoIngestionPipeline', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        const state = useStore.getState();
        state.project.clips = [];
        state.project.tracks = [{ id: 'track-1', name: 'Main Video', type: 'video' }];
    });

    it('should ingest assets and append to the timeline track correctly', async () => {
        const asset = {
            id: 'asset-1',
            name: 'broll-1.mp4',
            type: 'video' as const,
            src: 'https://example.com/broll-1.mp4',
            durationSeconds: 5
        };

        const clipId = await VideoIngestionPipeline.ingestAsset(asset);

        expect(clipId).toContain('clip-');
        expect(useStore.getState().addClip).toHaveBeenCalled();
        const addedClip = useStore.getState().project.clips[0];
        expect(addedClip.name).toBe('broll-1.mp4');
        expect(addedClip.startFrame).toBe(0);
        expect(addedClip.durationInFrames).toBe(150); // 5s * 30fps
    });

    it('should snap clip start frames to the closest audio transients', async () => {
        const asset = {
            id: 'asset-2',
            name: 'broll-2.mp4',
            type: 'video' as const,
            src: 'https://example.com/broll-2.mp4',
            durationSeconds: 4
        };

        // Add pre-existing clip of 3 seconds (ends at Frame 90 / 3.0s)
        useStore.getState().project.clips.push({
            id: 'clip-pre',
            type: 'video',
            name: 'pre.mp4',
            startFrame: 0,
            durationInFrames: 90,
            trackId: 'track-1'
        });

        // Sync params: transients at 1.0s, 2.5s, 3.4s, 5.0s
        const syncParams = {
            bpm: 120,
            transientTimestamps: [1.0, 2.5, 3.4, 5.0]
        };

        // 3.0s is closest to 3.4s transient (since difference is 0.4s vs 0.5s for 2.5s)
        const clipId = await VideoIngestionPipeline.ingestAsset(asset, syncParams);

        const addedClip = useStore.getState().project.clips.find(c => c.id === clipId);
        expect(addedClip).toBeDefined();
        // Snapped to 3.4s * 30fps = 102
        expect(addedClip?.startFrame).toBe(102);
    });
});
