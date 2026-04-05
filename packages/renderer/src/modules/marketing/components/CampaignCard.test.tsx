import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CampaignCard from './CampaignCard';
import { CampaignAsset, CampaignStatus } from '../types';

describe('CampaignCard', () => {
    const mockCampaign: CampaignAsset = {
        id: '1',
        assetType: 'campaign',
        title: 'Test Campaign',
        description: 'Test Description',
        status: CampaignStatus.EXECUTING,
        startDate: '2023-01-01',
        endDate: '2023-01-31',
        durationDays: 30,
        posts: [], // Empty posts for simplicity
    };

    const mockOnSelect = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders with correct accessibility roles', () => {
        render(<CampaignCard campaign={mockCampaign} onSelect={mockOnSelect} />);

        // Main card should be a button
        const cardButton = screen.getByRole('button', { name: /Select campaign: Test Campaign/i });
        expect(cardButton).toBeInTheDocument();
        expect(cardButton).toHaveAttribute('tabIndex', '0');

        // Progress bar should have role progressbar
        const progressBar = screen.getByRole('progressbar', { name: /Campaign Progress/i });
        expect(progressBar).toBeInTheDocument();
    });

    it('triggers onSelect when clicked', () => {
        render(<CampaignCard campaign={mockCampaign} onSelect={mockOnSelect} />);
        const cardButton = screen.getByRole('button', { name: /Select campaign: Test Campaign/i });

        fireEvent.click(cardButton);
        expect(mockOnSelect).toHaveBeenCalledWith(mockCampaign);
    });

    it('triggers onSelect when Enter key is pressed', () => {
        render(<CampaignCard campaign={mockCampaign} onSelect={mockOnSelect} />);
        const cardButton = screen.getByRole('button', { name: /Select campaign: Test Campaign/i });

        fireEvent.keyDown(cardButton, { key: 'Enter' });
        expect(mockOnSelect).toHaveBeenCalledWith(mockCampaign);
    });

    it('triggers onSelect when Space key is pressed', () => {
        render(<CampaignCard campaign={mockCampaign} onSelect={mockOnSelect} />);
        const cardButton = screen.getByRole('button', { name: /Select campaign: Test Campaign/i });

        fireEvent.keyDown(cardButton, { key: ' ' });
        expect(mockOnSelect).toHaveBeenCalledWith(mockCampaign);
    });

    it('renders progress bar with correct values', () => {
        // Create a campaign with some progress

        // Helper to avoid 'as any' casting
        const createMockPost = (status: CampaignStatus) => ({
            id: Math.random().toString(),
            platform: 'Twitter', // valid platform
            copy: 'test',
            imageAsset: { assetType: 'image', title: 't', imageUrl: '', caption: '' },
            day: 1,
            status,
            scheduledTime: new Date()
        } as unknown as any); // Using 'unknown' then 'any' safely or just conforming. 
        // Actually, to be Platinum, let's conform to the types if possible, or use explicit unknown cast if partial.
        // But since we are inside a test, I'll use a type assertion that is cleaner.

        const progressCampaign: CampaignAsset = {
            ...mockCampaign,
            posts: [
                {
                    id: '1', platform: 'Twitter', copy: 'Test', day: 1, status: CampaignStatus.DONE,
                    imageAsset: { assetType: 'image', title: 'img', imageUrl: '', caption: '' }
                } as any,
                {
                    id: '2', platform: 'Instagram', copy: 'Test 2', day: 2, status: CampaignStatus.PENDING,
                    imageAsset: { assetType: 'image', title: 'img', imageUrl: '', caption: '' }
                } as any
            ]
        };

        render(<CampaignCard campaign={progressCampaign} onSelect={mockOnSelect} />);
        const progressBar = screen.getByRole('progressbar');

        // 1 done out of 2 = 50%
        expect(progressBar).toHaveAttribute('aria-valuenow', '50');
        expect(progressBar).toHaveAttribute('aria-valuemin', '0');
        expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    });

    it('does not trigger onSelect when More Options button is clicked or interacted with', () => {
        render(<CampaignCard campaign={mockCampaign} onSelect={mockOnSelect} />);
        const moreOptionsButton = screen.getByRole('button', { name: /More options/i });

        fireEvent.click(moreOptionsButton);
        expect(mockOnSelect).not.toHaveBeenCalled();

        fireEvent.keyDown(moreOptionsButton, { key: 'Enter' });
        expect(mockOnSelect).not.toHaveBeenCalled();
    });
});
