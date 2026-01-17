
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processJobUpdate } from './VideoWorkflow';

describe('VideoWorkflow - processJobUpdate', () => {
    let mockDeps: any;

    beforeEach(() => {
        mockDeps = {
            currentProjectId: 'proj-456',
            currentOrganizationId: 'org-123',
            localPrompt: 'default prompt',
            addToHistory: vi.fn(),
            setActiveVideo: vi.fn(),
            setJobId: vi.fn(),
            setJobStatus: vi.fn(),
            setJobProgress: vi.fn(),
            toast: {
                success: vi.fn(),
                error: vi.fn(),
                info: vi.fn(),
            },
            resetEditorProgress: vi.fn(),
            getCurrentStatus: vi.fn(() => 'processing'),
        };
    });

    it('extracts Veo 3.1 metadata and stores it in HistoryItem.meta', () => {
        const veoMetadata = {
            duration_seconds: 5.0,
            fps: 24,
            mime_type: "video/mp4"
        };

        const jobData = {
            status: 'completed',
            videoUrl: 'http://veo.generated/video.mp4',
            prompt: 'Hyper-realistic drone shot',
            metadata: veoMetadata,
            progress: 100
        };

        processJobUpdate(jobData, 'veo-job-123', mockDeps);

        // Verify that addToHistory was called with the correct metadata
        expect(mockDeps.addToHistory).toHaveBeenCalledWith(expect.objectContaining({
            id: 'veo-job-123',
            url: 'http://veo.generated/video.mp4',
            type: 'video',
            meta: JSON.stringify(veoMetadata)
        }));

        expect(mockDeps.setJobStatus).toHaveBeenCalledWith('idle');
        expect(mockDeps.toast.success).toHaveBeenCalledWith('Scene generated!');
    });
});
