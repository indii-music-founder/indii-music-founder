import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TimelineTimecode } from './TimelineTimecode';
import { formatTimecode } from '../utils/timelineUtils';
import { useVideoEditorStore } from '../../store/videoEditorStore';


vi.mock('../../store/videoEditorStore', () => ({
    useVideoEditorStore: vi.fn(),
}));

describe('TimelineTimecode', () => {
    type MockStoreState = {
        currentTime: number;
        project: { fps: number };
    };

    const setMockStore = (state: Partial<MockStoreState>) => {
        const fullState: MockStoreState = {
            currentTime: 0,
            project: { fps: 30 },
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
        setMockStore({ currentTime: 0, project: { fps: 30 } });
    });

    describe('formatTimecode helper', () => {
        it('formats zero frames correctly as MM:SS:FF', () => {
            expect(formatTimecode(0, 30)).toBe('00:00:00');
        });

        it('formats frame 45 at 30fps as 1s 15f', () => {
            expect(formatTimecode(45, 30)).toBe('00:01:15');
        });

        it('formats frame 1800 at 30fps as 1 minute', () => {
            expect(formatTimecode(1800, 30)).toBe('01:00:00');
        });

        it('includes hours automatically when duration exceeds 1 hour', () => {
            // 3600 seconds * 30 fps = 108000 frames
            expect(formatTimecode(108000, 30)).toBe('01:00:00:00');
        });

        it('includes hours when showHours is explicitly true', () => {
            expect(formatTimecode(0, 30, true)).toBe('00:00:00:00');
            expect(formatTimecode(45, 30, true)).toBe('00:00:01:15');
        });

        it('handles non-standard frame rates (24fps, 60fps)', () => {
            expect(formatTimecode(24, 24)).toBe('00:01:00');
            expect(formatTimecode(36, 24)).toBe('00:01:12');
            expect(formatTimecode(60, 60)).toBe('00:01:00');
            expect(formatTimecode(90, 60)).toBe('00:01:30');
        });

        it('safely clamps negative or non-finite inputs', () => {
            expect(formatTimecode(-10, 30)).toBe('00:00:00');
            expect(formatTimecode(NaN, 30)).toBe('00:00:00');
            expect(formatTimecode(Infinity, 30)).toBe('00:00:00');
        });
    });

    describe('TimelineTimecode component', () => {
        it('renders live timecode from store at frame 0', () => {
            render(<TimelineTimecode />);
            const el = screen.getByTestId('timeline-timecode');
            expect(el).toBeInTheDocument();
            expect(el).toHaveTextContent('00:00:00');
        });

        it('updates dynamically when store currentTime advances', () => {
            setMockStore({ currentTime: 75, project: { fps: 30 } });
            render(<TimelineTimecode />);
            // 75 frames @ 30fps = 2 seconds + 15 frames -> 00:02:15
            expect(screen.getByTestId('timeline-timecode')).toHaveTextContent('00:02:15');
        });

        it('accepts explicit props to override store values', () => {
            render(<TimelineTimecode currentTime={90} fps={30} showHours={true} />);
            expect(screen.getByTestId('timeline-timecode')).toHaveTextContent('00:00:03:00');
        });

        it('applies custom className when provided', () => {
            render(<TimelineTimecode className="custom-tc-class" />);
            expect(screen.getByTestId('timeline-timecode')).toHaveClass('custom-tc-class');
        });
    });
});
