// ============================================================================
// indii Music Growth Intelligence Engine — Core Types
// ============================================================================

export type Platform =
    | 'spotify'
    | 'apple_music'
    | 'tiktok'
    | 'youtube'
    | 'youtube_shorts'
    | 'instagram_reels';

export type GrowthPatternName =
    | 'slow_burn_growth'
    | '72_hour_spike'
    | 'creator_cascade'
    | 'regional_spark'
    | 'playlist_ladder'
    | 'algorithm_cluster_expansion'
    | 'weekend_amplification'
    | 'cross_platform_feedback_loop';

export type AlertType =
    | 'breakout_candidate'
    | 'rapid_velocity_growth'
    | 'creator_trend_detected'
    | 'popularity_milestone_reached'
    | 'popularity_score_tapering'
    | 'spike_72h_sustain_needed';

export type BreakoutProbability = 'Low' | 'Moderate' | 'High' | 'Strong Signal';

// ──────────────────────────────────────────────────────────────────────────────
// Raw Data Shapes
// ──────────────────────────────────────────────────────────────────────────────

export interface StreamDataPoint {
    date: string;           // ISO date e.g. '2026-03-01'
    streams: number;
    saves: number;
    completions: number;    // full plays
    uniqueListeners: number;
    shares: number;
    newFollowers: number;
    playlistAdditions: number;
}

export interface PlatformData {
    platform: Platform;
    streams: number;
    saves: number;
    completionRate: number; // 0-1
    creatorCount?: number;
    isSynthetic?: boolean;
    syntheticLabel?: string;
    metricsUnavailable?: boolean;
    savesUnavailable?: boolean;
    completionUnavailable?: boolean;
    sourceLabel?: string;
}

export interface RegionData {
    region: string;
    country: string;
    flag: string;
    streams: number;
    /** Percentage change week-over-week when comparable provider periods exist. */
    growthRate: number | null;
}

export interface TrackAnalytics {
    trackId: string;
    trackName: string;
    artistName: string;
    coverUrl?: string;
    releaseDate: string;    // ISO date
    genre: string;
    totalStreams: number;
    platforms: PlatformData[];
    history: StreamDataPoint[];  // last 30 days
    creatorCount: number;        // total UGC creators across social platforms
    regions: RegionData[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Computed / Derived
// ──────────────────────────────────────────────────────────────────────────────

export interface ComputedMetrics {
    saveRate: number;               // saves / streams
    completionRate: number;         // full_plays / total_streams
    repeatListenerRatio: number;    // total_streams / unique_listeners
    shareRate: number;              // shares / streams
    followerConversionRate: number; // new_followers / unique_listeners
    velocity: number;               // streams_today / streams_yesterday
    playlistVelocity: number;       // new_playlist_additions_per_day (7-day avg)
    momentumRatio: number;          // streams_day3 / streams_day1
}

export interface ViralScoreBreakdown {
    saveRate: number;           // 0-45 pts (weight 0.45)
    completionRate: number;     // 0-20 pts (weight 0.20)
    repeatListeners: number;    // 0-15 pts (weight 0.15)
    playlistVelocity: number;   // 0-10 pts (weight 0.10)
    shareRate: number;          // 0-10 pts (weight 0.10)
}

export interface ViralScore {
    score: number;                  // 0-100
    label: BreakoutProbability;
    trend: 'declining' | 'stable' | 'growing' | 'accelerating';
    breakdown: ViralScoreBreakdown;
    method: 'weighted_engagement_heuristic';
    confidence: 'low';
    predictive: false;
    sampleDays: number;
}

export interface DetectedPattern {
    name: GrowthPatternName;
    label: string;
    description: string;
    confidence: number;     // 0-1
    icon: string;           // emoji
    detectedAt: string;     // ISO date
}

export interface BreakoutAlert {
    id: string;
    type: AlertType;
    title: string;
    message: string;
    severity: 'info' | 'warning' | 'critical';
    timestamp: string;
    trackId: string;
    trackName: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Prediction Engine Output
// ──────────────────────────────────────────────────────────────────────────────

export interface GrowthForecast {
    available: boolean;
    days: number;           // forecast horizon in days
    projected: { date: string; streams: number; lower: number; upper: number }[];
    peakDay: string;
    peakStreams: number;
    growthMultiplier: number; // e.g. 3.2x expected growth
    confidence: 'low' | 'unavailable';
    method: 'bounded_recent_velocity_heuristic' | 'insufficient_history';
    providerVerified: false;
    sampleDays: number;
    assumptions: string[];
    limitations: string[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Full Analytics Report (aggregated)
// ──────────────────────────────────────────────────────────────────────────────

export interface TrackReport {
    track: TrackAnalytics;
    metrics: ComputedMetrics;
    viralScore: ViralScore;
    patterns: DetectedPattern[];
    alerts: BreakoutAlert[];
    forecast: GrowthForecast;
    generatedAt: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// indii Growth Protocol — Popularity Score Tracking
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Spotify popularity scores for artist and track.
 * Range: 0–100, where 100 is the most popular.
 * Updated daily by Spotify based on recent streaming activity.
 */
export interface PopularityScores {
    /** Spotify Track Popularity Score (0–100) */
    trackPopularity: number;
    /** Spotify Artist Popularity Score (0–100) */
    artistPopularity: number;
    /** Timestamp of the last fetch */
    fetchedAt: string;
    /** Previous track popularity (for delta calculation) */
    previousTrackPopularity?: number;
    /** Previous artist popularity (for delta calculation) */
    previousArtistPopularity?: number;
}

/**
 * Internal reporting bands for Spotify's public popularity score. Spotify does
 * not publish placement thresholds, so these bands must never be presented as
 * eligibility or algorithmic-placement guarantees.
 */
export interface PopularityMilestone {
    threshold: number;              // 20, 30, 40, 50, 60, 70
    label: string;                  // Human-readable label
    reviewNote: string;
}

/**
 * The defined milestones for the indii Growth Protocol.
 */
export const POPULARITY_MILESTONES: PopularityMilestone[] = [
    { threshold: 20, label: 'Band 20', reviewNote: 'Internal comparison band only; no placement eligibility is implied.' },
    { threshold: 30, label: 'Band 30', reviewNote: 'Internal comparison band only; no placement eligibility is implied.' },
    { threshold: 40, label: 'Band 40', reviewNote: 'Internal comparison band only; no placement eligibility is implied.' },
    { threshold: 50, label: 'Band 50', reviewNote: 'Internal comparison band only; no placement eligibility is implied.' },
    { threshold: 60, label: 'Band 60', reviewNote: 'Internal comparison band only; no placement eligibility is implied.' },
    { threshold: 70, label: 'Band 70', reviewNote: 'Internal comparison band only; no placement eligibility is implied.' },
];
