import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlatformCard } from './PlatformCard';
import { useStore } from '@/core/store';

vi.mock('@/hooks/useIsFounderTier', () => ({
    useIsFounderTier: () => false,
}));

describe('PlatformCard', () => {
    const originalElectronAPI = window.electronAPI;

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        window.electronAPI = { showNotification: vi.fn() } as unknown as typeof window.electronAPI;
        useStore.setState({ analyticsReports: {} });
    });

    afterEach(() => {
        window.electronAPI = originalElectronAPI;
    });

    it('never shows fabricated 84.5 or +12.4% metrics when no live analytics exist', () => {
        render(<PlatformCard />);

        expect(screen.queryByText('84.5')).not.toBeInTheDocument();
        expect(screen.queryByText('+12.4%')).not.toBeInTheDocument();
        expect(screen.getByTestId('platform-card-viral-score')).toHaveTextContent('—');
        expect(screen.getByTestId('platform-card-velocity')).toHaveTextContent('—');
        expect(screen.getByRole('button', { name: /Connect DSP/i })).toBeInTheDocument();
    });

    it('navigates to analytics when Connect DSP is clicked', () => {
        render(<PlatformCard />);
        const setModuleSpy = vi.mocked(useStore.getState().setModule);

        fireEvent.click(screen.getByRole('button', { name: /Connect DSP/i }));
        expect(setModuleSpy).toHaveBeenCalledWith('analytics');
    });

    it('renders real store analytics metrics when loaded', () => {
        useStore.setState({
            analyticsReports: {
                'track-1': {
                    track: {
                        trackId: 'track-1',
                        trackName: 'Midnight Frequencies',
                        artistName: 'Solis',
                        releaseDate: '2026-01-01',
                        genre: 'Electronic',
                        totalStreams: 1200,
                        platforms: [],
                        history: [
                            { date: '2026-01-01', streams: 100, saves: 10, completions: 80, uniqueListeners: 90, shares: 5, newFollowers: 4, playlistAdditions: 1 },
                            { date: '2026-01-02', streams: 118, saves: 14, completions: 95, uniqueListeners: 102, shares: 8, newFollowers: 6, playlistAdditions: 2 },
                        ],
                        creatorCount: 0,
                        regions: [],
                    },
                    metrics: {
                        saveRate: 0.12,
                        completionRate: 0.8,
                        repeatListenerRatio: 1.15,
                        shareRate: 0.05,
                        followerConversionRate: 0.05,
                        velocity: 1.18,
                        playlistVelocity: 1.5,
                        momentumRatio: 1.18,
                    },
                    viralScore: {
                        score: 72.4,
                        label: 'High',
                        trend: 'growing',
                        breakdown: { saveRate: 30, completionRate: 16, repeatListeners: 10, playlistVelocity: 8, shareRate: 8.4 },
                        method: 'weighted_engagement_heuristic',
                        confidence: 'low',
                        predictive: false,
                        sampleDays: 2,
                    },
                    patterns: [],
                    alerts: [],
                    forecast: {
                        available: false,
                        days: 30,
                        projected: [],
                        peakDay: '',
                        peakStreams: 0,
                        growthMultiplier: 1,
                        confidence: 'unavailable',
                        method: 'insufficient_history',
                        providerVerified: false,
                        sampleDays: 2,
                        assumptions: [],
                        limitations: [],
                    },
                    generatedAt: '2026-01-02T00:00:00Z',
                },
            },
        });

        render(<PlatformCard />);

        expect(screen.getByTestId('platform-card-viral-score')).toHaveTextContent('72.4');
        expect(screen.getByTestId('platform-card-velocity')).toHaveTextContent('+18.0%');
        expect(screen.queryByRole('button', { name: /Connect DSP/i })).not.toBeInTheDocument();
    });
});
