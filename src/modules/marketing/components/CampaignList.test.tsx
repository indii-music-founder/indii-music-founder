import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import CampaignList from './CampaignList';
import { CampaignAsset, CampaignStatus } from '../types';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, onClick }: any) => (
            <div className={className} onClick={onClick}>
                {children}
            </div>
        )
    }
}));

// Mock CampaignCard since it's used inside CampaignList
vi.mock('./CampaignCard', () => ({
    default: ({ campaign, onSelect }: any) => (
        <div data-testid="campaign-card" onClick={() => onSelect(campaign)}>
            {campaign.title}
        </div>
    )
}));

describe('CampaignList', () => {
    const mockCampaigns: CampaignAsset[] = [
        {
            id: '1',
            title: 'Campaign 1',
            status: CampaignStatus.EXECUTING,
            posts: [],
            startDate: '2024-01-01',
            durationDays: 30
        } as unknown as CampaignAsset,
        {
            id: '2',
            title: 'Campaign 2',
            status: CampaignStatus.PENDING,
            posts: [],
            startDate: '2024-02-01',
            durationDays: 15
        } as unknown as CampaignAsset
    ];

    const mockOnSelect = vi.fn();
    const mockOnCreateNew = vi.fn();

    it('renders correct number of campaigns', () => {
        render(
            <CampaignList
                campaigns={mockCampaigns}
                onSelectCampaign={mockOnSelect}
                onCreateNew={mockOnCreateNew}
            />
        );

        expect(screen.getByText('Campaign 1')).toBeInTheDocument();
        expect(screen.getByText('Campaign 2')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument(); // Count badge
    });

    it('calls onCreateNew when create button is clicked', () => {
        render(
            <CampaignList
                campaigns={mockCampaigns}
                onSelectCampaign={mockOnSelect}
                onCreateNew={mockOnCreateNew}
            />
        );

        const createButton = screen.getByText('New Campaign').closest('button');
        fireEvent.click(createButton!);
        expect(mockOnCreateNew).toHaveBeenCalled();
    });

    it('calls onSelectCampaign when a campaign is clicked', () => {
        render(
            <CampaignList
                campaigns={mockCampaigns}
                onSelectCampaign={mockOnSelect}
                onCreateNew={mockOnCreateNew}
            />
        );

        fireEvent.click(screen.getByText('Campaign 1'));
        expect(mockOnSelect).toHaveBeenCalledWith(mockCampaigns[0]);
    });
});
