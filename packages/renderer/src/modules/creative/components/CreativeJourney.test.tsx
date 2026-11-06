import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    setViewMode: vi.fn(),
    setGenerationMode: vi.fn(),
    videoSetViewMode: vi.fn(),
    judgeCreativeJourneyIntent: vi.fn(),
    store: {
        creativePrompt: 'Make a vertical reel from my finished track',
        generationMode: 'video',
        viewMode: 'video_production',
        activeReferenceImage: null,
        videoInputs: { firstFrame: null, lastFrame: null, ingredients: [] as unknown[] },
        setViewMode: vi.fn(),
        setGenerationMode: vi.fn(),
    },
    videoStore: {
        project: { tracks: [] as { clips: { type: string }[] }[] },
        inputAudio: 'audio-stem',
        setViewMode: vi.fn(),
    },
}));

vi.mock('@/core/store', () => ({
    useStore: (selector: (state: typeof mocks.store) => unknown) => selector(mocks.store),
}));

vi.mock('../video/store/videoEditorStore', () => {
    const hook = (selector: (state: typeof mocks.videoStore) => unknown) => selector(mocks.videoStore);
    Object.assign(hook, { getState: () => mocks.videoStore });
    return { useVideoEditorStore: hook };
});

vi.mock('@/config/typesafeJudgments', () => ({
    deterministicCreativeJourneyFallback: () => ({ intent: 'social_clips', confidence: 0.8, headline: 'Turn this into a short social cut', actionLabel: 'Open Social Clips' }),
    judgeCreativeJourneyIntent: mocks.judgeCreativeJourneyIntent,
}));

vi.mock('./FreeMiniCampaignModal', () => ({
    FreeMiniCampaignModal: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div data-testid="campaign-modal" /> : null,
}));

vi.mock('./CharacterLibrary', () => ({ CharacterLibrary: () => <div data-testid="character-library" /> }));

import CreativeJourney from './CreativeJourney';

describe('CreativeJourney', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.store.creativePrompt = 'Make a vertical reel from my finished track';
        mocks.store.generationMode = 'video';
        mocks.store.viewMode = 'video_production';
        mocks.store.videoInputs = { firstFrame: null, lastFrame: null, ingredients: [] };
        mocks.videoStore.project = { tracks: [] };
        mocks.videoStore.inputAudio = 'audio-stem';
        mocks.judgeCreativeJourneyIntent.mockResolvedValue({ intent: 'social_clips', confidence: 0.9, headline: 'Turn this into a short social cut', actionLabel: 'Open Social Clips' });
    });

    it('offers six workflows in a compact journeys popover', () => {
        render(<CreativeJourney />);
        fireEvent.click(screen.getByTestId('creative-journeys-toggle'));
        expect(document.getElementById('creative-journey-options')).toBeInTheDocument();
        expect(screen.getByTestId('creative-journey-phone_recording')).toBeInTheDocument();
        expect(screen.getByTestId('creative-journey-music_video')).toBeInTheDocument();
        expect(screen.getByTestId('creative-journey-social_clips')).toBeInTheDocument();
        expect(screen.getByTestId('creative-journey-album_artwork')).toBeInTheDocument();
        expect(screen.getByTestId('creative-journey-band_references')).toBeInTheDocument();
        expect(screen.getByTestId('creative-journey-guided_campaign')).toBeInTheDocument();
    });

    it('shows a one-click audio recommendation and synchronizes the video editor mode', () => {
        render(<CreativeJourney />);
        fireEvent.click(screen.getByTestId('creative-journey-recommendation'));
        expect(mocks.videoStore.setViewMode).toHaveBeenCalledWith('editor');
        expect(mocks.store.setViewMode).toHaveBeenCalledWith('video_production');
        expect(mocks.store.setGenerationMode).toHaveBeenCalledWith('video');
    });

    it('renders when older store fixtures omit video inputs', () => {
        mocks.store.videoInputs = undefined as unknown as typeof mocks.store.videoInputs;

        expect(() => render(<CreativeJourney />)).not.toThrow();
        expect(screen.getByTestId('creative-journey-recommendation')).toBeInTheDocument();
    });

    it('opens artist references from the Journeys list', async () => {
        render(<CreativeJourney />);
        fireEvent.click(screen.getByTestId('creative-journeys-toggle'));
        fireEvent.click(screen.getByTestId('creative-journey-band_references'));
        expect(await screen.findByTestId('character-library')).toBeInTheDocument();
    });

    it('folds the flow strip with an accessible control', () => {
        render(<CreativeJourney />);
        const fold = screen.getByTestId('creative-journey-fold-toggle');
        fireEvent.click(fold);
        expect(screen.getByText('Creative journeys hidden')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Show creative journeys' })).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(screen.getByRole('button', { name: 'Show creative journeys' }));
        expect(screen.getByTestId('creative-journeys-toggle')).toBeInTheDocument();
    });

    it('opens the guided campaign from the popover', () => {
        render(<CreativeJourney />);
        fireEvent.click(screen.getByTestId('creative-journeys-toggle'));
        fireEvent.click(screen.getByTestId('creative-journey-guided_campaign'));
        expect(screen.getByTestId('campaign-modal')).toBeInTheDocument();
    });
});
