import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { useStore } from '@/core/store';
import { httpsCallable } from 'firebase/functions';
import FoundersPortal from './FoundersPortal';

// Mock Framer Motion
function filterDomProps(props: Record<string, unknown>): Record<string, unknown> {
    const invalid = ['initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap', 'layout'];
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props)) {
        if (!invalid.includes(key)) filtered[key] = value;
    }
    return filtered;
}

vi.mock('motion/react', () => ({
    motion: {
        div: React.forwardRef(({ children, ...p }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLDivElement>) => <div ref={ref} {...filterDomProps(p)}>{children}</div>),
    },
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

// Mock @/services/firebase
vi.mock('@/services/firebase', () => ({
    functions: {},
}));

// Mock founderFunnel tracking service
vi.mock('@/services/founders/founderFunnel', () => ({
    flushFounderFunnelQueue: vi.fn(),
    trackFounderFunnelEvent: vi.fn().mockResolvedValue(undefined),
}));

describe('FoundersPortal Component', () => {
    let mockSetModule: any;
    let mockHttpsCallableInstance: any;
    const originalLocation = window.location;

    beforeEach(() => {
        vi.clearAllMocks();
        mockSetModule = vi.fn();
        mockHttpsCallableInstance = vi.fn();
        vi.mocked(httpsCallable).mockReturnValue(mockHttpsCallableInstance);

        // Mock window.location.href writable
        delete (window as any).location;
        window.location = { href: '' } as any;

        // Default state mock in useStore
        (useStore as any).setState({
            userProfile: { id: 'user123', isFounder: true },
            setModule: mockSetModule,
        });
    });

    afterEach(() => {
        window.location = originalLocation as any;
    });

    it('renders access denied view if user is not a founder', () => {
        (useStore as any).setState({
            userProfile: { id: 'user123', isFounder: false },
        });

        render(<FoundersPortal />);
        expect(screen.getByText('Access Denied')).toBeInTheDocument();
        expect(screen.getByText(/Your account is not currently verified as a Founder/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Become a Founder' })).toBeInTheDocument();
    });

    it('navigates to checkout if non-founder clicks Become a Founder', () => {
        (useStore as any).setState({
            userProfile: { id: 'user123', isFounder: false },
        });

        render(<FoundersPortal />);
        fireEvent.click(screen.getByRole('button', { name: 'Become a Founder' }));
        expect(mockSetModule).toHaveBeenCalledWith('founders-checkout');
    });

    it('renders download portal if user has founder tier by subscriptionTier', () => {
        (useStore as any).setState({
            userProfile: { id: 'user123', subscriptionTier: 'founder' },
        });

        render(<FoundersPortal />);
        expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
        expect(screen.getByText('Download .dmg')).toBeInTheDocument();
        expect(screen.getByText('Download .exe')).toBeInTheDocument();
    });

    it('renders download portal if user has founder tier by tier', () => {
        (useStore as any).setState({
            userProfile: { id: 'user123', tier: 'founder' },
        });

        render(<FoundersPortal />);
        expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
    });

    it('invokes Cloud Function and triggers download for macOS (.dmg)', async () => {
        mockHttpsCallableInstance.mockResolvedValue({
            data: { success: true, url: 'https://storage.googleapis.com/download/indii-Installer.dmg' }
        });

        render(<FoundersPortal />);
        fireEvent.click(screen.getByRole('button', { name: 'Download .dmg' }));

        await waitFor(() => {
            expect(httpsCallable).toHaveBeenCalledWith(expect.any(Object), 'generateReleaseDownloadUrl');
            expect(mockHttpsCallableInstance).toHaveBeenCalledWith({ platform: 'mac' });
            expect(window.location.href).toBe('https://storage.googleapis.com/download/indii-Installer.dmg');
        });
    });

    it('invokes Cloud Function and triggers download for Windows (.exe)', async () => {
        mockHttpsCallableInstance.mockResolvedValue({
            data: { success: true, url: 'https://storage.googleapis.com/download/indii-Setup.exe' }
        });

        render(<FoundersPortal />);
        fireEvent.click(screen.getByRole('button', { name: 'Download .exe' }));

        await waitFor(() => {
            expect(mockHttpsCallableInstance).toHaveBeenCalledWith({ platform: 'windows' });
            expect(window.location.href).toBe('https://storage.googleapis.com/download/indii-Setup.exe');
        });
    });

    it('renders error message if download function returns failure', async () => {
        mockHttpsCallableInstance.mockResolvedValue({
            data: { success: false, message: 'Release file is missing.' }
        });

        render(<FoundersPortal />);
        fireEvent.click(screen.getByRole('button', { name: 'Download .dmg' }));

        await waitFor(() => {
            expect(screen.getByText('Release file is missing.')).toBeInTheDocument();
        });
    });
});
