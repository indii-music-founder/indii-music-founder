/**
 * PWA Install Prompt Test Suite
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PWAInstallPrompt } from './PWAInstallPrompt';
import * as mobileUtils from '@/lib/mobile';

// Mock the mobile utilities
vi.mock('@/lib/mobile', () => ({
    initPWAInstall: vi.fn(),
    showPWAInstall: vi.fn(),
    canInstallPWA: vi.fn(),
    isStandalone: vi.fn(),
    haptic: vi.fn(),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('PWAInstallPrompt', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('should not render if already in standalone mode', () => {
        vi.mocked(mobileUtils.isStandalone).mockReturnValue(true);
        vi.mocked(mobileUtils.canInstallPWA).mockReturnValue(true);

        const { container } = render(<PWAInstallPrompt />);
        expect(container.firstChild).toBeNull();
    });

    it('should not render if cannot install', () => {
        vi.mocked(mobileUtils.isStandalone).mockReturnValue(false);
        vi.mocked(mobileUtils.canInstallPWA).mockReturnValue(false);

        const { container } = render(<PWAInstallPrompt />);
        expect(container.firstChild).toBeNull();
    });

    it('should not render if dismissed within 7 days', () => {
        const sevenDaysAgo = Date.now() - (6 * 24 * 60 * 60 * 1000); // 6 days ago
        localStorage.setItem('pwa-install-dismissed', sevenDaysAgo.toString());

        vi.mocked(mobileUtils.isStandalone).mockReturnValue(false);
        vi.mocked(mobileUtils.canInstallPWA).mockReturnValue(true);

        const { container } = render(<PWAInstallPrompt />);
        expect(container.firstChild).toBeNull();
    });

    it('should render if can install and not dismissed', async () => {
        vi.mocked(mobileUtils.isStandalone).mockReturnValue(false);
        vi.mocked(mobileUtils.canInstallPWA).mockReturnValue(true);

        render(<PWAInstallPrompt />);

        // Wait for the component to initialize
        await waitFor(() => {
            // Trigger the installable event
            window.dispatchEvent(new CustomEvent('pwa-installable'));
        });

        await waitFor(() => {
            expect(screen.queryByText('Install indiiOS')).toBeInTheDocument();
        });
    });

    it('should call showPWAInstall when install button is clicked', async () => {
        vi.mocked(mobileUtils.isStandalone).mockReturnValue(false);
        vi.mocked(mobileUtils.canInstallPWA).mockReturnValue(true);
        vi.mocked(mobileUtils.showPWAInstall).mockResolvedValue(true);

        render(<PWAInstallPrompt />);

        // Trigger installable event
        window.dispatchEvent(new CustomEvent('pwa-installable'));

        await waitFor(() => {
            expect(screen.getByText('Install Now')).toBeInTheDocument();
        });

        const installButton = screen.getByText('Install Now');
        fireEvent.click(installButton);

        await waitFor(() => {
            expect(mobileUtils.showPWAInstall).toHaveBeenCalled();
            expect(mobileUtils.haptic).toHaveBeenCalledWith('medium');
        });
    });

    it('should trigger success haptic when install is accepted', async () => {
        vi.mocked(mobileUtils.isStandalone).mockReturnValue(false);
        vi.mocked(mobileUtils.canInstallPWA).mockReturnValue(true);
        vi.mocked(mobileUtils.showPWAInstall).mockResolvedValue(true); // User accepted

        render(<PWAInstallPrompt />);

        // Trigger installable event
        window.dispatchEvent(new CustomEvent('pwa-installable'));

        await waitFor(() => {
            const installButton = screen.getByText('Install Now');
            fireEvent.click(installButton);
        });

        await waitFor(() => {
            expect(mobileUtils.haptic).toHaveBeenCalledWith('success');
        });
    });

    it('should dismiss and save to localStorage when dismiss button is clicked', async () => {
        vi.mocked(mobileUtils.isStandalone).mockReturnValue(false);
        vi.mocked(mobileUtils.canInstallPWA).mockReturnValue(true);

        render(<PWAInstallPrompt />);

        // Trigger installable event
        window.dispatchEvent(new CustomEvent('pwa-installable'));

        await waitFor(() => {
            const dismissButton = screen.getByLabelText('Dismiss');
            fireEvent.click(dismissButton);
        });

        expect(mobileUtils.haptic).toHaveBeenCalledWith('light');
        expect(localStorage.getItem('pwa-install-dismissed')).toBeTruthy();
    });

    it('should initialize PWA install on mount', () => {
        vi.mocked(mobileUtils.isStandalone).mockReturnValue(false);

        render(<PWAInstallPrompt />);

        expect(mobileUtils.initPWAInstall).toHaveBeenCalled();
    });
});
