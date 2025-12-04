import { render, screen, fireEvent } from '@testing-library/react';
import { VideoPropertiesPanel } from './VideoPropertiesPanel';
import { VideoProject, VideoClip } from '../../store/videoEditorStore';
import { vi } from 'vitest';

describe('VideoPropertiesPanel', () => {
    const mockUpdateClip = vi.fn();
    const mockProject: VideoProject = {
        id: 'test-project',
        name: 'Test Project',
        fps: 30,
        durationInFrames: 300,
        width: 1920,
        height: 1080,
        tracks: [],
        clips: []
    };

    const mockClip: VideoClip = {
        id: 'clip-1',
        type: 'video',
        name: 'Test Clip',
        startFrame: 0,
        durationInFrames: 100,
        trackId: 'track-1',
        scale: 1,
        opacity: 1,
        rotation: 0,
        x: 0,
        y: 0,
        keyframes: {}
    };

    beforeEach(() => {
        mockUpdateClip.mockClear();
    });

    it('renders properties for selected clip', () => {
        render(
            <VideoPropertiesPanel
                project={mockProject}
                selectedClip={mockClip}
                updateClip={mockUpdateClip}
                currentTime={0}
            />
        );

        expect(screen.getByDisplayValue('Test Clip')).toBeInTheDocument();
        expect(screen.getByText('Scale')).toBeInTheDocument();
        expect(screen.getByText('Opacity')).toBeInTheDocument();
    });

    it('adds a keyframe when diamond button is clicked', () => {
        render(
            <VideoPropertiesPanel
                project={mockProject}
                selectedClip={mockClip}
                updateClip={mockUpdateClip}
                currentTime={10}
            />
        );

        // Find the keyframe button for Scale (first one usually, or use title)
        const keyframeButtons = screen.getAllByTitle('Add/Update Keyframe');
        fireEvent.click(keyframeButtons[0]); // Scale is usually first

        expect(mockUpdateClip).toHaveBeenCalledWith('clip-1', expect.objectContaining({
            keyframes: expect.objectContaining({
                scale: expect.arrayContaining([
                    expect.objectContaining({ frame: 10, value: 1 })
                ])
            })
        }));
    });

    it('updates existing keyframe if time matches', () => {
        const clipWithKeyframe = {
            ...mockClip,
            keyframes: {
                scale: [{ frame: 10, value: 1 }]
            }
        };

        render(
            <VideoPropertiesPanel
                project={mockProject}
                selectedClip={clipWithKeyframe}
                updateClip={mockUpdateClip}
                currentTime={10}
            />
        );

        const keyframeButtons = screen.getAllByTitle('Add/Update Keyframe');
        fireEvent.click(keyframeButtons[0]); // Scale

        // Should call update with the SAME frame but potentially new value (logic in component handles replace)
        // In our component, clicking adds/updates.
        expect(mockUpdateClip).toHaveBeenCalled();
    });
});
