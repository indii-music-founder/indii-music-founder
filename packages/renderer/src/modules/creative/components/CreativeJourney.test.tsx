import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    setViewMode: vi.fn(),
    setGenerationMode: vi.fn(),
    setModule: vi.fn(),
    setNodes: vi.fn(),
    setEdges: vi.fn(),
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
        setModule: vi.fn(),
        setNodes: vi.fn(),
        setEdges: vi.fn(),
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

    it('opens the Flow-Be artwork template from the artwork journey', () => {
        render(<CreativeJourney />);
        fireEvent.click(screen.getByTestId('creative-journeys-toggle'));
        fireEvent.click(screen.getByTestId('creative-journey-album_artwork'));
        expect(mocks.store.setNodes).toHaveBeenCalledWith(expect.arrayContaining([
            expect.objectContaining({ data: expect.objectContaining({ nodeType: 'input' }) }),
        ]));
        expect(mocks.store.setModule).toHaveBeenCalledWith('workflow');
    });

    it('opens the Flow-Be video template from the music-video journey', () => {
        render(<CreativeJourney />);
        fireEvent.click(screen.getByTestId('creative-journeys-toggle'));
        fireEvent.click(screen.getByTestId('creative-journey-music_video'));
        expect(mocks.store.setModule).toHaveBeenCalledWith('workflow');
        expect(mocks.store.setViewMode).not.toHaveBeenCalled();
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

    it('renders inline for the header row with no fold control or stacked strip', () => {
        render(<CreativeJourney />);
        const journey = screen.getByTestId('creative-journey');
        expect(journey.tagName).toBe('DIV');
        expect(journey).toHaveAttribute('role', 'group');
        expect(journey).not.toHaveClass('border-t');
        expect(screen.queryByTestId('creative-journey-fold-toggle')).not.toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('Turn this into a short social cut');
    });

    it('closes the journeys popover with Escape and returns focus to the toggle', () => {
        render(<CreativeJourney />);
        const toggle = screen.getByTestId('creative-journeys-toggle');
        fireEvent.click(toggle);
        expect(document.getElementById('creative-journey-options')).toBeInTheDocument();
        fireEvent.keyDown(toggle, { key: 'Escape' });
        expect(document.getElementById('creative-journey-options')).not.toBeInTheDocument();
        expect(toggle).toHaveFocus();
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });

    it('closes the journeys popover on an outside click', () => {
        render(
            <div>
                <button type="button" data-testid="outside">Canvas</button>
                <CreativeJourney />
            </div>
        );
        fireEvent.click(screen.getByTestId('creative-journeys-toggle'));
        expect(document.getElementById('creative-journey-options')).toBeInTheDocument();
        fireEvent.mouseDown(screen.getByTestId('outside'));
        expect(document.getElementById('creative-journey-options')).not.toBeInTheDocument();
    });

    it('shows a step hint as a dismissible popover that clears itself', () => {
        vi.useFakeTimers();
        try {
            render(<CreativeJourney />);
            fireEvent.click(screen.getByTestId('creative-journeys-toggle'));
            fireEvent.click(screen.getByTestId('creative-journey-phone_recording'));
            expect(screen.getByTestId('creative-journey-guidance')).toHaveTextContent('Import the recording');
            act(() => { vi.advanceTimersByTime(8000); });
            expect(screen.queryByTestId('creative-journey-guidance')).not.toBeInTheDocument();
        } finally {
            vi.useRealTimers();
        }
    });

    it('closes the reference library panel with its close button', async () => {
        render(<CreativeJourney />);
        fireEvent.click(screen.getByTestId('creative-journeys-toggle'));
        fireEvent.click(screen.getByTestId('creative-journey-band_references'));
        expect(await screen.findByTestId('character-library')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('creative-journey-guidance-close'));
        expect(screen.queryByTestId('character-library')).not.toBeInTheDocument();
        expect(screen.getByTestId('creative-journeys-toggle')).toHaveFocus();
    });

    it('opens the guided campaign from the popover', () => {
        const originalUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        render(<CreativeJourney />);
        fireEvent.click(screen.getByTestId('creative-journeys-toggle'));
        fireEvent.click(screen.getByTestId('creative-journey-guided_campaign'));
        expect(mocks.store.setModule).toHaveBeenCalledWith('workflow');
        expect(new URLSearchParams(window.location.search).get('mode')).toBe('free_demo');
        window.history.replaceState({}, '', originalUrl);
    });
});
