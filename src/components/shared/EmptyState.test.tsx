import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EmptyState } from './EmptyState';
import { Sparkles } from 'lucide-react';

describe('EmptyState Component', () => {
    it('should render with title and description', () => {
        render(
            <EmptyState
                icon={Sparkles}
                title="No items found"
                description="Start by creating your first item"
            />
        );

        expect(screen.getByText('No items found')).toBeInTheDocument();
        expect(screen.getByText('Start by creating your first item')).toBeInTheDocument();
    });

    it('should render with action button', () => {
        const mockOnClick = vi.fn();
        render(
            <EmptyState
                icon={Sparkles}
                title="No items found"
                description="Start by creating your first item"
                action={{
                    label: 'Create Item',
                    onClick: mockOnClick
                }}
            />
        );

        const button = screen.getByRole('button', { name: 'Create Item' });
        expect(button).toBeInTheDocument();

        fireEvent.click(button);
        expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should render without action button', () => {
        render(
            <EmptyState
                icon={Sparkles}
                title="No items found"
                description="Start by creating your first item"
            />
        );

        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('should render minimal variant', () => {
        render(
            <EmptyState
                icon={Sparkles}
                title="No items found"
                description="Start by creating your first item"
                variant="minimal"
            />
        );

        expect(screen.getByText('No items found')).toBeInTheDocument();
        expect(screen.getByText('Start by creating your first item')).toBeInTheDocument();
    });

    it('should render minimal variant with action', () => {
        const mockOnClick = vi.fn();
        render(
            <EmptyState
                icon={Sparkles}
                title="No items found"
                description="Start by creating your first item"
                variant="minimal"
                action={{
                    label: 'Create Item',
                    onClick: mockOnClick
                }}
            />
        );

        const button = screen.getByRole('button', { name: 'Create Item' });
        fireEvent.click(button);
        expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should render icon', () => {
        const { container } = render(
            <EmptyState
                icon={Sparkles}
                title="No items found"
                description="Start by creating your first item"
            />
        );

        const icon = container.querySelector('[data-testid^="icon-"]');
        expect(icon).toBeInTheDocument();
    });

    it('should handle long descriptions', () => {
        const longDescription = 'This is a very long description that should still render correctly without breaking the layout or causing any issues';
        render(
            <EmptyState
                icon={Sparkles}
                title="No items found"
                description={longDescription}
            />
        );

        expect(screen.getByText(longDescription)).toBeInTheDocument();
    });
});