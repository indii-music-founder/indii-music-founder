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

    it('renders empty footage state when no video duration is provided and disables slicing', () => {
        render(<VideoChunkSlicerCard />);
        expect(screen.getByTestId('no-footage-state')).toBeInTheDocument();
        expect(screen.getByText('No video footage selected')).toBeInTheDocument();
        const sliceButton = screen.getByTestId('run-slicer-btn');
        expect(sliceButton).toBeDisabled();
    });

    it('slices footage into clean timeline segments when frameMetrics are absent', async () => {
        render(<VideoChunkSlicerCard videoDurationSeconds={15} />);

        const sliceButton = screen.getByTestId('run-slicer-btn');
        expect(sliceButton).not.toBeDisabled();
        fireEvent.click(sliceButton);

        await waitFor(() => {
            expect(screen.getByTestId('apply-gold-takes-btn')).toBeInTheDocument();
        });

        // Verifies 3 segments (0-5s, 5-10s, 10-15s) with manual review label
        expect(screen.getByText('0s – 5s')).toBeInTheDocument();
        expect(screen.getByText('5s – 10s')).toBeInTheDocument();
        expect(screen.getByText('10s – 15s')).toBeInTheDocument();
        expect(screen.getAllByText(/ready for timeline placement/i).length).toBe(3);
    });

    it('slices footage and processes keep/discard decisions when frameMetrics are provided', async () => {
        const frameMetrics = [
            { motionScore: 20, brightnessScore: 85, hasSubject: true, audioRms: 0.4 }, // keep
            { motionScore: 85, brightnessScore: 30, hasSubject: false, audioRms: 0.1 }, // discard shaky
        ];

        render(<VideoChunkSlicerCard videoDurationSeconds={10} frameMetrics={frameMetrics} />);

        fireEvent.click(screen.getByTestId('run-slicer-btn'));

        await waitFor(() => {
            expect(screen.getByText('Lead Performance')).toBeInTheDocument();
            expect(screen.getByText('Camera Shake')).toBeInTheDocument();
        });

        expect(screen.getByText('Prime performance take')).toBeInTheDocument();
        expect(screen.getByText('Excessive camera shake')).toBeInTheDocument();
    });

    it('adds approved takes to video timeline when clicked', async () => {
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
