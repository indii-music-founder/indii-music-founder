/**
 * GrowthPatternService — Detects viral growth patterns in streaming data.
 *
 * Each detector analyzes the 30-day stream history and cross-platform signals
 * to identify which growth archetype best describes the track's trajectory.
 */

import type {
    TrackAnalytics,
    ComputedMetrics,
    DetectedPattern,
    GrowthPatternName,
    BreakoutAlert,
    AlertType,
} from './types';
import { v4 as uuidv4 } from 'uuid';

// ──────────────────────────────────────────────────────────────────────────────
// Pattern metadata
// ──────────────────────────────────────────────────────────────────────────────

const PATTERN_META: Record<GrowthPatternName, { label: string; description: string; icon: string }> = {
    slow_burn_growth: {
        label: 'Slow Burn Growth',
        description: 'Gradual week-over-week expansion before a major inflection point.',
        icon: '🕯️',
    },
    '72_hour_spike': {
        label: '72-Hour Spike',
        description: 'Sharp release-day spike followed by stabilization — algorithm testing signal.',
        icon: '⚡',
    },
    creator_cascade: {
        label: 'Creator Cascade',
        description: 'Audio adoption spreading from micro-creators to major influencers.',
        icon: '🌊',
    },
    regional_spark: {
        label: 'Regional Spark',
        description: 'Breakout originating in a concentrated geographic region.',
        icon: '📍',
    },
    playlist_ladder: {
        label: 'Playlist Ladder',
        description: 'Track climbing from user-generated playlists to algorithmic and editorial placement.',
        icon: '📋',
    },
    algorithm_cluster_expansion: {
        label: 'Algorithm Cluster Expansion',
        description: 'Song spreading from a tight core fanbase to broader listener clusters via recommendations.',
        icon: '🤖',
    },
    weekend_amplification: {
        label: 'Weekend Amplification',
        description: 'Consistent streaming spikes on Friday–Sunday indicating high social discovery.',
        icon: '📅',
    },
    cross_platform_feedback_loop: {
        label: 'Cross-Platform Feedback Loop',
        description: 'Social platform virality (TikTok/Reels) directly amplifying streaming numbers.',
        icon: '🔄',
    },
};

// ──────────────────────────────────────────────────────────────────────────────
// Public service
// ──────────────────────────────────────────────────────────────────────────────

export class GrowthPatternService {
    /**
     * Run all pattern detectors and return those with confidence ≥ 0.4.
     */
    detectPatterns(track: TrackAnalytics, metrics: ComputedMetrics): DetectedPattern[] {
        const detectors: (() => DetectedPattern | null)[] = [
            () => this._detect72HourSpike(track.history),
            () => this._detectSlowBurn(track.history),
            () => this._detectCreatorCascade(track),
            () => this._detectRegionalSpark(track),
            () => this._detectPlaylistLadder(metrics),
            () => this._detectWeekendAmplification(track.history),
            () => this._detectCrossPlatformFeedback(track, metrics),
            () => this._detectAlgorithmCluster(track.history, metrics),
        ];

        return detectors
            .map(fn => fn())
            .filter((p): p is DetectedPattern => p !== null && p.confidence >= 0.4)
            .sort((a, b) => b.confidence - a.confidence);
    }

    /**
     * Generate breakout alerts based on metrics thresholds.
     */
    generateAlerts(track: TrackAnalytics, metrics: ComputedMetrics, viralScore: number): BreakoutAlert[] {
        const alerts: BreakoutAlert[] = [];
        const now = new Date().toISOString();

        // Alert 1: Breakout candidate (viral score ≥ 75)
        if (viralScore >= 75) {
            alerts.push({
                id: uuidv4(),
                type: 'breakout_candidate' as AlertType,
                title: 'Breakout Candidate',
                message: `"${track.trackName}" has a viral score of ${viralScore}/100. Activate paid amplification now.`,
                severity: 'critical',
                timestamp: now,
                trackId: track.trackId,
                trackName: track.trackName,
            });
        }

        // Alert 2: Rapid velocity (> 1.5x for consistent growth)
        if (metrics.velocity >= 1.5) {
            alerts.push({
                id: uuidv4(),
                type: 'rapid_velocity_growth' as AlertType,
                title: 'Rapid Velocity Detected',
                message: `Streams growing at ${(metrics.velocity * 100 - 100).toFixed(0)}% day-over-day. Submit to editorial playlists immediately.`,
                severity: 'warning',
                timestamp: now,
                trackId: track.trackId,
                trackName: track.trackName,
            });
        }

        // Alert 3: Creator adoption spike (> 500 creators)
        if (track.creatorCount >= 500) {
            alerts.push({
                id: uuidv4(),
                type: 'creator_trend_detected' as AlertType,
                title: 'Creator Trend Detected',
                message: `${track.creatorCount.toLocaleString()} creators are using "${track.trackName}" as audio. Peak social exposure window is now.`,
                severity: 'warning',
                timestamp: now,
                trackId: track.trackId,
                trackName: track.trackName,
            });
        }

        return alerts;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Pattern detectors
    // ──────────────────────────────────────────────────────────────────────────

    private _build(name: GrowthPatternName, confidence: number): DetectedPattern {
        const meta = PATTERN_META[name];
        return {
            name,
            label: meta.label,
            description: meta.description,
            icon: meta.icon,
            confidence: +confidence.toFixed(2),
            detectedAt: new Date().toISOString(),
        };
    }

    private _detect72HourSpike(history: { date: string; streams: number }[]): DetectedPattern | null {
        if (history.length < 5) return null;
        const day1 = history[0]!.streams;
        const day2 = history[1]!.streams;
        const day3 = history[2]!.streams;
        const day4 = history[3]!.streams;
        const avg4to7 = history.slice(4, 7).reduce((s, d) => s + d.streams, 0) / 3;

        // Spike pattern: peaks around day 1-3, then stabilizes
        const peakEarly = Math.max(day1, day2, day3);
        const spikeRatio = avg4to7 > 0 ? peakEarly / avg4to7 : 1;
        const stabilized = day4 < peakEarly * 0.75;

        if (spikeRatio >= 1.8 && stabilized) {
            return this._build('72_hour_spike', Math.min(0.95, 0.5 + (spikeRatio - 1.8) * 0.2));
        }
        return null;
    }

    private _detectSlowBurn(history: { date: string; streams: number }[]): DetectedPattern | null {
        if (history.length < 21) return null;
        const week1Avg = history.slice(0, 7).reduce((s, d) => s + d.streams, 0) / 7;
        const week2Avg = history.slice(7, 14).reduce((s, d) => s + d.streams, 0) / 7;
        const week3Avg = history.slice(14, 21).reduce((s, d) => s + d.streams, 0) / 7;

        // Consistent week-over-week growth
        const w1w2 = week1Avg > 0 ? week2Avg / week1Avg : 1;
        const w2w3 = week2Avg > 0 ? week3Avg / week2Avg : 1;

        if (w1w2 >= 1.1 && w2w3 >= 1.1 && week1Avg > 100) {
            const confidence = Math.min(0.95, 0.55 + ((w1w2 + w2w3) / 2 - 1) * 0.8);
            return this._build('slow_burn_growth', confidence);
        }
        return null;
    }

    private _detectCreatorCascade(track: TrackAnalytics): DetectedPattern | null {
        const tiktok = track.platforms.find(p => p.platform === 'tiktok');
        const reels = track.platforms.find(p => p.platform === 'instagram_reels');
        const totalCreators = (tiktok?.creatorCount ?? 0) + (reels?.creatorCount ?? 0);

        if (totalCreators >= 200) {
            const confidence = Math.min(0.95, 0.4 + totalCreators / 3000);
            return this._build('creator_cascade', confidence);
        }
        return null;
    }

    private _detectRegionalSpark(track: TrackAnalytics): DetectedPattern | null {
        if (!track.regions.length) return null;
        const top = track.regions[0]!;
        const total = track.regions.reduce((s, r) => s + r.streams, 0);
        const topShare = total > 0 ? top.streams / total : 0;

        // One region dominates AND is growing fast
        if (topShare >= 0.45 && top.growthRate >= 25) {
            const confidence = Math.min(0.90, 0.5 + topShare * 0.6 + top.growthRate / 200);
            return this._build('regional_spark', confidence);
        }
        return null;
    }

    private _detectPlaylistLadder(metrics: ComputedMetrics): DetectedPattern | null {
        if (metrics.playlistVelocity >= 5) {
            const confidence = Math.min(0.90, 0.45 + metrics.playlistVelocity / 40);
            return this._build('playlist_ladder', confidence);
        }
        return null;
    }

    private _detectWeekendAmplification(history: { date: string; streams: number }[]): DetectedPattern | null {
        if (history.length < 14) return null;
        let weekendTotal = 0, weekdayTotal = 0, weekendDays = 0, weekdayDays = 0;

        history.forEach(d => {
            const day = new Date(d.date).getDay();
            if (day === 0 || day === 5 || day === 6) { weekendTotal += d.streams; weekendDays++; }
            else { weekdayTotal += d.streams; weekdayDays++; }
        });

        const weekendAvg = weekendDays > 0 ? weekendTotal / weekendDays : 0;
        const weekdayAvg = weekdayDays > 0 ? weekdayTotal / weekdayDays : 0;
        const ratio = weekdayAvg > 0 ? weekendAvg / weekdayAvg : 1;

        if (ratio >= 1.3) {
            const confidence = Math.min(0.85, 0.4 + (ratio - 1.3) * 0.5);
            return this._build('weekend_amplification', confidence);
        }
        return null;
    }

    private _detectCrossPlatformFeedback(track: TrackAnalytics, metrics: ComputedMetrics): DetectedPattern | null {
        const socialPlatforms = track.platforms.filter(p =>
            ['tiktok', 'youtube_shorts', 'instagram_reels'].includes(p.platform)
        );
        const socialStreams = socialPlatforms.reduce((s, p) => s + p.streams, 0);
        const totalStreams = track.platforms.reduce((s, p) => s + p.streams, 0);
        const socialShare = totalStreams > 0 ? socialStreams / totalStreams : 0;

        if (socialShare >= 0.25 && metrics.velocity >= 1.3) {
            const confidence = Math.min(0.90, 0.45 + socialShare * 0.7 + (metrics.velocity - 1) * 0.2);
            return this._build('cross_platform_feedback_loop', confidence);
        }
        return null;
    }

    private _detectAlgorithmCluster(
        history: { date: string; streams: number }[],
        metrics: ComputedMetrics
    ): DetectedPattern | null {
        // Signals: high repeat ratio + accelerating trend + moderate save rate
        if (metrics.repeatListenerRatio >= 1.8 && metrics.saveRate >= 0.06 && metrics.velocity >= 1.2) {
            const confidence = Math.min(0.85,
                0.4 + (metrics.repeatListenerRatio - 1.8) * 0.15 + (metrics.velocity - 1) * 0.2
            );
            return this._build('algorithm_cluster_expansion', confidence);
        }
        return null;
    }
}

export const growthPatternService = new GrowthPatternService();
