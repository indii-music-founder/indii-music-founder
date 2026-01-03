import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LicensingDashboard from './LicensingDashboard';
import { useLicensing } from './hooks/useLicensing';
import { LicenseRequest } from '@/services/licensing/types';

// Mock the hook
vi.mock('./hooks/useLicensing');
vi.mock('@/core/store', () => ({
    useStore: () => ({
        currentModule: 'licensing',
    }),
}));
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        error: vi.fn(),
        success: vi.fn(),
        info: vi.fn(),
        promise: vi.fn((p) => p),
    }),
}));

const mockTimestamp = {
    toDate: () => new Date(),
    toLocaleDateString: () => new Date().toLocaleDateString(),
} as any;

const mockRequests: LicenseRequest[] = [
    {
        id: 'req1',
        title: 'Song A',
        artist: 'Artist A',
        usage: 'Film',
        status: 'checking',
        requestedAt: mockTimestamp,
        updatedAt: mockTimestamp,
    }
];

describe('LicensingDashboard', () => {
    it('renders loading state', () => {
        (useLicensing as any).mockReturnValue({
            licenses: [],
            requests: [],
            loading: true,
            actions: {}
        });

        render(<LicensingDashboard />);
        // Look for the spinner or loading indicator logic
        // The component renders a specific div structure for loading
        const spinner = screen.getByTestId('loading-spinner');
        expect(spinner).toBeInTheDocument();
    });

    it('renders dashboard content when loaded', () => {
        (useLicensing as any).mockReturnValue({
            licenses: [],
            requests: mockRequests,
            isLoading: false,
            actions: {
                draftAgreement: vi.fn(),
            }
        });

        render(<LicensingDashboard />);
        expect(screen.getByText('Licensing Department')).toBeInTheDocument();
        expect(screen.getByText('Song A')).toBeInTheDocument();
        expect(screen.getByText('Artist A')).toBeInTheDocument();
    });

    it('triggers draft action on button click', async () => {
        const initiateDraftingMock = vi.fn();
        (useLicensing as any).mockReturnValue({
            licenses: [],
            requests: mockRequests,
            isLoading: false,
            initiateDrafting: initiateDraftingMock
        });

        render(<LicensingDashboard />);

        const draftButton = screen.getByText('DRAFT AGREEMENT');
        fireEvent.click(draftButton);

        expect(initiateDraftingMock).toHaveBeenCalledWith(mockRequests[0]);
    });
});
