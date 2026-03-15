/**
 * MockDataService — Generates realistic demo data for the Growth Intelligence Engine.
 *
 * In production, replace `getMockTracks()` with live API calls to Spotify,
 * Apple Music, and social platform analytics endpoints.
 *
 * The generated data models realistic viral growth curves using:
 * - Logistic growth:  y = L / (1 + e^(-k(x - x0)))
 * - Power law noise:  adds natural variation to smooth curves
 */

import type { TrackAnalytics, StreamDataPoint, PlatformData, RegionData } from './types';

function logistic(L: number, k: number, x0: number, x: number): number {
    return L / (1 + Math.exp(-k * (x - x0)));
}

function jitter(value: number, pct = 0.12): number {
    return Math.round(value * (1 + (Math.random() - 0.5) * pct * 2));
}

function generateHistory(
    days: number,
    pattern: 'slow_burn' | 'spike' | 'breakout' | 'declining' | 'steady',
    basePeak: number
): StreamDataPoint[] {
    const history: StreamDataPoint[] = [];
    const today = new Date();

    for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - (days - 1 - i));

        let streams: number;
        switch (pattern) {
            case 'slow_burn':
                streams = jitter(logistic(basePeak, 0.3, days * 0.7, i), 0.08);
                break;
            case 'spike':
                // Sharp spike at day 2 then exponential decay
                streams = i < 3
                    ? jitter(basePeak * Math.pow(0.7, Math.abs(i - 1)), 0.05)
                    : jitter(basePeak * 0.35 * Math.pow(0.97, i - 3), 0.1);
                break;
            case 'breakout':
                streams = jitter(logistic(basePeak, 0.45, days * 0.55, i), 0.06);
                break;
            case 'declining':
                streams = jitter(basePeak * Math.pow(0.96, i), 0.1);
                break;
            case 'steady':
            default:
                streams = jitter(basePeak * 0.6 + Math.sin(i * 0.5) * basePeak * 0.05, 0.08);
        }

        streams = Math.max(50, streams);
        const saveRate = 0.06 + Math.random() * 0.08;
        const completionRate = 0.55 + Math.random() * 0.25;
        const listenerRatio = 1.2 + Math.random() * 0.8;
        const shareRate = 0.01 + Math.random() * 0.03;
        const followerRate = 0.005 + Math.random() * 0.01;

        // Weekend boost
        const dayOfWeek = date.getDay();
        const weekendBoost = (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0) ? 1.25 : 1;
        streams = Math.round(streams * weekendBoost);

        history.push({
            date: date.toISOString().split('T')[0],
            streams,
            saves: Math.round(streams * saveRate),
            completions: Math.round(streams * completionRate),
            uniqueListeners: Math.round(streams / listenerRatio),
            shares: Math.round(streams * shareRate),
            newFollowers: Math.round((streams / listenerRatio) * followerRate),
            playlistAdditions: Math.round(Math.random() * (streams / 5000) * (i / days) * 20),
        });
    }

    return history;
}

function generatePlatforms(spotifyPeak: number, creatorCount: number): PlatformData[] {
    return [
        {
            platform: 'spotify',
            streams: Math.round(spotifyPeak * 30 * 0.55),
            saves: Math.round(spotifyPeak * 30 * 0.55 * 0.08),
            completionRate: 0.62 + Math.random() * 0.15,
        },
        {
            platform: 'apple_music',
            streams: Math.round(spotifyPeak * 30 * 0.20),
            saves: Math.round(spotifyPeak * 30 * 0.20 * 0.07),
            completionRate: 0.65 + Math.random() * 0.12,
        },
        {
            platform: 'tiktok',
            streams: Math.round(spotifyPeak * 30 * 0.15),
            saves: 0,
            completionRate: 0.45 + Math.random() * 0.20,
            creatorCount: Math.round(creatorCount * 0.7),
        },
        {
            platform: 'youtube_shorts',
            streams: Math.round(spotifyPeak * 30 * 0.06),
            saves: 0,
            completionRate: 0.40 + Math.random() * 0.15,
            creatorCount: Math.round(creatorCount * 0.2),
        },
        {
            platform: 'instagram_reels',
            streams: Math.round(spotifyPeak * 30 * 0.04),
            saves: 0,
            completionRate: 0.38 + Math.random() * 0.12,
            creatorCount: Math.round(creatorCount * 0.1),
        },
    ];
}

function generateRegions(totalStreams: number, dominantRegion?: string): RegionData[] {
    const regions: RegionData[] = [
        { region: 'North America', country: 'United States',   flag: '🇺🇸', streams: 0, growthRate: 0 },
        { region: 'North America', country: 'Canada',          flag: '🇨🇦', streams: 0, growthRate: 0 },
        { region: 'Europe',        country: 'United Kingdom',  flag: '🇬🇧', streams: 0, growthRate: 0 },
        { region: 'Europe',        country: 'Germany',         flag: '🇩🇪', streams: 0, growthRate: 0 },
        { region: 'Latin America', country: 'Mexico',          flag: '🇲🇽', streams: 0, growthRate: 0 },
        { region: 'Latin America', country: 'Brazil',          flag: '🇧🇷', streams: 0, growthRate: 0 },
        { region: 'Asia Pacific',  country: 'Australia',       flag: '🇦🇺', streams: 0, growthRate: 0 },
    ];

    // Distribute streams — optionally concentrate in one region (regional spark pattern)
    const weights = dominantRegion
        ? regions.map(r => r.country === dominantRegion ? 0.45 : 0.055 / (regions.length - 1))
        : [0.35, 0.08, 0.18, 0.10, 0.12, 0.09, 0.08];

    return regions.map((r, i) => ({
        ...r,
        streams: Math.round(totalStreams * weights[i]),
        growthRate: +(Math.random() * 60 - 10).toFixed(1),
    })).sort((a, b) => b.streams - a.streams);
}

// ──────────────────────────────────────────────────────────────────────────────
// Track catalogue
// ──────────────────────────────────────────────────────────────────────────────

const TRACK_TEMPLATES = [
    {
        trackId: 'track-001',
        trackName: 'Midnight Protocol',
        artistName: 'AURA',
        genre: 'Electronic / Future Bass',
        pattern: 'breakout' as const,
        basePeak: 18000,
        creatorCount: 1240,
        dominantRegion: undefined,
    },
    {
        trackId: 'track-002',
        trackName: 'Golden Hour (Stripped)',
        artistName: 'Lena Voss',
        genre: 'Indie Pop',
        pattern: 'slow_burn' as const,
        basePeak: 9500,
        creatorCount: 320,
        dominantRegion: 'United Kingdom',
    },
    {
        trackId: 'track-003',
        trackName: 'Faded Signal',
        artistName: 'NXT4',
        genre: 'Trap / Hip-Hop',
        pattern: 'spike' as const,
        basePeak: 42000,
        creatorCount: 4800,
        dominantRegion: undefined,
    },
    {
        trackId: 'track-004',
        trackName: 'Pacifico',
        artistName: 'Casa Blanca',
        genre: 'Latin Pop',
        pattern: 'steady' as const,
        basePeak: 6000,
        creatorCount: 90,
        dominantRegion: 'Mexico',
    },
    {
        trackId: 'track-005',
        trackName: 'Ultraviolet',
        artistName: 'The Drift',
        genre: 'Alternative R&B',
        pattern: 'declining' as const,
        basePeak: 11000,
        creatorCount: 180,
        dominantRegion: undefined,
    },
];

export class MockDataService {
    generateTrackCatalogue(days = 30): TrackAnalytics[] {
        return TRACK_TEMPLATES.map(t => {
            const history = generateHistory(days, t.pattern, t.basePeak);
            const totalStreams = history.reduce((s, d) => s + d.streams, 0);

            return {
                trackId: t.trackId,
                trackName: t.trackName,
                artistName: t.artistName,
                genre: t.genre,
                releaseDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                totalStreams,
                platforms: generatePlatforms(t.basePeak, t.creatorCount),
                history,
                creatorCount: t.creatorCount,
                regions: generateRegions(totalStreams, t.dominantRegion),
            };
        });
    }

    getTrackById(id: string, days = 30): TrackAnalytics | null {
        const catalogue = this.generateTrackCatalogue(days);
        return catalogue.find(t => t.trackId === id) ?? null;
    }
}

export const mockDataService = new MockDataService();
