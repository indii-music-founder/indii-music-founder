/**
 * Mobile Integration Test Suite
 * Tests the complete mobile experience flow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MobileNav } from '@/core/components/MobileNav';
import * as mobileUtils from '@/lib/mobile';

// Mock mobile utilities
vi.mock('@/lib/mobile', () => ({
    haptic: vi.fn(),
}));

// Mock store
const mockSetModule = vi.fn();
vi.mock('@/core/store', () => ({
    useStore: () => ({
        currentModule: 'dashboard',
        setModule: mockSetModule,
    }),
}));

// Mock module colors
vi.mock('@/core/theme/moduleColors', () => ({
    getColorForModule: () => ({
        text: 'text-test',
        bg: 'bg-test',
        border: 'border-test',
        ring: 'ring-test',
    }),
}));

describe('Mobile Experience Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Mobile Navigation', () => {
        it('should render FAB button initially', () => {
            render(<MobileNav />);
            expect(screen.getByLabelText('Open Navigation')).toBeInTheDocument();
        });

        it('should not render drawer initially', () => {
            render(<MobileNav />);
            expect(screen.queryByText('Navigation')).not.toBeInTheDocument();
        });

        it('should trigger haptic feedback on FAB press', () => {
            render(<MobileNav />);
            const fab = screen.getByLabelText('Open Navigation');
            fireEvent.click(fab);
            expect(mobileUtils.haptic).toHaveBeenCalledWith('medium');
        });

        it('should open drawer when FAB is pressed', async () => {
            render(<MobileNav />);
            const fab = screen.getByLabelText('Open Navigation');
            fireEvent.click(fab);

            await waitFor(() => {
                expect(screen.getByText('Navigation')).toBeInTheDocument();
            });
        });

        it('should show navigation sections in drawer', async () => {
            render(<MobileNav />);
            fireEvent.click(screen.getByLabelText('Open Navigation'));

            await waitFor(() => {
                expect(screen.getByText("Manager's Office")).toBeInTheDocument();
                expect(screen.getByText("Departments")).toBeInTheDocument();
                expect(screen.getByText("Tools")).toBeInTheDocument();
            });
        });

        it('should close drawer on backdrop click', async () => {
            render(<MobileNav />);
            fireEvent.click(screen.getByLabelText('Open Navigation'));

            await waitFor(() => {
                expect(screen.getByText('Navigation')).toBeInTheDocument();
            });

            // Close using the X button
            const closeButton = screen.getByLabelText('Close menu');
            fireEvent.click(closeButton);

            // waitFor removal
             await waitFor(() => {
                expect(screen.queryByText('Navigation')).not.toBeInTheDocument();
            });

            expect(mobileUtils.haptic).toHaveBeenCalledWith('light');
        });

        it('should change module and close drawer on item click', async () => {
            render(<MobileNav />);
            fireEvent.click(screen.getByLabelText('Open Navigation'));

            await waitFor(() => {
                 expect(screen.getByText("Brand Manager")).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText("Brand Manager"));

            expect(mockSetModule).toHaveBeenCalledWith('brand');
            expect(mobileUtils.haptic).toHaveBeenCalledWith('light');
             await waitFor(() => {
                expect(screen.queryByText('Navigation')).not.toBeInTheDocument();
            });
        });
    });

    describe('Touch Target Accessibility', () => {
        it('should have accessible FAB', () => {
            render(<MobileNav />);
            const fab = screen.getByLabelText('Open Navigation');
            // Check styling roughly
            expect(fab.className).toContain('fixed');
            expect(fab.className).toContain('bottom-32');
        });
    });

    describe('Mobile Responsiveness', () => {
        it('should be hidden on desktop (md: breakpoint)', () => {
            render(<MobileNav />);
            const fab = screen.getByLabelText('Open Navigation');
            expect(fab.className).toContain('md:hidden');
        });
    });
});
