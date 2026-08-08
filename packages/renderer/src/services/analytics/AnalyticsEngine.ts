/**
 * AnalyticsEngine — Orchestrates the full report generation pipeline.
 *
 * Combines viral scoring, pattern detection, and forecast generation into
 * a single call that returns a complete TrackReport.
 */

import { viralScoreService } from './ViralScoreService';
import { growthPatternService } from './GrowthPatternService';
import type { TrackAnalytics, TrackReport, GrowthForecast } from './types';

export class AnalyticsEngine {
    /**
     * Generate a full growth intelligence report for a track.
     */
    generateReport(track: TrackAnalytics): TrackReport {
        const metrics = viralScoreService.computeMetrics(track);
        const viralScore = viralScoreService.calculateViralScore(metrics, track.history);
        const patterns = growthPatternService.detectPatterns(track, metrics);
        const alerts = growthPatternService.generateAlerts(track, metrics, viralScore.score);
        const forecast = this._generateForecast(track, metrics, viralScore.score);

        return {
            track,
            metrics,
            viralScore,
            patterns,
            alerts,
            forecast,
            generatedAt: new Date().toISOString(),
        };
    }

    /**
     * Generate all reports for a catalogue of tracks, sorted by viral score.
     */
    generateCatalogueReports(tracks: TrackAnalytics[]): TrackReport[] {
        return tracks
            .map(t => this.generateReport(t))
            .sort((a, b) => b.viralScore.score - a.viralScore.score);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Forecast — logistic growth projection (14-day horizon)
    // ──────────────────────────────────────────────────────────────────────────

    private _generateForecast(track: TrackAnalytics, metrics: { velocity: number }, viralScore: number): GrowthForecast {
        const horizonDays = 14;
        if (track.history.length < 7) {
            return {
                available: false,
                days: horizonDays,
                projected: [],
                peakDay: '',
                peakStreams: 0,
                growthMultiplier: 0,
                confidence: 'unavailable',
                method: 'insufficient_history',
                providerVerified: false,
                sampleDays: track.history.length,
                assumptions: [],
                limitations: ['At least seven daily observations are required for an illustrative estimate.'],
            };
        }
        const lastDay = track.history[track.history.length - 1];
        const baseStreams = lastDay!.streams;

        // Bound noisy day-over-day velocity before combining it with the rubric.
        const boundedVelocity = Math.min(1.25, Math.max(0.75, metrics.velocity));
        const dailyGrowthRate = 1 + (viralScore / 100) * (boundedVelocity - 1) * 0.8;

        const projected: GrowthForecast['projected'] = [];
        let peak = baseStreams;
        let peakDay = '';

        for (let i = 1; i <= horizonDays; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];

            // Logistic saturation: growth slows as streams approach ceiling
            const saturationFactor = 1 - Math.pow(i / (horizonDays * 1.5), 2);
            const streams = Math.round(baseStreams * Math.pow(dailyGrowthRate * saturationFactor + (1 - saturationFactor), i));
            const uncertainty = 0.15 + (i / horizonDays) * 0.20; // uncertainty grows over time

            if (streams > peak) { peak = streams; peakDay = dateStr!; }

            projected.push({
                date: dateStr!,
                streams,
                lower: Math.round(streams * (1 - uncertainty)),
                upper: Math.round(streams * (1 + uncertainty)),
            });
        }

        const growthMultiplier = baseStreams > 0 ? +(peak / baseStreams).toFixed(1) : 1;

        return {
            available: true,
            days: horizonDays,
            projected,
            peakDay: peakDay || (projected[projected.length - 1]?.date ?? ''),
            peakStreams: peak,
            growthMultiplier,
            confidence: 'low',
            method: 'bounded_recent_velocity_heuristic',
            providerVerified: false,
            sampleDays: track.history.length,
            assumptions: [
                'Recent day-over-day velocity is bounded between 0.75x and 1.25x.',
                'The weighted engagement heuristic scales the bounded velocity.',
                'A fixed saturation curve reduces growth over the 14-day horizon.',
            ],
            limitations: [
                'Not a Spotify, Apple Music, TikTok, or distributor forecast.',
                'Does not model release events, playlist adds, paid media, seasonality, or provider algorithm changes.',
            ],
        };
    }
}

export const analyticsEngine = new AnalyticsEngine();
