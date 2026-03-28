import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthorityPanel } from '../AuthorityPanel';
import { distributionService } from '@/services/distribution/DistributionService';
import { DistributionSyncService } from '@/services/distribution/DistributionSyncService';

// Mock dependencies
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
    }),
}));

vi.mock('@/services/distribution/DistributionService', () => ({
    distributionService: {
        assignISRCs: vi.fn(),
        generateUPC: vi.fn(),
        generateDDEX: vi.fn(),
    },
}));

vi.mock('@/services/distribution/DistributionSyncService', () => ({
    DistributionSyncService: {
        getRelease: vi.fn(),
    },
}));

const mockReleases = [
    { id: 'rel-1', title: 'Test Release', artist: 'Test Artist' }
];

vi.mock('@/core/store', () => ({
    useStore: (selector: any) => selector({
        distribution: {
            releases: mockReleases
        }
    })
}));

describe('AuthorityPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render release selector and generation buttons', () => {
        render(<AuthorityPanel />);
        expect(screen.getByTestId('authority-release-selector')).toBeDefined();
        expect(screen.getByTestId('authority-generate-isrc')).toBeDefined();
        expect(screen.getByTestId('authority-generate-upc')).toBeDefined();
        expect(screen.getByTestId('authority-generate-ddex')).toBeDefined();
    });

    it('should generate ISRC when button is clicked', async () => {
        (distributionService.assignISRCs as any).mockResolvedValue('US-XXX-25-00001');
        render(<AuthorityPanel />);

        fireEvent.click(screen.getByTestId('authority-generate-isrc'));

        await waitFor(() => {
            expect(distributionService.assignISRCs).toHaveBeenCalled();
        });

        expect(screen.getByTestId('authority-isrc-display')).toHaveTextContent('US-XXX-25-00001');
    });

    it('should generate UPC when button is clicked', async () => {
        (distributionService.generateUPC as any).mockResolvedValue('123456789012');
        render(<AuthorityPanel />);

        fireEvent.click(screen.getByTestId('authority-generate-upc'));

        await waitFor(() => {
            expect(distributionService.generateUPC).toHaveBeenCalled();
        });

        expect(screen.getByTestId('authority-upc-display')).toHaveTextContent('123456789012');
    });

    it('should generate DDEX when release is selected and button is clicked', async () => {
        const mockReleaseData = {
            id: 'rel-1',
            metadata: {
                releaseTitle: 'Test Release',
                artistName: 'Test Artist',
                labelName: 'Test Label',
                upc: '123456789012',
                tracks: [{ trackTitle: 'Track 1', isrc: 'US-XXX-25-00001' }]
            }
        };
        (DistributionSyncService.getRelease as any).mockResolvedValue(mockReleaseData);
        (distributionService.generateDDEX as any).mockResolvedValue('<DDEX>XML Content</DDEX>');

        render(<AuthorityPanel />);

        // Select release
        fireEvent.change(screen.getByTestId('authority-release-selector'), { target: { value: 'rel-1' } });

        // Generate DDEX
        fireEvent.click(screen.getByTestId('authority-generate-ddex'));

        await waitFor(() => {
            expect(DistributionSyncService.getRelease).toHaveBeenCalledWith('rel-1');
            expect(distributionService.generateDDEX).toHaveBeenCalled();
        });

        expect(screen.getByTestId('authority-ddex-output')).toHaveTextContent('<DDEX>XML Content</DDEX>');
        expect(screen.getByTestId('authority-copy-ddex')).toBeDefined();
    });
});
