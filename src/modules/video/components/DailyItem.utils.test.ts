import { describe, it, expect, vi } from 'vitest';
import { arePropsEqual, DailyItemProps } from './DailyItem.utils';
import { HistoryItem } from '@/core/store/slices/creativeSlice';
import React from 'react';

const mockVideo: HistoryItem = {
    id: 'vid-1',
    url: 'http://example.com/video.mp4',
    prompt: 'A video',
    type: 'video',
    timestamp: 1000,
    projectId: 'p1',
    orgId: 'o1'
};

const defaultProps: DailyItemProps = {
    video: mockVideo,
    isSelected: false,
    onSelect: vi.fn(),
    onDragStart: vi.fn(),
    duration: 4
};

describe('DailyItem.utils', () => {
    describe('arePropsEqual', () => {
        it('returns true when props are identical', () => {
            expect(arePropsEqual(defaultProps, defaultProps)).toBe(true);
        });

        it('returns true when video object is different reference but same content', () => {
            const nextProps = {
                ...defaultProps,
                video: { ...mockVideo } // New reference
            };
            expect(arePropsEqual(defaultProps, nextProps)).toBe(true);
        });

        it('returns false when video id changes', () => {
            const nextProps = {
                ...defaultProps,
                video: { ...mockVideo, id: 'vid-2' }
            };
            expect(arePropsEqual(defaultProps, nextProps)).toBe(false);
        });

        it('returns false when video url changes', () => {
            const nextProps = {
                ...defaultProps,
                video: { ...mockVideo, url: 'http://other.com' }
            };
            expect(arePropsEqual(defaultProps, nextProps)).toBe(false);
        });

        it('returns false when isSelected changes', () => {
            const nextProps = {
                ...defaultProps,
                isSelected: true
            };
            expect(arePropsEqual(defaultProps, nextProps)).toBe(false);
        });

        it('returns false when duration changes', () => {
            const nextProps = {
                ...defaultProps,
                duration: 10
            };
            expect(arePropsEqual(defaultProps, nextProps)).toBe(false);
        });

        it('returns false when onSelect callback changes', () => {
            const nextProps = {
                ...defaultProps,
                onSelect: vi.fn() // New function reference
            };
            expect(arePropsEqual(defaultProps, nextProps)).toBe(false);
        });
    });
});
