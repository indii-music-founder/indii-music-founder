import { wrapTool, toolError, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { detect_streaming_anomalies } from './AnalysisTools';
import { run_cohort_analysis } from './BigQueryTools';
import { importWithRetry } from '@/utils/dynamicImport';

export const AnalyticsTools = {
    calculate_viral_potential_score: wrapTool('calculate_viral_potential_score', async (args: { bpm: number; genre: string; mood: string }) => {
        const bpm = args.bpm;
        const genre = args.genre.toLowerCase();
        const mood = args.mood.toLowerCase();

        let baseScore = 50;

        // BPM influence
        if (bpm > 120) {
            baseScore += 15;
        } else if (bpm < 90) {
            baseScore += 5;
        }

        // Genre influence
        const popGenres = ["pop", "hip-hop", "phonk", "afrobeats", "rap", "r&b"];
        if (popGenres.includes(genre)) {
            baseScore += 20;
        }

        // Mood influence
        const viralMoods = ["energetic", "hype", "happy", "dark", "sad"];
        if (viralMoods.includes(mood)) {
            baseScore += 10;
        }

        const score = Math.min(100, Math.max(0, baseScore));

        return toolSuccess({
            viralScore: score,
            confidence: 'low',
            method: 'static_tempo_genre_mood_heuristic',
            predictive: false,
            assumptions: {
                baseScore: 50,
                bpmAdjustment: bpm > 120 ? 15 : bpm < 90 ? 5 : 0,
                recognizedGenreAdjustment: popGenres.includes(genre) ? 20 : 0,
                recognizedMoodAdjustment: viralMoods.includes(mood) ? 10 : 0,
            },
            platformBreakdown: {
                tiktok: Math.min(100, score + 10),
                reels: Math.min(100, score + 5),
                shorts: score
            },
            recommendation: score > 75 ? "High" : score > 50 ? "Medium" : "Low"
        }, `Low-confidence viral-potential heuristic: ${score}/100. This static tempo/genre/mood rubric is not a historical-data prediction.`);
    }),

    benchmark_release_velocity: wrapTool('benchmark_release_velocity', async (args: { trackId?: string; artistId?: string }) => {
        const { auth } = await importWithRetry(() => import('@/services/firebase'));
        const uid = auth.currentUser?.uid;
        if (!uid) {
            return toolError('User is not authenticated.', 'UNAUTHENTICATED');
        }

        const { syncSpotifyStats } = await importWithRetry(() => import('@/services/social/SocialPlatformService'));
        const stats = await syncSpotifyStats(uid, args.artistId ?? '');
        const hasUserFollowers = typeof stats.followers === 'number' && Number.isFinite(stats.followers) && stats.followers >= 0;
        const followers = hasUserFollowers ? stats.followers! : 1500;
        const personalized = hasUserFollowers;
        const source = stats.liveSyncOk && personalized
            ? 'live_spotify_followers'
            : stats.cacheOnly && personalized
                ? 'cached_spotify_followers'
                : 'hypothetical_1500_follower_baseline';

        // Illustrative multipliers only; they are not a provider forecast.
        const day1 = Math.round(followers * 0.12);
        const day7 = Math.round(followers * 0.45);
        const day30 = Math.round(followers * 1.8);

        const projectionMessage = personalized
            ? `Low-confidence release-velocity estimate using ${source === 'live_spotify_followers' ? 'live' : 'cached'} Spotify followers. The day-30 illustration is ${day30.toLocaleString('en-US')} streams; it is not a Spotify forecast.`
            : `Hypothetical release-velocity example using an assumed 1,500-follower audience. The day-30 illustration is ${day30.toLocaleString('en-US')} streams; it is not personalized or provider-verified.`;

        return toolSuccess({
            trackId: args.trackId ?? null,
            followers,
            source,
            personalized,
            confidence: 'low',
            estimateMetadata: {
                kind: 'illustrative_estimate',
                providerVerifiedForecast: false,
                liveSyncOk: stats.liveSyncOk === true,
                cacheOnly: stats.cacheOnly === true,
                fetchedAt: personalized ? stats.fetchedAt : null,
                assumptions: [
                    'Day 1 streams equal 12% of follower count.',
                    'Day 7 streams equal 45% of follower count.',
                    'Day 30 streams equal 180% of follower count.',
                    'The comparison target equals 200% of follower count.',
                    ...(personalized ? [] : ['Audience size is a hypothetical 1,500 followers.']),
                ],
            },
            velocityCurve: {
                day1,
                day7,
                day30,
            },
            benchmarks: {
                targetDay30: Math.round(followers * 2.0),
                performanceRatio: Number((day30 / (followers * 2.0)).toFixed(2))
            }
        }, projectionMessage);
    }),

    detect_streaming_anomalies,
    run_cohort_analysis
} satisfies Record<string, AnyToolFunction>;

export const {
    calculate_viral_potential_score,
    benchmark_release_velocity
} = AnalyticsTools;
