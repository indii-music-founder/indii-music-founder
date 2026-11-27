import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RoadMode } from '@/modules/touring/components/RoadMode';

const mocks = vi.hoisted(() => ({
    searchNearbyPlaces: vi.fn(),
    navigateToPlace: vi.fn(),
    judgeMobileRemoteIntent: vi.fn(),
    onSubmitPrompt: vi.fn(),
    geolocationGetCurrentPosition: vi.fn(),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/core/context/VoiceContext', () => ({
    useVoice: () => ({
        isListening: false,
        toggleListening: vi.fn(),
        transcript: '',
    }),
}));

vi.mock('@/modules/touring/hooks/useTouring', () => ({
    useTouring: () => ({
        currentItinerary: {
            stops: [{ id: 'stop-1', city: 'Detroit, MI', venue: 'Magic Stick', date: '2099-06-15' }],
        },
    }),
}));

vi.mock('@/core/store', () => ({
    useStore: Object.assign(() => undefined, {
        getState: () => ({ activeAgentProvider: 'native' }),
        setState: vi.fn(),
    }),
}));

vi.mock('@/services/places/NearbyPlacesService', () => ({
    searchNearbyPlaces: (...args: unknown[]) => mocks.searchNearbyPlaces(...args),
    navigateToPlace: (...args: unknown[]) => mocks.navigateToPlace(...args),
}));

vi.mock('@/config/typesafeJudgments', () => ({
    judgeMobileRemoteIntent: (...args: unknown[]) => mocks.judgeMobileRemoteIntent(...args),
}));

vi.mock('@/modules/mobile-remote/components/MobileMileageModal', () => ({
    default: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div data-testid="mileage-modal" /> : null),
}));

vi.mock('motion/react', () => ({
    motion: {
        div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>,
        button: ({ children, whileTap, initial, animate, transition, ...props }: React.PropsWithChildren<Record<string, unknown>> & Record<string, unknown>) => (
            <button type="button" {...props}>{children}</button>
        ),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('RoadMode Jev integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.onSubmitPrompt.mockResolvedValue(undefined);
        mocks.searchNearbyPlaces.mockResolvedValue({
            category: 'gas',
            locationText: '42.3314, -83.0458',
            places: [{
                name: 'Speedway #12',
                address: '100 Woodward Ave',
                distanceText: '0.4 mi',
                rating: 4.5,
                totalRatings: 120,
                isOpen: true,
                placeId: 'p1',
            }],
        });
        mocks.judgeMobileRemoteIntent.mockResolvedValue({
            recommendedTab: 'road',
            recommendedDepartment: 'road',
            roadPlacesAction: 'gas',
            actionLabel: 'Find Gas Nearby',
            hint: 'Fuel stop needed — querying nearby stations via Places.',
            source: 'deterministic',
        });

        Object.defineProperty(globalThis.navigator, 'geolocation', {
            configurable: true,
            value: {
                getCurrentPosition: (cb: (pos: { coords: { latitude: number; longitude: number } }) => void) => {
                    mocks.geolocationGetCurrentPosition();
                    cb({ coords: { latitude: 42.3314, longitude: -83.0458 } });
                },
            },
        });
    });

    it('renders JevRemoteHintBar and triggers quick Places action from Jev hint click', async () => {
        render(<RoadMode onSubmitPrompt={mocks.onSubmitPrompt} isPaired />);

        const hintBar = await screen.findByTestId('jev-remote-hint-bar');
        expect(hintBar).toHaveTextContent('Fuel stop needed');

        fireEvent.click(screen.getByTestId('jev-remote-hint-action'));

        await waitFor(() => expect(mocks.searchNearbyPlaces).toHaveBeenCalledWith('gas', 42.3314, -83.0458));
    });

    it('routes manual pitstop queries through Jev directly to Places instead of the general agent', async () => {
        render(<RoadMode onSubmitPrompt={mocks.onSubmitPrompt} isPaired />);

        // Expand manual input via toggle button (ChevronUp button next to Talk to Agent)
        const talkBtn = screen.getByRole('button', { name: /Talk to Agent/i });
        const toggleBtn = talkBtn.previousElementSibling as HTMLButtonElement;
        fireEvent.click(toggleBtn);

        const input = await screen.findByPlaceholderText('touring.hints.agent_request');
        fireEvent.change(input, { target: { value: 'Need gas near me' } });

        const sendBtn = input.nextElementSibling as HTMLButtonElement;
        fireEvent.click(sendBtn);

        await waitFor(() => expect(mocks.searchNearbyPlaces).toHaveBeenCalledWith('gas', 42.3314, -83.0458));
        expect(mocks.onSubmitPrompt).not.toHaveBeenCalled();
    });

    it('falls back to onSubmitPrompt when Jev returns no roadPlacesAction', async () => {
        mocks.judgeMobileRemoteIntent.mockResolvedValue({
            recommendedTab: 'road',
            recommendedDepartment: 'road',
            actionLabel: 'Open Road Controls',
            hint: 'Touring or route activity fits the Road tab.',
            source: 'deterministic',
        });

        render(<RoadMode onSubmitPrompt={mocks.onSubmitPrompt} isPaired />);

        const talkBtn = screen.getByRole('button', { name: /Talk to Agent/i });
        fireEvent.click(talkBtn.previousElementSibling as HTMLButtonElement);

        const input = await screen.findByPlaceholderText('touring.hints.agent_request');
        fireEvent.change(input, { target: { value: 'What time is doors tonight?' } });
        fireEvent.click(input.nextElementSibling as HTMLButtonElement);

        await waitFor(() => expect(mocks.onSubmitPrompt).toHaveBeenCalledWith(expect.stringContaining('What time is doors tonight?')));
        expect(mocks.searchNearbyPlaces).not.toHaveBeenCalled();
    });
});
