import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreativeJourney from './CreativeJourney';
import { useStore } from '@/core/store';

// Mock typesafeJudgments
const mockJudgeCreativeJourneyIntent = vi.fn().mockResolvedValue({
    recommendedJourney: 'album_artwork',
    headline: 'Design release artwork tuned for DSPs and 3000×3000 physical print specs.',
    actionLabel: 'Design Cover Art',
    targetViewMode: 'canvas',
    targetGenMode: 'image',
    confidence: 0.9,
    reason: 'Mock intent',
});

vi.mock('@/config/typesafeJudgments', () => ({
    judgeCreativeJourneyIntent: (...args: any[]) => mockJudgeCreativeJourneyIntent(...args),
}));

// Mock video editor store
vi.mock('../video/store/videoEditorStore', () => ({
    useVideoEditorStore: {
        getState: () => ({
            setViewMode: vi.fn(),
        }),
    },
}));

describe('CreativeJourney Flow Strip', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders ambient flow strip with Jev headline and action button', async () => {
        render(<CreativeJourney />);

        expect(screen.getByTestId('creative-journey-flow-strip')).toBeInTheDocument();
        expect(screen.getByText('FLOW')).toBeInTheDocument();

        // Wait for Jev judgment to resolve and display
        const actionBtn = await screen.findByTestId('creative-journey-action-btn');
        expect(actionBtn).toBeInTheDocument();
        expect(actionBtn).toHaveTextContent('Design Cover Art');
        expect(screen.getByTestId('creative-journey-headline')).toHaveTextContent(/Design release artwork/);
    });

    it('opens journeys popover menu and provides access to pathways', async () => {
        render(<CreativeJourney />);

        const menuTrigger = screen.getByTestId('creative-journeys-menu-trigger');
        fireEvent.click(menuTrigger);

        expect(screen.getByTestId('creative-journeys-menu')).toBeInTheDocument();
        expect(screen.getByTestId('journey-guided-campaign')).toBeInTheDocument();
        expect(screen.getByTestId('journey-music-video')).toBeInTheDocument();
        expect(screen.getByTestId('journey-social-clips')).toBeInTheDocument();
        expect(screen.getByTestId('journey-artwork')).toBeInTheDocument();
    });

    it('allows dismissing and expanding the flow strip', async () => {
        render(<CreativeJourney />);

        const dismissBtn = screen.getByTestId('dismiss-creative-journey-btn');
        fireEvent.click(dismissBtn);

        expect(screen.queryByTestId('creative-journey-flow-strip')).not.toBeInTheDocument();
        const showBtn = screen.getByTestId('show-creative-journey-btn');
        expect(showBtn).toBeInTheDocument();

        fireEvent.click(showBtn);
        expect(screen.getByTestId('creative-journey-flow-strip')).toBeInTheDocument();
    });
});
