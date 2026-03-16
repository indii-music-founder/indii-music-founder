// ============================================================================
// IndiiOS Music Growth Intelligence Engine — Core Types
// ============================================================================

export type Platform =
    | 'spotify'
    | 'apple_music'
    | 'tiktok'
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
    | 'creator_trend_detected';

export type BreakoutProbability = 'Low' | 'Moderate' | 'High' | 'Breakout!';

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
    creatorCount?: number;  // TikTok / Reels creators using audio
}

export interface RegionData {
    region: string;
    country: string;
    flag: string;
    streams: number;
    growthRate: number; // percentage change week-over-week
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
    saveRate: number;           // 0-35 pts (weight 0.35)
    completionRate: number;     // 0-25 pts (weight 0.25)
    repeatListeners: number;    // 0-20 pts (weight 0.20)
    playlistVelocity: number;   // 0-10 pts (weight 0.10)
    shareRate: number;          // 0-10 pts (weight 0.10)
}

export interface ViralScore {
    score: number;                  // 0-100
    label: BreakoutProbability;
    trend: 'declining' | 'stable' | 'growing' | 'accelerating';
    breakdown: ViralScoreBreakdown;
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
    days: number;           // forecast horizon in days
    projected: { date: string; streams: number; lower: number; upper: number }[];
    peakDay: string;
    peakStreams: number;
    growthMultiplier: number; // e.g. 3.2x expected growth
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
