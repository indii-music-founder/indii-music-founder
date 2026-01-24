import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { DailiesStrip } from './DailiesStrip';
import { HistoryItem } from '@/core/store/slices/creativeSlice';

describe('DailiesStrip Interaction', () => {
    const mockOnSelect = vi.fn();
    const mockOnDragStart = vi.fn();

    const mockItems: HistoryItem[] = [
        { id: 'vid1', type: 'video', url: 'vid1.mp4', prompt: 'Video 1', timestamp: 100, projectId: 'test-project' },
        { id: 'img1', type: 'image', url: 'img1.png', prompt: 'Image 1', timestamp: 101, projectId: 'test-project' },
        { id: 'vid2', type: 'video', url: 'vid2.mp4', prompt: 'Video 2', timestamp: 102, projectId: 'test-project' },
    ];

    it('renders only video items', () => {
        render(
            <DailiesStrip
                items={mockItems}
                selectedId={null}
                onSelect={mockOnSelect}
                onDragStart={mockOnDragStart}
            />
        );

        // Should find vid1 and vid2
        expect(screen.getByTestId('daily-item-vid1')).toBeInTheDocument();
        expect(screen.getByTestId('daily-item-vid2')).toBeInTheDocument();

        // Should NOT find img1 (assumes filtering logic in component)
        expect(screen.queryByTestId('daily-item-img1')).not.toBeInTheDocument();

        // Header count
        expect(screen.getByText(/Dailies Bin \(2\)/)).toBeInTheDocument();
    });

    it('handles item selection', () => {
        render(
            <DailiesStrip
                items={mockItems}
                selectedId={null}
                onSelect={mockOnSelect}
                onDragStart={mockOnDragStart}
            />
        );

        const vid1 = screen.getByTestId('daily-item-vid1');
        fireEvent.click(vid1);

        expect(mockOnSelect).toHaveBeenCalledWith(mockItems[0]);
    });

    it('handles drag start', () => {
        render(
            <DailiesStrip
                items={mockItems}
                selectedId={null}
                onSelect={mockOnSelect}
                onDragStart={mockOnDragStart}
            />
        );

        const vid1 = screen.getByTestId('daily-item-vid1');

        // Simulate drag start
        fireEvent.dragStart(vid1);

        expect(mockOnDragStart).toHaveBeenCalledWith(expect.anything(), mockItems[0]);
    });

    it('applies selected style', () => {
        render(
            <DailiesStrip
                items={mockItems}
                selectedId='vid2'
                onSelect={mockOnSelect}
                onDragStart={mockOnDragStart}
            />
        );

        const vid2 = screen.getByTestId('daily-item-vid2');
        // Check for border-yellow-500 class or similar indicating selection
        expect(vid2.className).toContain('border-yellow-500');
    });
});
