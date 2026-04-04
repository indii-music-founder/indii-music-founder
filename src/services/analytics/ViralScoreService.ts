/**
 * ViralScoreService — Music Growth Intelligence Engine
 *
 * Implements the viral score formula defined in the IndiiOS Growth Intelligence spec.
 *
 * indii Growth Protocol v2.0 — Save Rate is the DOMINANT KPI.
 * Updated weights (v2.0): 0.45*save_rate + 0.20*completion_rate + 0.15*repeat_listener_ratio
 *                       + 0.10*playlist_velocity + 0.10*share_rate
 *
 * GUARDRAIL: If save rate drops below 5%, the campaign is causing algorithmic damage
 * and a pause command is dispatched immediately.
 */

import type {
    TrackAnalytics,
    ComputedMetrics,
    ViralScore,
    ViralScoreBreakdown,
    BreakoutProbability,
    StreamDataPoint,
} from './types';

// ──────────────────────────────────────────────────────────────────────────────
// Normalization benchmarks — based on music industry engagement averages
// ──────────────────────────────────────────────────────────────────────────────

const BENCHMARKS = {
    saveRate: { low: 0.01, high: 0.15 },  // 1% baseline → 15% exceptional
    completionRate: { low: 0.30, high: 0.85 },  // 30% baseline → 85% exceptional
    repeatListenerRatio: { low: 1.0, high: 3.5 },  // 1x baseline → 3.5x exceptional
    shareRate: { low: 0.005, high: 0.05 },  // 0.5% baseline → 5% exceptional
    followerConversion: { low: 0.001, high: 0.02 },
    velocity: { low: 0.9, high: 2.5 },  // 0.9x decline → 2.5x surge
    playlistVelocity: { low: 0, high: 20 },  // 0 → 20 new playlists/day exceptional
};

function normalize(value: number, low: number, high: number): number {
    if (high <= low) return 0;
    return Math.min(1, Math.max(0, (value - low) / (high - low)));
}

// ──────────────────────────────────────────────────────────────────────────────
// Public service
// ──────────────────────────────────────────────────────────────────────────────

export class ViralScoreService {
    /**
     * Derive computed engagement metrics from 30-day stream history.
     */
    computeMetrics(track: TrackAnalytics): ComputedMetrics {
        const history = track.history;
        if (!history.length) {
            return {
                saveRate: 0, completionRate: 0, repeatListenerRatio: 0,
                shareRate: 0, followerConversionRate: 0,
                velocity: 1, playlistVelocity: 0, momentumRatio: 1,
            };
        }

        // Aggregate totals from the full 30-day window
        const totals = history.reduce(
            (acc, d) => ({
                streams: acc.streams + d.streams,
                saves: acc.saves + d.saves,
                completions: acc.completions + d.completions,
                uniqueListeners: acc.uniqueListeners + d.uniqueListeners,
                shares: acc.shares + d.shares,
                newFollowers: acc.newFollowers + d.newFollowers,
                playlistAdditions: acc.playlistAdditions + d.playlistAdditions,
            }),
            { streams: 0, saves: 0, completions: 0, uniqueListeners: 0, shares: 0, newFollowers: 0, playlistAdditions: 0 }
        );

        const saveRate = totals.streams > 0 ? totals.saves / totals.streams : 0;
        const completionRate = totals.streams > 0 ? totals.completions / totals.streams : 0;
        const repeatListenerRatio = totals.uniqueListeners > 0 ? totals.streams / totals.uniqueListeners : 1;
        const shareRate = totals.streams > 0 ? totals.shares / totals.streams : 0;
        const followerConversionRate = totals.uniqueListeners > 0 ? totals.newFollowers / totals.uniqueListeners : 0;

        // Velocity: today vs yesterday
        const velocity = this._computeVelocity(history);

        // Playlist velocity: average new playlist adds over last 7 days
        const last7 = history.slice(-7);
        const playlistVelocity = last7.length > 0
            ? last7.reduce((s, d) => s + d.playlistAdditions, 0) / last7.length
            : 0;

        // Momentum ratio: day3 / day1 (early growth signal)
        const momentumRatio = this._computeMomentumRatio(history);

        return {
            saveRate,
            completionRate,
            repeatListenerRatio,
            shareRate,
            followerConversionRate,
            velocity,
            playlistVelocity,
            momentumRatio,
        };
    }

    /**
     * Calculate the composite viral score (0-100) using the weighted formula.
     *
     * indii Growth Protocol v2.0 — Save Rate dominant weights:
     *   0.45*save_rate + 0.20*completion_rate + 0.15*repeat_listener_ratio
     * + 0.10*playlist_velocity + 0.10*share_rate
     */
    calculateViralScore(metrics: ComputedMetrics, history: StreamDataPoint[]): ViralScore {
        // Normalize each metric to 0-1
        const nSaveRate = normalize(metrics.saveRate, BENCHMARKS.saveRate.low, BENCHMARKS.saveRate.high);
        const nCompletion = normalize(metrics.completionRate, BENCHMARKS.completionRate.low, BENCHMARKS.completionRate.high);
        const nRepeat = normalize(metrics.repeatListenerRatio, BENCHMARKS.repeatListenerRatio.low, BENCHMARKS.repeatListenerRatio.high);
        const nPlaylist = normalize(metrics.playlistVelocity, BENCHMARKS.playlistVelocity.low, BENCHMARKS.playlistVelocity.high);
        const nShare = normalize(metrics.shareRate, BENCHMARKS.shareRate.low, BENCHMARKS.shareRate.high);

        // Apply weights (indii Growth Protocol v2.0 — save-rate dominant)
        const breakdown: ViralScoreBreakdown = {
            saveRate: +(nSaveRate * 45).toFixed(1),   // 0.45 weight (up from 0.35)
            completionRate: +(nCompletion * 20).toFixed(1),   // 0.20 weight (down from 0.25)
            repeatListeners: +(nRepeat * 15).toFixed(1),   // 0.15 weight (down from 0.20)
            playlistVelocity: +(nPlaylist * 10).toFixed(1),   // 0.10 weight (unchanged)
            shareRate: +(nShare * 10).toFixed(1),   // 0.10 weight (unchanged)
        };

        const score = Math.round(
            breakdown.saveRate + breakdown.completionRate + breakdown.repeatListeners +
            breakdown.playlistVelocity + breakdown.shareRate
        );

        const label = this._getLabel(score);
        const trend = this._computeTrend(history);

        return { score, label, trend, breakdown };
    }

    /**
     * Detect early momentum: streams_day3 / streams_day1
     * Signals: 1.0 = stable, 1.5 = accelerating, 2.0 = potential breakout
     */
    detectMomentumSignal(momentumRatio: number): { label: string; color: string } {
        if (momentumRatio >= 2.0) return { label: 'Potential Breakout', color: 'text-yellow-400' };
        if (momentumRatio >= 1.5) return { label: 'Accelerating', color: 'text-emerald-400' };
        if (momentumRatio >= 1.0) return { label: 'Stable Interest', color: 'text-blue-400' };
        return { label: 'Declining', color: 'text-red-400' };
    }

    // ──────────────────────────────────────────────────────────────────────────
    // indii Growth Protocol — Cost-Per-Save Guardrail
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Evaluate the health of a campaign's save rate.
     *
     * indii Growth Protocol v2.0 GUARDRAIL:
     * - Save Rate ≥ 8%  →  HEALTHY (strong algorithmic lift)
     * - Save Rate 5-8%  →  WARNING (below optimal, needs creative refresh)
     * - Save Rate < 5%  →  CRITICAL + AUTO-PAUSE (causing algorithmic damage)
     *
     * Returns an action recommendation that the indii Conductor or Marketing
     * Agent should execute immediately.
     */
    evaluateSaveRateHealth(saveRate: number): {
        status: 'healthy' | 'warning' | 'critical';
        message: string;
        action: 'continue' | 'refresh_creatives' | 'pause_campaign';
    } {
        if (saveRate >= 0.08) {
            return {
                status: 'healthy',
                message: `Save rate ${(saveRate * 100).toFixed(1)}% is above the 8% threshold. Strong algorithmic growth signal.`,
                action: 'continue',
            };
        }

        if (saveRate >= 0.05) {
            return {
                status: 'warning',
                message: `Save rate ${(saveRate * 100).toFixed(1)}% is below the 8% target but above the 5% safety floor. Refresh ad creatives and tighten audience targeting.`,
                action: 'refresh_creatives',
            };
        }

        // CRITICAL: Below 5% save rate = algorithmic damage
        return {
            status: 'critical',
            message: `CRITICAL: Save rate ${(saveRate * 100).toFixed(1)}% is below the 5% floor. This campaign is causing algorithmic damage. ` +
                `IMMEDIATE ACTION: Pause this ad set to prevent further score tapering. Do NOT resume until creatives are refreshed and audience is retargeted.`,
            action: 'pause_campaign',
        };
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ──────────────────────────────────────────────────────────────────────────

    private _computeVelocity(history: StreamDataPoint[]): number {
        if (history.length < 2) return 1;
        const today = history[history.length - 1]!.streams;
        const yesterday = history[history.length - 2]!.streams;
        return yesterday > 0 ? today / yesterday : 1;
    }

    private _computeMomentumRatio(history: StreamDataPoint[]): number {
        if (history.length < 3) return 1;
        const day1 = history[0]!.streams;
        const day3 = history[2]!.streams;
        return day1 > 0 ? day3 / day1 : 1;
    }

    private _getLabel(score: number): BreakoutProbability {
        if (score >= 80) return 'Breakout!';
        if (score >= 60) return 'High';
        if (score >= 35) return 'Moderate';
        return 'Low';
    }

    private _computeTrend(history: StreamDataPoint[]): ViralScore['trend'] {
        if (history.length < 7) return 'stable';
        const first3 = history.slice(0, 3).reduce((s, d) => s + d.streams, 0) / 3;
        const last3 = history.slice(-3).reduce((s, d) => s + d.streams, 0) / 3;
        const ratio = first3 > 0 ? last3 / first3 : 1;
        if (ratio >= 2.0) return 'accelerating';
        if (ratio >= 1.2) return 'growing';
        if (ratio >= 0.8) return 'stable';
        return 'declining';
    }
}

export const viralScoreService = new ViralScoreService();
