import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoChunkSlicerCard } from './VideoChunkSlicerCard';
import { useVideoEditorStore } from '../../store/videoEditorStore';

const mockAddClip = vi.fn();
const mockProject = {
    id: 'proj_test',
    name: 'Music Video Project',
    fps: 30,
    durationInFrames: 900,
    width: 1920,
    height: 1080,
    tracks: [{ id: 'track_v1', name: 'Main Video', type: 'video' as const }],
    clips: [],
};

vi.mock('../../store/videoEditorStore', () => ({
    useVideoEditorStore: vi.fn((selector) => {
        const state = {
            addClip: mockAddClip,
            project: mockProject,
        };
        return typeof selector === 'function' ? selector(state) : state;
    }),
}));

vi.mock('@/core/context/ToastContext', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    },
}));

vi.mock('@/config/typesafeJudgments', () => ({
    judgeVideoChunkQuality: vi.fn(async (input) => {
        if (input.averageMotionScore > 60) {
            return {
                classification: 'DISCARD_SHAKY',
                usableScore: 1,
                isKeep: false,
                reason: 'Excessive camera shake',
            };
        }
        return {
            classification: 'KEEP_LEAD_TAKE',
            usableScore: 5,
            isKeep: true,
            reason: 'Prime performance take',
        };
    }),
}));

describe('VideoChunkSlicerCard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders slicer card with initial placeholder state', () => {
        render(<VideoChunkSlicerCard videoDurationSeconds={20} />);
        expect(screen.getByText('Jev Smart Slicer')).toBeInTheDocument();
        expect(screen.getByText('No slices generated yet')).toBeInTheDocument();
    });

    it('slices footage into chunks and displays keep/discard decisions', async () => {
        render(<VideoChunkSlicerCard videoDurationSeconds={15} />);

        const sliceButton = screen.getByTestId('run-slicer-btn');
        fireEvent.click(sliceButton);

        await waitFor(() => {
            expect(screen.getByText(/Gold Takes/)).toBeInTheDocument();
        });

        // Check that chunks are rendered
        expect(screen.getByText('0s – 5s')).toBeInTheDocument();
        expect(screen.getByText('5s – 10s')).toBeInTheDocument();
    });

    it('adds approved gold takes to video timeline when clicked', async () => {
        render(<VideoChunkSlicerCard videoDurationSeconds={25} />);

        // Run slicer
        fireEvent.click(screen.getByTestId('run-slicer-btn'));

        await waitFor(() => {
            expect(screen.getByTestId('apply-gold-takes-btn')).toBeInTheDocument();
        });

        // Click Add to Timeline
        fireEvent.click(screen.getByTestId('apply-gold-takes-btn'));

        expect(mockAddClip).toHaveBeenCalled();
        expect(mockAddClip).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'video',
                trackId: 'track_v1',
            })
        );
    });
});
