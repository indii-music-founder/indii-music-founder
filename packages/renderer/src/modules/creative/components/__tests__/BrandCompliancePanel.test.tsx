import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BrandCompliancePanel from '../BrandCompliancePanel';
import { scanAsset } from '@/services/brand/BrandComplianceService';
import { useStore } from '@/core/store';

vi.mock('@/services/brand/BrandComplianceService', () => ({
    DEFAULT_COMPLIANCE_CONFIG: {
        colorToleranceDeltaE: 12,
        colorCoverageMinPct: 8,
        requireLogo: false,
        logoSafeZonePct: 5,
        passScore: 85,
        enableAestheticCheck: true,
    },
    scanAsset: vi.fn(),
}));

vi.mock('@/services/storage/resolveStorageUrl', () => ({
    resolveStorageUrl: vi.fn((url: string) => Promise.resolve(url)),
}));

vi.mock('@/core/store', () => {
    const mockState = {
        selectedItem: { id: 'img_test_1', type: 'image', url: 'https://storage.indii.music/artwork.png' },
        userProfile: {
            brandKit: {
                colors: ['#000000', '#ffffff', '#ff0055'],
                fonts: 'Inter',
                brandDescription: 'Indie rock artist',
            },
        },
    };
    return {
        useStore: vi.fn((selector) => selector(mockState)),
    };
});

describe('BrandCompliancePanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders initial state with Brand Kit targets', () => {
        render(<BrandCompliancePanel />);
        expect(screen.getByTestId('brand-compliance-panel')).toBeInTheDocument();
        expect(screen.getByText('Brand Compliance Protocols')).toBeInTheDocument();
        expect(screen.getByTestId('scan-compliance-btn')).toBeInTheDocument();
    });

    it('runs scan and displays passing scorecard when compliant', async () => {
        (scanAsset as ReturnType<typeof vi.fn>).mockResolvedValue({
            assetId: 'artwork.png',
            assetUrl: 'https://storage.indii.music/artwork.png',
            passed: true,
            score: 95,
            violations: [],
            engine: 'hybrid',
            brandKitVersion: 'v1',
            scannedAt: Date.now(),
        });

        render(<BrandCompliancePanel />);
        const scanBtn = screen.getByTestId('scan-compliance-btn');
        fireEvent.click(scanBtn);

        await waitFor(() => {
            expect(scanAsset).toHaveBeenCalled();
        });

        await waitFor(() => {
            expect(screen.getByTestId('compliance-report-section')).toBeInTheDocument();
        });
        expect(screen.getByTestId('compliance-score-readout')).toHaveTextContent('95 / 100');
        expect(screen.getByText('Passed Gate')).toBeInTheDocument();
        expect(screen.getByText(/Zero brand deviations detected/i)).toBeInTheDocument();
    });

    it('displays violations and override gate when non-compliant', async () => {
        (scanAsset as ReturnType<typeof vi.fn>).mockResolvedValue({
            assetId: 'artwork.png',
            assetUrl: 'https://storage.indii.music/artwork.png',
            passed: false,
            score: 70,
            violations: [
                {
                    type: 'color',
                    severity: 'error',
                    detail: 'Dominant color #00ff00 deviates from brand palette',
                    evidence: { deltaE: 42.5, foundHex: '#00ff00', nearestBrandHex: '#000000' },
                },
            ],
            engine: 'hybrid',
            brandKitVersion: 'v1',
            scannedAt: Date.now(),
        });

        render(<BrandCompliancePanel />);
        fireEvent.click(screen.getByTestId('scan-compliance-btn'));

        await waitFor(() => {
            expect(screen.getByTestId('compliance-report-section')).toBeInTheDocument();
        });
        expect(screen.getByTestId('compliance-score-readout')).toHaveTextContent('70 / 100');
        expect(screen.getByText('Non-Compliant')).toBeInTheDocument();
        expect(screen.getByTestId('override-gate-container')).toBeInTheDocument();

        // Apply override
        const overrideInput = screen.getByTestId('compliance-override-input');
        fireEvent.change(overrideInput, { target: { value: 'Approved for special campaign' } });
        fireEvent.click(screen.getByTestId('apply-override-btn'));

        await waitFor(() => {
            expect(screen.getByText('Authorized Override')).toBeInTheDocument();
        });
    });
});
