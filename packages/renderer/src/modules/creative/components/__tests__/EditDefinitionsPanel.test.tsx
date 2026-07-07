import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EditDefinitionsPanel from '../EditDefinitionsPanel';
import { STUDIO_COLORS } from '../../constants';

const mockUseStore = vi.fn();
const mockToast = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
};

vi.mock('@/core/store', () => ({
    useStore: (...args: any[]) => mockUseStore(...args),
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => mockToast,
}));

vi.mock('@/services/storage/safeStorageFetch', () => ({
    fetchAsBase64: vi.fn().mockResolvedValue({ base64: 'brand-b64', mimeType: 'image/png' }),
}));

vi.mock('@/utils/logger', () => ({
    logger: {
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
    },
}));

describe('EditDefinitionsPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseStore.mockImplementation((selector: any) =>
            selector({
                userProfile: {
                    brandKit: {
                        brandAssets: [
                            {
                                id: 'brand-1',
                                url: 'https://example.com/brand.png',
                                description: 'Brand Hero',
                                category: 'headshot',
                            },
                        ],
                        referenceImages: [],
                    },
                },
            })
        );
    });

    it('lets users import a Brand HQ asset into a reference slot', async () => {
        const onUpdateReferenceImage = vi.fn();
        const activeColor = STUDIO_COLORS[0];

        render(
            <EditDefinitionsPanel
                isOpen
                onClose={vi.fn()}
                definitions={{}}
                onUpdateDefinition={vi.fn()}
                onUpdateReferenceImage={onUpdateReferenceImage}
            />
        );

        fireEvent.click(screen.getAllByRole('button', { name: /Brand HQ/i })[0]!);

        await waitFor(() => {
            expect(screen.getByLabelText('Select Brand HQ asset Brand Hero')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByLabelText('Select Brand HQ asset Brand Hero'));

        await waitFor(() => {
            expect(onUpdateReferenceImage).toHaveBeenCalledWith(activeColor.id, {
                mimeType: 'image/png',
                data: 'brand-b64',
            });
            expect(mockToast.success).toHaveBeenCalledWith('Brand HQ reference added.');
        });
    });
});
