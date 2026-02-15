import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LicensingDashboard from './LicensingDashboard';
import { licensingService } from '@/services/licensing/LicensingService';
import { License } from '@/services/licensing/types';

// Mock the service dependencies
vi.mock('@/services/licensing/LicensingService', () => ({
    licensingService: {
        subscribeToActiveLicenses: vi.fn(),
        subscribeToPendingRequests: vi.fn(),
        getActiveLicenses: vi.fn().mockResolvedValue([]), // Called for seeding check
        updateRequestStatus: vi.fn(),
    }
}));

vi.mock('@/core/store', () => ({
    useStore: () => ({
        userProfile: { id: 'test-user' },
        currentModule: 'licensing',
    }),
}));

const mockToast = {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    promise: vi.fn((p) => p),
};

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => mockToast,
}));

describe('LicensingDashboard Pulse Check', () => {
    it('prevents Flash of Empty Content when one stream lags', async () => {
        let sendLicenses: (data: License[]) => void;
        let sendRequests: (data: any[]) => void;

        (licensingService.subscribeToActiveLicenses as any).mockImplementation((cb: any) => {
            sendLicenses = cb;
            return () => {};
        });

        (licensingService.subscribeToPendingRequests as any).mockImplementation((cb: any) => {
            sendRequests = cb;
            return () => {};
        });

        render(<LicensingDashboard />);

        // Initially loading (Global Spinner)
        expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

        // Wait for subscriptions to be called
        await waitFor(() => expect(licensingService.subscribeToActiveLicenses).toHaveBeenCalled());
        await waitFor(() => expect(licensingService.subscribeToPendingRequests).toHaveBeenCalled());

        // Simulate licenses arriving immediately
        const mockLicense = {
            id: '1',
            title: 'License A',
            artist: 'Artist A',
            licenseType: 'Exclusive',
            status: 'active',
            usage: 'Commercial'
        } as any;

        // Trigger the license update
        act(() => {
            sendLicenses([mockLicense]);
        });

        // At this point, requests are still loading (sendRequests NOT called).
        // CRITICAL CHECK: The dashboard should NOT show "No Pending Clearances" yet.
        // It should either still be showing the global spinner (if we wait for all)
        // OR it should show a skeleton/loading state for the Requests section.

        // Because the fix keeps "isLoading" true until BOTH return, we expect "loading-spinner" to STILL be there.
        expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

        // And we asserted that we do NOT see the empty state text.
        const emptyStateText = screen.queryByText('No Pending Clearances');
        expect(emptyStateText).not.toBeInTheDocument();

        // Now finish loading
        act(() => {
            sendRequests([]);
        });

        // Now loading should complete
        // Dashboard should be visible
        // Since requests are empty, NOW we see "No Pending Clearances"
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
        expect(screen.getByText('No Pending Clearances')).toBeInTheDocument();
    });
});
