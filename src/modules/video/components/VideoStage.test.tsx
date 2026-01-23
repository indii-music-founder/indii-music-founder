import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { VideoStage } from './VideoStage';
import { HistoryItem } from '@/core/store';

describe('VideoStage Accessibility', () => {
    const mockSetVideoInputs = vi.fn();
    const mockVideo: HistoryItem = {
        id: '1',
        url: 'http://example.com/video.mp4',
        type: 'video',
        timestamp: Date.now(),
        prompt: 'Test video',
        projectId: 'test-project'
    };

    it('buttons have accessibility attributes and focus styles', () => {
        render(
            <VideoStage
                jobStatus="idle"
                jobProgress={0}
                activeVideo={mockVideo}
                setVideoInputs={mockSetVideoInputs}
            />
        );

        const anchorBtn = screen.getByTestId('set-anchor-btn');
        const endBtn = screen.getByTestId('set-end-frame-btn');

        // Check for aria-labels
        expect(anchorBtn).toHaveAttribute('aria-label', 'Set as anchor frame for next generation');
        expect(endBtn).toHaveAttribute('aria-label', 'Set as end frame for next generation');

        // Check for focus visible styles
        expect(anchorBtn.className).toContain('focus-visible:ring-2');
        expect(anchorBtn.className).toContain('focus-visible:ring-white/50');
        expect(anchorBtn.className).toContain('focus-visible:outline-none');

        expect(endBtn.className).toContain('focus-visible:ring-2');
        expect(endBtn.className).toContain('focus-visible:ring-white/50');
        expect(endBtn.className).toContain('focus-visible:outline-none');
    });
});
