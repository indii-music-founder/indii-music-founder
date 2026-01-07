import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { DailyItem } from './DailyItem';
import { HistoryItem } from '@/core/store/slices/creativeSlice';

expect.extend(toHaveNoViolations);

const mockVideo: HistoryItem = {
    id: '123',
    url: 'test-video.mp4',
    prompt: 'A cool video scene',
    type: 'video',
    timestamp: Date.now(),
    projectId: 'proj-1'
};

describe('Access: DailyItem Accessibility', () => {
    it('is compliant with WCAG standards (axe-core)', async () => {
        const { container } = render(
            <DailyItem
                video={mockVideo}
                isSelected={false}
                onSelect={vi.fn()}
                onDragStart={vi.fn()}
            />
        );

        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });

    it('has logical focus state and keyboard operability', () => {
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

        // Check explicit attributes
        expect(item).toHaveAttribute('tabIndex', '0');
        expect(item).toHaveAttribute('aria-label', `Select video: ${mockVideo.prompt}`);

        // Verify focus handling
        item.focus();
        expect(item).toHaveFocus();

        // Verify interaction keys
        fireEvent.keyDown(item, { key: 'Enter' });
        expect(onSelectMock).toHaveBeenCalledTimes(1);

        fireEvent.keyDown(item, { key: ' ' });
        expect(onSelectMock).toHaveBeenCalledTimes(2);
    });

    it('provides descriptive labels for screen readers', () => {
        render(
            <DailyItem
                video={{ ...mockVideo, prompt: '' }} // Empty prompt case
                isSelected={false}
                onSelect={vi.fn()}
                onDragStart={vi.fn()}
            />
        );

        const item = screen.getByRole('button');
        // Falls back to "Untitled video"
        expect(item).toHaveAttribute('aria-label', 'Select video: Untitled video');
    });

    it('announces selection state via aria-pressed', () => {
        // Verify 'false' state
        const { rerender } = render(
            <DailyItem
                video={mockVideo}
                isSelected={false}
                onSelect={vi.fn()}
                onDragStart={vi.fn()}
            />
        );
        let item = screen.getByRole('button');
        expect(item).toHaveAttribute('aria-pressed', 'false');

        // Verify 'true' state
        rerender(
            <DailyItem
                video={mockVideo}
                isSelected={true}
                onSelect={vi.fn()}
                onDragStart={vi.fn()}
            />
        );
        item = screen.getByRole('button');
        expect(item).toHaveAttribute('aria-pressed', 'true');
    });
});
