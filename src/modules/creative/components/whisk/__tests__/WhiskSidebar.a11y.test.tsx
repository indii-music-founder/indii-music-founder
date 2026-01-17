import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import WhiskSidebar from '../WhiskSidebar';
import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';
import React from 'react';

expect.extend(matchers);

// Mock dependencies
vi.mock('@/core/store');
vi.mock('@/core/context/ToastContext');
vi.mock('@/services/image/ImageGenerationService');
vi.mock('framer-motion', async () => {
    const actual = await vi.importActual('framer-motion');
    return {
        ...actual,
        AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
        motion: {
            div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
            button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
        }
    };
});

describe('WhiskSidebar Accessibility', () => {
    const mockAddWhiskItem = vi.fn();
    const mockRemoveWhiskItem = vi.fn();
    const mockToggleWhiskItem = vi.fn();
    const mockUpdateWhiskItem = vi.fn();
    const mockSetPreciseReference = vi.fn();
    const mockToastSuccess = vi.fn();
    const mockToastInfo = vi.fn();
    const mockToastWarning = vi.fn();
    const mockToastError = vi.fn();

    const mockWhiskState = {
        preciseReference: false,
        subjects: [{ id: '1', content: 'Robot', checked: true, type: 'text' }],
        scenes: [{ id: '2', content: 'City', checked: false, type: 'text' }],
        styles: []
    };

    beforeEach(() => {
        vi.clearAllMocks();

        (useToast as any).mockReturnValue({
            success: mockToastSuccess,
            info: mockToastInfo,
            warning: mockToastWarning,
            error: mockToastError
        });

        (useStore as any).mockReturnValue({
            whiskState: mockWhiskState,
            addWhiskItem: mockAddWhiskItem,
            removeWhiskItem: mockRemoveWhiskItem,
            toggleWhiskItem: mockToggleWhiskItem,
            updateWhiskItem: mockUpdateWhiskItem,
            setPreciseReference: mockSetPreciseReference
        });
    });

    it('should have no accessibility violations', async () => {
        const { container } = render(<WhiskSidebar />);
        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });

    it('buttons should have accessible names', async () => {
        const { container } = render(<WhiskSidebar />);

        // Check for buttons without text content or aria-label
        const buttons = container.querySelectorAll('button');
        buttons.forEach((button) => {
            // Check if button has visual text content
            const hasText = button.textContent?.trim().length! > 0;
            // Check if button has aria-label or aria-labelledby
            const hasAriaLabel = button.hasAttribute('aria-label') || button.hasAttribute('aria-labelledby');

            const hasAccessibleName = hasText || hasAriaLabel;

            if (!hasAccessibleName) {
                 // console.log('Button missing accessible name:', button.outerHTML);
            }

            expect(hasAccessibleName).toBeTruthy();
        });
    });
});
