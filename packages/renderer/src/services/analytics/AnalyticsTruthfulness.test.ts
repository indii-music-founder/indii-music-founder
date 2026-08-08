import { describe, expect, it } from 'vitest';
import { AnalyticsEngine } from './AnalyticsEngine';
import { growthPatternService } from './GrowthPatternService';
import { viralScoreService } from './ViralScoreService';
import type { StreamDataPoint, TrackAnalytics } from './types';

function point(day: number, streams: number): StreamDataPoint {
    return {
        date: `2026-08-${String(day).padStart(2, '0')}`,
        streams,
        saves: Math.round(streams * 0.12),
        completions: Math.round(streams * 0.75),
        uniqueListeners: Math.max(1, Math.round(streams * 0.6)),
        shares: Math.round(streams * 0.03),
        newFollowers: Math.round(streams * 0.01),
        playlistAdditions: 5,
    };
}

function track(history: StreamDataPoint[]): TrackAnalytics {
    return {
        trackId: 'track-1',
        trackName: 'Midnight Blaze',
        artistName: 'The Flames',
        releaseDate: '2026-08-01',
        genre: 'Pop',
        totalStreams: history.reduce((sum, item) => sum + item.streams, 0),
        platforms: [],
        history,
        creatorCount: 0,
        regions: [],
    };
}

describe('analytics truth boundaries', () => {
    it('returns an unavailable forecast instead of inventing a 1,000-stream baseline', () => {
        const report = new AnalyticsEngine().generateReport(track([]));

        expect(report.forecast).toMatchObject({
            available: false,
            projected: [],
            peakStreams: 0,
            growthMultiplier: 0,
            confidence: 'unavailable',
            method: 'insufficient_history',
            providerVerified: false,
            sampleDays: 0,
        });
    });

    it('labels a seven-day projection as a bounded low-confidence heuristic', () => {
        const history = Array.from({ length: 7 }, (_, index) => point(index + 1, 100 + index * 10));
        const report = new AnalyticsEngine().generateReport(track(history));

        expect(report.forecast.available).toBe(true);
        expect(report.forecast.projected).toHaveLength(14);
        expect(report.forecast).toMatchObject({
            confidence: 'low',
            method: 'bounded_recent_velocity_heuristic',
            providerVerified: false,
            sampleDays: 7,
        });
        expect(report.forecast.limitations.join(' ')).toContain('Not a Spotify');
        expect(report.viralScore).toMatchObject({
            method: 'weighted_engagement_heuristic',
            confidence: 'low',
            predictive: false,
            sampleDays: 7,
        });
    });

    it('turns a high score into a review signal, never an instruction to buy ads', () => {
        const strongHistory = Array.from({ length: 7 }, (_, index) => point(index + 1, 1000 + index * 250));
        const source = track(strongHistory);
        const metrics = viralScoreService.computeMetrics(source);
        const alerts = growthPatternService.generateAlerts(source, metrics, 90);
        const signal = alerts.find((alert) => alert.type === 'breakout_candidate');

        expect(signal).toMatchObject({ title: 'Strong Engagement Signal', severity: 'warning' });
        expect(signal?.message).toContain('Review source freshness');
        expect(signal?.message).not.toContain('Activate paid amplification');
    });

    it('recommends review rather than automatically pausing below a static save-rate floor', () => {
        const health = viralScoreService.evaluateSaveRateHealth(0.02);

        expect(health.action).toBe('review_pause');
        expect(health.message).toContain('heuristic floor');
        expect(health.message).toContain('before deciding whether to pause');
        expect(health.message).not.toContain('algorithmic damage');
    });
});
