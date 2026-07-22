import { describe, expect, it } from 'vitest';
import { compileApprovalToTimeline, VideoProject } from './videoEditorStore';

describe('compileApprovalToTimeline', () => {
    const mockProject: VideoProject = {
        id: 'proj-1',
        name: 'Test Project',
        fps: 30,
        durationInFrames: 0,
        width: 1920,
        height: 1080,
        tracks: [
            { id: 'track-v1', name: 'Video Track', type: 'video' },
        ],
        clips: [],
    };

    const mockApproval = {
        approvalReceiptId: 'app-receipt-1',
        planId: 'plan-1',
        ownerUid: 'user-1',
        projectId: 'proj-1',
        decisions: [
            { segmentId: 'seg-1', action: 'keep' },
            { segmentId: 'seg-2', action: 'reject' },
            { segmentId: 'seg-3', action: 'blooper' },
        ],
    };

    const mockPlan = {
        segments: [
            {
                segmentId: 'seg-1',
                classification: 'spoken',
                proxyStartUs: 0,
                proxyEndUs: 2_000_000, // 2 seconds = 60 frames at 30fps
                originalStartUs: 10_000_000,
                originalEndUs: 12_000_000,
                transcriptText: 'First announcement attempt',
                syncAlignmentId: 'sync-1',
            },
            {
                segmentId: 'seg-2',
                classification: 'failed_take',
                proxyStartUs: 2_000_000,
                proxyEndUs: 5_000_000,
                originalStartUs: 12_000_000,
                originalEndUs: 15_000_000,
                transcriptText: 'Coughing and mistake',
            },
            {
                segmentId: 'seg-3',
                classification: 'candid',
                proxyStartUs: 5_000_000,
                proxyEndUs: 8_000_000, // 3 seconds = 90 frames at 30fps
                originalStartUs: 15_000_000,
                originalEndUs: 18_000_000,
                transcriptText: 'Behind the scenes laugh',
            },
        ],
    };

    const mockSession = {
        original: { bucket: 'b', path: 'p', generation: '1001' },
        proxyManifest: { proxy: { bucket: 'b', path: 'p_proxy', generation: '1002' } },
    };

    it('compiles only approved keep and blooper segments into timeline clips', () => {
        const compiled = compileApprovalToTimeline(mockApproval, mockPlan, mockSession, mockProject);

        expect(compiled.clips.length).toBe(2);
        expect(compiled.clips[0]?.approvalReceiptId).toBe('app-receipt-1');
        expect(compiled.clips[0]?.sourceInUs).toBe(10_000_000);
        expect(compiled.clips[0]?.sourceOutUs).toBe(12_000_000);
        expect(compiled.clips[0]?.startFrame).toBe(0);
        expect(compiled.clips[0]?.durationInFrames).toBe(60);

        expect(compiled.clips[1]?.sourceInUs).toBe(15_000_000);
        expect(compiled.clips[1]?.sourceOutUs).toBe(18_000_000);
        expect(compiled.clips[1]?.startFrame).toBe(60);
        expect(compiled.clips[1]?.durationInFrames).toBe(90);

        expect(compiled.durationInFrames).toBe(150);
    });
});
