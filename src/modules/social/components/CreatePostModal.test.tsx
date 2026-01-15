import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import CreatePostModal from './CreatePostModal';

// Extend expect with jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock useToast
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
        loading: vi.fn(),
        dismiss: vi.fn(),
    }),
}));

// Mock BrandAssetsDrawer to avoid testing its internal a11y issues here
vi.mock('../../creative/components/BrandAssetsDrawer', () => ({
    default: () => <div data-testid="brand-assets-drawer">Brand Assets Drawer</div>,
}));

describe('CreatePostModal Accessibility', () => {
    const mockOnClose = vi.fn();
    const mockOnSave = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should have no accessibility violations', async () => {
        const { container } = render(
            <CreatePostModal onClose={mockOnClose} onSave={mockOnSave} />
        );

        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });

    it('should use semantic structure for dialog', () => {
        const { getByRole } = render(
            <CreatePostModal onClose={mockOnClose} onSave={mockOnSave} />
        );

        // This will likely fail initially
        expect(getByRole('dialog')).toBeInTheDocument();
    });
});
