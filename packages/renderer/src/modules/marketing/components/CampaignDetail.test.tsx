import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CampaignDetail from './CampaignDetail';
import { CampaignStatus, type CampaignAsset } from '../types';

vi.mock('./IntelligencePredictionPanel', () => ({
    default: () => null,
}));

const failedCampaign: CampaignAsset = {
    id: 'campaign-1',
    assetType: 'campaign',
    title: 'Release campaign',
    description: 'A campaign with a terminal delivery error',
    durationDays: 1,
    startDate: '2026-08-09',
    status: CampaignStatus.FAILED,
    posts: [{
        id: 'post-1',
        platform: 'Twitter',
        copy: 'Release announcement',
        imageAsset: { assetType: 'image', title: '', imageUrl: '', caption: '' },
        day: 1,
        status: CampaignStatus.FAILED,
        errorMessage: 'OAuth token expired',
    }],
};

describe('CampaignDetail delivery status', () => {
    it('renders terminal campaign and post failures with the failure treatment', () => {
        render(
            <CampaignDetail
                campaign={failedCampaign}
                onBack={vi.fn()}
                onExecute={vi.fn()}
                isExecuting={false}
                onEditPost={vi.fn()}
            />
        );

        expect(screen.getByTestId('campaign-status-badge')).toHaveTextContent('FAILED');
        expect(screen.getByTestId('campaign-status-badge')).toHaveClass('text-red-400');
        expect(screen.getByText('Failed').parentElement).toHaveClass('text-red-400');
        expect(screen.getByRole('alert')).toHaveTextContent('OAuth token expired');
    });
});
