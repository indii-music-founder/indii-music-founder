/**
 * Mobile Integration Test Suite
 * Tests the complete mobile experience flow
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

describe('Mobile Experience Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Mobile Navigation', () => {
        it('should render primary navigation tabs', () => {
            render(<MobileNav />);

            expect(screen.getByLabelText('Home')).toBeInTheDocument();
            expect(screen.getByLabelText('Studio')).toBeInTheDocument();
            expect(screen.getByLabelText('Market')).toBeInTheDocument();
            expect(screen.getByLabelText('Brain')).toBeInTheDocument();
            expect(screen.getByLabelText('More')).toBeInTheDocument();
        });

        it('should trigger haptic feedback on tab press', () => {
            render(<MobileNav />);

            const homeTab = screen.getByLabelText('Home');
            fireEvent.click(homeTab);

            expect(mobileUtils.haptic).toHaveBeenCalledWith('light');
        });

        it('should change module on tab press', () => {
            render(<MobileNav />);

            const studioTab = screen.getByLabelText('Studio');
            fireEvent.click(studioTab);

            expect(mockSetModule).toHaveBeenCalledWith('creative');
        });

        it('should open overflow menu when More is pressed', async () => {
            render(<MobileNav />);

            const moreTab = screen.getByLabelText('More');
            fireEvent.click(moreTab);

            await waitFor(() => {
                expect(screen.getByText('More Features')).toBeInTheDocument();
            });
        });

        it('should show overflow tabs in menu', async () => {
            render(<MobileNav />);

            const moreTab = screen.getByLabelText('More');
            fireEvent.click(moreTab);

            await waitFor(() => {
                expect(screen.getByLabelText('Analysis')).toBeInTheDocument();
                expect(screen.getByLabelText('Flow')).toBeInTheDocument();
                expect(screen.getByLabelText('Legal')).toBeInTheDocument();
                expect(screen.getByLabelText('Publish')).toBeInTheDocument();
                expect(screen.getByLabelText('Finance')).toBeInTheDocument();
            });
        });

        it('should trigger medium haptic on overflow tab selection', async () => {
            render(<MobileNav />);

            const moreTab = screen.getByLabelText('More');
            fireEvent.click(moreTab);

            await waitFor(() => {
                const legalTab = screen.getByLabelText('Legal');
                fireEvent.click(legalTab);
            });

            expect(mobileUtils.haptic).toHaveBeenCalledWith('medium');
        });

        it('should close overflow menu on backdrop click', async () => {
            render(<MobileNav />);

            const moreTab = screen.getByLabelText('More');
            fireEvent.click(moreTab);

            await waitFor(() => {
                expect(screen.getByText('More Features')).toBeInTheDocument();
            });

            // Click backdrop
            const backdrop = screen.getByText('More Features').parentElement?.previousSibling;
            if (backdrop) {
                fireEvent.click(backdrop);
            }

            expect(mobileUtils.haptic).toHaveBeenCalledWith('light');
        });

        it('should close overflow menu with X button', async () => {
            render(<MobileNav />);

            const moreTab = screen.getByLabelText('More');
            fireEvent.click(moreTab);

            await waitFor(() => {
                const closeButton = screen.getByLabelText('Close menu');
                fireEvent.click(closeButton);
            });

            expect(mobileUtils.haptic).toHaveBeenCalledWith('light');
        });
    });

    describe('Touch Target Accessibility', () => {
        it('should have minimum 48px touch targets', () => {
            render(<MobileNav />);

            const tabs = screen.getAllByRole('button');
            tabs.forEach((tab) => {
                const styles = window.getComputedStyle(tab);
                // Check minimum dimensions (min-w-[64px] min-h-[48px])
                expect(tab.className).toMatch(/min-h-\[48px\]/);
            });
        });

        it('should have aria-labels for all tabs', () => {
            render(<MobileNav />);

            const primaryTabs = ['Home', 'Studio', 'Market', 'Brain', 'More'];
            primaryTabs.forEach((label) => {
                expect(screen.getByLabelText(label)).toBeInTheDocument();
            });
        });

        it('should indicate current page with aria-current', () => {
            render(<MobileNav />);

            const homeTab = screen.getByLabelText('Home');
            expect(homeTab).toHaveAttribute('aria-current', 'page');
        });
    });

    describe('Mobile Responsiveness', () => {
        it('should be hidden on desktop (md: breakpoint)', () => {
            render(<MobileNav />);

            const navContainer = screen.getByLabelText('Home').parentElement?.parentElement;
            expect(navContainer?.className).toMatch(/md:hidden/);
        });

        it('should have proper z-index for overlay', () => {
            render(<MobileNav />);

            const navContainer = screen.getByLabelText('Home').parentElement?.parentElement;
            expect(navContainer?.className).toMatch(/z-50/);
        });

        it('should have safe area padding', () => {
            render(<MobileNav />);

            const navContainer = screen.getByLabelText('Home').parentElement?.parentElement;
            expect(navContainer?.className).toMatch(/pb-safe|mobile-safe-bottom/);
        });
    });
});
