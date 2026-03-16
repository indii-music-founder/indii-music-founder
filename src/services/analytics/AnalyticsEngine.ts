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
        const lastDay = track.history[track.history.length - 1];
        const baseStreams = lastDay?.streams ?? 1000;

        // Growth rate driven by viral score (higher score = faster growth)
        const dailyGrowthRate = 1 + (viralScore / 100) * (metrics.velocity - 1) * 0.8;

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

            if (streams > peak) { peak = streams; peakDay = dateStr; }

            projected.push({
                date: dateStr,
                streams,
                lower: Math.round(streams * (1 - uncertainty)),
                upper: Math.round(streams * (1 + uncertainty)),
            });
        }

        const growthMultiplier = baseStreams > 0 ? +(peak / baseStreams).toFixed(1) : 1;

        return {
            days: horizonDays,
            projected,
            peakDay: peakDay || (projected[projected.length - 1]?.date ?? ''),
            peakStreams: peak,
            growthMultiplier,
        };
    }
}

export const analyticsEngine = new AnalyticsEngine();
