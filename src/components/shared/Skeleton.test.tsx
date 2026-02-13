import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Skeleton, PostSkeleton, CardSkeleton } from './Skeleton';

describe('Skeleton Component', () => {
    it('should render with default variant', () => {
        const { container } = render(<Skeleton />);
        const skeleton = container.firstChild;

        expect(skeleton).toBeInTheDocument();
        expect(skeleton).toHaveClass('animate-pulse');
    });

    it('should render with text variant', () => {
        const { container } = render(<Skeleton variant="text" />);
        const skeleton = container.firstChild;

        expect(skeleton).toBeInTheDocument();
        expect(skeleton).toHaveClass('h-4');
        expect(skeleton).toHaveClass('rounded');
    });

    it('should render with circular variant', () => {
        const { container } = render(<Skeleton variant="circular" />);
        const skeleton = container.firstChild;

        expect(skeleton).toBeInTheDocument();
        expect(skeleton).toHaveClass('rounded-full');
    });

    it('should render with rectangular variant', () => {
        const { container } = render(<Skeleton variant="rectangular" />);
        const skeleton = container.firstChild;

        expect(skeleton).toBeInTheDocument();
        expect(skeleton).toHaveClass('rounded-xl');
    });

    it('should apply custom className', () => {
        const { container } = render(<Skeleton className="w-full h-32" />);
        const skeleton = container.firstChild;

        expect(skeleton).toHaveClass('w-full');
        expect(skeleton).toHaveClass('h-32');
    });

    it('should render with custom props', () => {
        const { container } = render(<Skeleton data-testid="custom-skeleton" />);

        expect(container.querySelector('[data-testid="custom-skeleton"]')).toBeInTheDocument();
    });
});

describe('PostSkeleton Component', () => {
    it('should render post skeleton structure', () => {
        const { container } = render(<PostSkeleton />);

        // Should have a container
        expect(container.firstChild).toBeInTheDocument();

        // Should have multiple skeleton elements
        const skeletons = container.querySelectorAll('.animate-pulse');
        expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should render avatar skeleton', () => {
        const { container } = render(<PostSkeleton />);

        // Check for circular avatar skeleton
        const circular = container.querySelector('.rounded-full');
        expect(circular).toBeInTheDocument();
    });

    it('should render content skeletons', () => {
        const { container } = render(<PostSkeleton />);

        // Check for multiple rectangular skeletons for content
        const skeletons = container.querySelectorAll('.animate-pulse');
        expect(skeletons.length).toBeGreaterThanOrEqual(3); // Avatar + content lines
    });
});

describe('CardSkeleton Component', () => {
    it('should render card skeleton structure', () => {
        const { container } = render(<CardSkeleton />);

        // Should have a container with card styling
        const card = container.firstChild;
        expect(card).toBeInTheDocument();
        expect(card).toHaveClass('bg-white/5');
        expect(card).toHaveClass('rounded-2xl');
    });

    it('should render header skeleton', () => {
        const { container } = render(<CardSkeleton />);

        // Check for multiple skeleton elements
        const skeletons = container.querySelectorAll('.animate-pulse');
        expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should render main content skeleton', () => {
        const { container } = render(<CardSkeleton />);

        // Should have skeleton elements
        const skeletons = container.querySelectorAll('.animate-pulse');
        expect(skeletons.length).toBeGreaterThanOrEqual(4); // Header, action button, content area, content lines
    });

    it('should have proper spacing', () => {
        const { container } = render(<CardSkeleton />);

        const card = container.firstChild;
        expect(card).toHaveClass('p-6');
        expect(card).toHaveClass('space-y-4');
    });
});