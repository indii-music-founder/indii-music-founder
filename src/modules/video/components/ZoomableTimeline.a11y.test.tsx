import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import { ZoomableTimeline } from './ZoomableTimeline';
import * as videoEditorStore from '../store/videoEditorStore';

expect.extend(matchers);

// Mock the store
vi.mock('../store/videoEditorStore', () => ({
    useVideoEditorStore: vi.fn(),
}));

describe('ZoomableTimeline Accessibility', () => {
    const mockSetTimelineZoom = vi.fn();
    const mockProject = {
        durationInFrames: 300,
        fps: 30,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (videoEditorStore.useVideoEditorStore as any).mockReturnValue({
            timelineZoom: 1,
            setTimelineZoom: mockSetTimelineZoom,
            project: mockProject,
        });
    });

    it('should have no accessibility violations', async () => {
        const { container } = render(
            <ZoomableTimeline>
                <div>Timeline Content</div>
            </ZoomableTimeline>
        );

        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });

    it('should have accessible labels for all zoom controls', () => {
        render(
            <ZoomableTimeline>
                <div>Timeline Content</div>
            </ZoomableTimeline>
        );

        // Check specifically for buttons that were relying on 'title'
        expect(screen.getByRole('button', { name: /Zoom Out/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Reset Zoom/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Zoom In/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Fit to View/i })).toBeInTheDocument();
    });

    it('should identify the timeline region', () => {
        render(
            <ZoomableTimeline>
                <div>Timeline Content</div>
            </ZoomableTimeline>
        );

        // The main container should probably be a region with a label
        expect(screen.getByRole('region', { name: /Timeline/i })).toBeInTheDocument();
    });
});
