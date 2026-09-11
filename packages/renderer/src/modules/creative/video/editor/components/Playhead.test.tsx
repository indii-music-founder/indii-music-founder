import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Playhead } from './Playhead';
import { useVideoEditorStore } from '../../store/videoEditorStore';
import { PIXELS_PER_FRAME, TRACK_HEADER_WIDTH } from '../constants';

vi.mock('../../store/videoEditorStore', () => ({
    useVideoEditorStore: vi.fn(),
}));

describe('Playhead', () => {
    type MockStoreState = {
        currentTime: number;
        timelineZoom: number;
    };

    const setMockStore = (state: Partial<MockStoreState>) => {
        const fullState: MockStoreState = {
            currentTime: 0,
            timelineZoom: 1,
            ...state,
        };
        (useVideoEditorStore as unknown as import('vitest').Mock).mockImplementation(
            (selector?: (s: MockStoreState) => unknown) => {
                return selector ? selector(fullState) : fullState;
            }
        );
    };

    beforeEach(() => {
        vi.clearAllMocks();
        setMockStore({ currentTime: 0, timelineZoom: 1 });
    });

    it('positions playhead at trackHeaderOffset (192px) when currentTime is 0 and zoom is 1', () => {
        render(<Playhead />);
        const playhead = screen.getByTestId('timeline-playhead');
        expect(playhead).toBeInTheDocument();
        expect(playhead.style.left).toBe(`${TRACK_HEADER_WIDTH}px`);
    });

    it('scales playhead position based on currentTime and timelineZoom', () => {
        // frame 30, zoom 1 -> 192 + (30 * 2 * 1) = 252px
        setMockStore({ currentTime: 30, timelineZoom: 1 });
        render(<Playhead />);
        const playhead = screen.getByTestId('timeline-playhead');
        expect(playhead.style.left).toBe(`${TRACK_HEADER_WIDTH + (30 * PIXELS_PER_FRAME * 1)}px`);
    });

    it('scales correctly when timelineZoom changes (0.5x, 2x, 4x)', () => {
        // Zoom 0.5x, frame 30 -> 192 + (30 * 2 * 0.5) = 192 + 30 = 222px
        setMockStore({ currentTime: 30, timelineZoom: 0.5 });
        const { unmount } = render(<Playhead />);
        expect(screen.getByTestId('timeline-playhead').style.left).toBe('222px');
        unmount();

        // Zoom 2x, frame 30 -> 192 + (30 * 2 * 2) = 192 + 120 = 312px
        setMockStore({ currentTime: 30, timelineZoom: 2 });
        const { unmount: unmount2 } = render(<Playhead />);
        expect(screen.getByTestId('timeline-playhead').style.left).toBe('312px');
        unmount2();

        // Zoom 4x, frame 30 -> 192 + (30 * 2 * 4) = 192 + 240 = 432px
        setMockStore({ currentTime: 30, timelineZoom: 4 });
        render(<Playhead />);
        expect(screen.getByTestId('timeline-playhead').style.left).toBe('432px');
    });

    it('honors custom trackHeaderOffset (e.g. 200px container-aligned offset)', () => {
        // Offset 200, frame 50, zoom 1 -> 200 + (50 * 2) = 300px
        setMockStore({ currentTime: 50, timelineZoom: 1 });
        render(<Playhead trackHeaderOffset={200} />);
        expect(screen.getByTestId('timeline-playhead').style.left).toBe('300px');
    });

    it('honors timelineZoom prop override when passed', () => {
        // Store has zoom 1, but prop zoom 3 -> 192 + (10 * 2 * 3) = 252px
        setMockStore({ currentTime: 10, timelineZoom: 1 });
        render(<Playhead timelineZoom={3} />);
        expect(screen.getByTestId('timeline-playhead').style.left).toBe('252px');
    });

    it('renders the visual playhead top handle', () => {
        render(<Playhead />);
        const handle = screen.getByTestId('timeline-playhead-handle');
        expect(handle).toBeInTheDocument();
        expect(handle).toHaveClass('rotate-45');
    });
});
