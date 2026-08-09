/**
 * GrowthPatternService — Detects growth patterns in available analytics data.
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
    PopularityScores,
} from './types';
import { POPULARITY_MILESTONES } from './types';
import { v4 as uuidv4 } from 'uuid';

// ──────────────────────────────────────────────────────────────────────────────
// Pattern metadata
// ──────────────────────────────────────────────────────────────────────────────

const PATTERN_META: Record<GrowthPatternName, { label: string; description: string; icon: string }> = {
    slow_burn_growth: {
        label: 'Slow Burn Growth',
        description: 'Gradual week-over-week expansion in the available sample.',
        icon: '🕯️',
    },
    '72_hour_spike': {
        label: '72-Hour Spike',
        description: 'Sharp early-window activity change followed by stabilization in the available sample.',
        icon: '⚡',
    },
    creator_cascade: {
        label: 'Creator Cascade',
        description: 'Provider-reported creator usage is above the internal review threshold.',
        icon: '🌊',
    },
    regional_spark: {
        label: 'Regional Spark',
        description: 'The available activity is concentrated in one region with a comparable-period increase.',
        icon: '📍',
    },
    playlist_ladder: {
        label: 'Playlist Ladder',
        description: 'Playlist-addition activity is above the internal review threshold; placement type is unknown.',
        icon: '📋',
    },
    algorithm_cluster_expansion: {
        label: 'Algorithm Cluster Expansion',
        description: 'Internal engagement heuristic; provider recommendation attribution is not verified.',
        icon: '🤖',
    },
    weekend_amplification: {
        label: 'Weekend Amplification',
        description: 'The available sample shows higher average activity from Friday through Sunday.',
        icon: '📅',
    },
    cross_platform_feedback_loop: {
        label: 'Cross-Platform Feedback Loop',
        description: 'Provider-reported social activity and track velocity are elevated in the same sample; causation is not established.',
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
     *
     * indii Growth Protocol: Also generates alerts for popularity score milestones,
     * score tapering, and 72-hour spike → sustain signals.
     */
    generateAlerts(
        track: TrackAnalytics,
        metrics: ComputedMetrics,
        viralScore: number,
        popularityScores?: PopularityScores,
    ): BreakoutAlert[] {
        const alerts: BreakoutAlert[] = [];
        const now = new Date().toISOString();

        // Alert 1: strong heuristic signal (score ≥ 75). This is review-only;
        // the rubric cannot authorize paid amplification.
        if (viralScore >= 75) {
            alerts.push({
                id: uuidv4(),
                type: 'breakout_candidate' as AlertType,
                title: 'Strong Engagement Signal',
                message: `"${track.trackName}" has an engagement heuristic score of ${viralScore}/100. Review source freshness, attribution, and campaign economics before considering paid amplification.`,
                severity: 'warning',
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
                message: `Observed activity changed by ${(metrics.velocity * 100 - 100).toFixed(0)}% day-over-day in the available sample. Verify source coverage and attribution before making campaign decisions.`,
                severity: 'warning',
                timestamp: now,
                trackId: track.trackId,
                trackName: track.trackName,
            });
        }

        // Alert 3: Creator adoption spike (> 500 creators)
        const verifiedCreatorCount = track.platforms
            .filter(platform => platform.isSynthetic !== true)
            .reduce((sum, platform) => sum + (platform.creatorCount ?? 0), 0);
        if (verifiedCreatorCount >= 500) {
            alerts.push({
                id: uuidv4(),
                type: 'creator_trend_detected' as AlertType,
                title: 'Creator Trend Detected',
                message: `${verifiedCreatorCount.toLocaleString('en-US')} provider-reported creators are using "${track.trackName}" as audio. Review freshness and attribution before acting.`,
                severity: 'warning',
                timestamp: now,
                trackId: track.trackId,
                trackName: track.trackName,
            });
        }

        // ── indii Growth Protocol: Popularity Score Milestones ────────────
        if (popularityScores) {
            const { trackPopularity, previousTrackPopularity } = popularityScores;

            // Alert 4: Popularity milestone reached (10-point thresholds)
            if (previousTrackPopularity !== undefined) {
                for (const milestone of POPULARITY_MILESTONES) {
                    const crossedUp = previousTrackPopularity < milestone.threshold
                        && trackPopularity >= milestone.threshold;

                    if (crossedUp) {
                        alerts.push({
                            id: uuidv4(),
                            type: 'popularity_milestone_reached' as AlertType,
                            title: `Popularity ${milestone.label}: Score ${milestone.threshold}+`,
                            message: `"${track.trackName}" crossed indii's internal ${milestone.threshold}-point comparison band. ${milestone.reviewNote}`,
                            severity: 'warning',
                            timestamp: now,
                            trackId: track.trackId,
                            trackName: track.trackName,
                        });
                    }
                }

                // Alert 5: Popularity score tapering (declining > 3 points)
                const delta = trackPopularity - previousTrackPopularity;
                if (delta <= -3) {
                    alerts.push({
                        id: uuidv4(),
                        type: 'popularity_score_tapering' as AlertType,
                        title: 'Popularity Score Tapering',
                        message: `"${track.trackName}" popularity dropped ${Math.abs(delta)} points (${previousTrackPopularity} → ${trackPopularity}). Review source freshness and campaign context; this score alone does not authorize spend changes.`,
                        severity: 'warning',
                        timestamp: now,
                        trackId: track.trackId,
                        trackName: track.trackName,
                    });
                }
            }
        }

        return alerts;
    }

    /**
     * indii Growth Protocol: Check if the 72-hour spike pattern was detected
     * and generate a review-only alert. The heuristic cannot dispatch work or
     * authorize ad spend.
     *
     * This should be called after `detectPatterns()` returns results.
     */
    generate72HourSpikeDispatch(
        track: TrackAnalytics,
        detectedPatterns: DetectedPattern[],
    ): BreakoutAlert | null {
        const spikePattern = detectedPatterns.find(p => p.name === '72_hour_spike');
        if (!spikePattern) return null;

        return {
            id: uuidv4(),
            type: 'spike_72h_sustain_needed' as AlertType,
            title: '72-Hour Activity Pattern — Review Required',
            message: `"${track.trackName}" triggered the 72-hour spike pattern (confidence: ${(spikePattern.confidence * 100).toFixed(0)}%). ` +
                `Verify the source window and campaign attribution before deciding whether any marketing change is appropriate. No spend action has been dispatched.`,
            severity: 'warning',
            timestamp: new Date().toISOString(),
            trackId: track.trackId,
            trackName: track.trackName,
        };
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
        const tiktok = track.platforms.find(p => p.platform === 'tiktok' && p.isSynthetic !== true);
        const reels = track.platforms.find(p => p.platform === 'instagram_reels' && p.isSynthetic !== true);
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
        if (top.growthRate !== null && topShare >= 0.45 && top.growthRate >= 25) {
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
            p.isSynthetic !== true
            && ['tiktok', 'youtube', 'youtube_shorts', 'instagram_reels'].includes(p.platform)
        );
        const socialStreams = socialPlatforms.reduce((s, p) => s + p.streams, 0);
        const totalStreams = track.platforms
            .filter(platform => platform.isSynthetic !== true)
            .reduce((s, p) => s + p.streams, 0);
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
