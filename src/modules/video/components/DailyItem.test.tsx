import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DailyItem } from './DailyItem';
import { HistoryItem } from '@/core/store/slices/creativeSlice';

const mockVideo: HistoryItem = {
    id: '123',
    url: 'test-video.mp4',
    prompt: 'A cool video scene',
    type: 'video',
    timestamp: Date.now(),
    projectId: 'proj-1'
};

describe('DailyItem', () => {
    it('renders correctly', () => {
        const { container } = render(
            <DailyItem
                video={mockVideo}
                isSelected={false}
                onSelect={vi.fn()}
                onDragStart={vi.fn()}
            />
        );
        // Should have a video element
        const video = container.querySelector('video');
        expect(video).toBeTruthy();
        expect(video).toHaveAttribute('src', 'test-video.mp4');
    });

    it('is accessible via keyboard', () => {
        const onSelectMock = vi.fn();
        render(
            <DailyItem
                video={mockVideo}
                isSelected={false}
                onSelect={onSelectMock}
                onDragStart={vi.fn()}
            />
        );

        const item = screen.getByRole('button');

        // Verify accessible attributes
        expect(item).toHaveAttribute('tabIndex', '0');
        expect(item).toHaveAttribute('aria-label', `Select video: ${mockVideo.prompt}, Duration: 4 seconds`);

        // Verify keyboard interaction
        fireEvent.keyDown(item, { key: 'Enter' });
        expect(onSelectMock).toHaveBeenCalledWith(mockVideo);

        fireEvent.keyDown(item, { key: ' ' });
        expect(onSelectMock).toHaveBeenCalledTimes(2);
    });
});
