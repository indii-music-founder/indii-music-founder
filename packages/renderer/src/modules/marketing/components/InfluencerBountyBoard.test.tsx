import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import InfluencerBountyBoard from './InfluencerBountyBoard';

const listBountyLinksMock = vi.hoisted(() => vi.fn());
const generateBountyLinkMock = vi.hoisted(() => vi.fn());
const clipboardWriteTextMock = vi.hoisted(() => vi.fn());

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    }),
}));

vi.mock('@/services/marketing/InfluencerBountyService', () => ({
    influencerBountyService: {
        listBountyLinks: listBountyLinksMock,
        generateBountyLink: generateBountyLinkMock,
    },
}));

describe('InfluencerBountyBoard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        listBountyLinksMock.mockResolvedValue([
            {
                id: 'ref-1',
                influencerHandle: '@alpha',
                trackName: 'Lead Song',
                rewardAmount: 75,
                action: 'TikTok',
                referralCode: 'REF-1',
                targetUrl: 'https://indii.vip/ref/REF-1',
                status: 'active',
            },
        ]);
        generateBountyLinkMock.mockResolvedValue({
            id: 'created-1',
            influencerId: '@creator',
            targetUrl: 'https://indii.vip/ref/REF-NEW',
            referralCode: 'REF-NEW',
            totalClicks: 0,
            totalConversions: 0,
            earnedCommission: 0,
            status: 'active',
        });
        Object.defineProperty(navigator, 'clipboard', {
            value: {
                writeText: clipboardWriteTextMock,
            },
            configurable: true,
        });
    });

    it('reloads saved links and copies the saved referral URL', async () => {
        render(<InfluencerBountyBoard />);

        await screen.findByText('Lead Song');
        expect(screen.getByText('Link only')).toBeInTheDocument();
        expect(screen.getByText('Tracking Unavailable')).toBeInTheDocument();

        fireEvent.click(screen.getByTitle('https://indii.vip/ref/REF-1'));

        await waitFor(() => {
            expect(clipboardWriteTextMock).toHaveBeenCalledWith('https://indii.vip/ref/REF-1');
        });
    });
});
