import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CampaignManager from './CampaignManager';
import { CampaignAsset, CampaignStatus } from '../types';

// Mock Toast
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    }),
}));

// Mock Firebase Functions
vi.mock('@/services/firebase', () => ({
    functions: {},
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: () => vi.fn().mockResolvedValue({
        data: {
            posts: [
                {
                    id: '1',
                    day: 1,
                    platform: 'Twitter',
                    copy: 'Test Post',
                    imageAsset: { id: 'img1', title: 'Image 1', imageUrl: 'http://example.com/img1.jpg' },
                    status: 'DONE',
                    postId: 'post_123'
                }
            ]
        }
    }),
}));

describe('CampaignManager', () => {
    const mockCampaign: CampaignAsset = {
        id: 'c1',
        title: 'Test Campaign',
        type: 'social_media',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        startDate: '2023-01-01',
        durationDays: 7,
        posts: [
            {
                id: '1',
                day: 1,
                platform: 'Twitter',
                copy: 'Test Post',
                imageAsset: { id: 'img1', title: 'Image 1', imageUrl: 'http://example.com/img1.jpg' },
                status: CampaignStatus.PENDING
            }
        ]
    };

    const mockOnUpdate = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders campaign details', () => {
        render(<CampaignManager campaign={mockCampaign} onUpdate={mockOnUpdate} />);
        expect(screen.getByText('Test Campaign')).toBeInTheDocument();
        expect(screen.getByText('Execute Campaign')).toBeInTheDocument();
    });

    it('executes campaign and updates posts', async () => {
        render(<CampaignManager campaign={mockCampaign} onUpdate={mockOnUpdate} />);

        const executeButton = screen.getByText('Execute Campaign');
        fireEvent.click(executeButton);

        expect(screen.getByText('Executing...')).toBeInTheDocument();

        await waitFor(() => {
            expect(mockOnUpdate).toHaveBeenCalledWith(expect.objectContaining({
                posts: expect.arrayContaining([
                    expect.objectContaining({
                        status: 'DONE',
                        postId: 'post_123'
                    })
                ])
            }));
        });
    });
});
