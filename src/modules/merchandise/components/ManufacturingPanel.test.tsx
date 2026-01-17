import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ManufacturingPanel from './ManufacturingPanel';
import { THEMES } from '@/modules/merchandise/themes';

// Mock MerchandiseService
const mockGetCatalog = vi.fn();

vi.mock('@/services/merchandise/MerchandiseService', () => ({
    MerchandiseService: {
        submitToProduction: vi.fn(),
        getCatalog: () => mockGetCatalog()
    }
}));

// Mock toast
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        info: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
        loading: vi.fn(),
    })
}));

describe('ManufacturingPanel Cost Calculation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('uses catalog price when available (e.g. "T-Shirt" matches "Standard Tee")', async () => {
        mockGetCatalog.mockResolvedValue([
            { id: '1', title: 'Standard Tee', basePrice: 24.99, category: 'standard', image: 'https://example.com/image.png' }
            { id: '1', title: 'Standard Tee', basePrice: 24.99, category: 'standard', image: 'https://example.com/tee.jpg' }
        ]);

        render(
            <ManufacturingPanel
                theme={THEMES.pro}
                productType="T-Shirt"
            />
        );

        // Catalog price 24.99.
        // Default quantity 100. Discount logic: Math.floor(100/50)*0.05 = 0.10 (10%).
        // 24.99 * (1 - 0.10) = 22.491 -> 22.49

        await waitFor(() => {
            expect(screen.getByText('$22.49')).toBeInTheDocument();
        });
    });

    it('falls back to BASE_COSTS if catalog match fails', async () => {
        mockGetCatalog.mockResolvedValue([]);

        render(
            <ManufacturingPanel
                theme={THEMES.pro}
                productType="T-Shirt"
            />
        );

        // BASE_COST 12.50
        // Discount 10%
        // 12.50 * 0.9 = 11.25

        await waitFor(() => {
            expect(screen.getByText('$11.25')).toBeInTheDocument();
        });
    });
});
