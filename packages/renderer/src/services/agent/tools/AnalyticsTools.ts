import { wrapTool, toolError, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { detect_streaming_anomalies } from './AnalysisTools';
import { run_cohort_analysis } from './BigQueryTools';

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
            platformBreakdown: {
                tiktok: Math.min(100, score + 10),
                reels: Math.min(100, score + 5),
                shorts: score
            },
            recommendation: score > 75 ? "High" : score > 50 ? "Medium" : "Low"
        }, `Calculated viral potential score: ${score}/100.`);
    }),

    benchmark_release_velocity: wrapTool('benchmark_release_velocity', async (args: { trackId?: string; artistId?: string }) => {
        // 1. Get auth and Firestore db
        const { db, auth } = await import('@/services/firebase');
        const { doc, getDoc } = await import('firebase/firestore');

        const uid = auth.currentUser?.uid;
        if (!uid) {
            return toolError('User is not authenticated.', 'UNAUTHENTICATED');
        }

        // 2. Fetch stats
        const cacheRef = doc(db, 'users', uid, 'platformStats', 'spotify');
        const snap = await getDoc(cacheRef);

        let followers = 1500; // default benchmark baseline
        let source = 'benchmark_baseline';

        if (snap.exists()) {
            const cached = snap.data();
            if (cached.followers) {
                followers = cached.followers;
                source = 'user_spotify_stats';
            }
        }

        // Calculate a deterministic release velocity curve based on followers
        // Assume standard curves for independent artists
        const day1 = Math.round(followers * 0.12);
        const day7 = Math.round(followers * 0.45);
        const day30 = Math.round(followers * 1.8);

        return toolSuccess({
            trackId: args.trackId || 'unknown_track',
            followers,
            source,
            velocityCurve: {
                day1,
                day7,
                day30,
            },
            benchmarks: {
                targetDay30: Math.round(followers * 2.0),
                performanceRatio: Number((day30 / (followers * 2.0)).toFixed(2))
            }
        }, `Velocity benchmarking complete. Track ${args.trackId || ''} projected day 30 streams: ${day30.toLocaleString()} based on ${followers.toLocaleString()} followers.`);
    }),

    detect_streaming_anomalies,
    run_cohort_analysis
} satisfies Record<string, AnyToolFunction>;

export const {
    calculate_viral_potential_score,
    benchmark_release_velocity
} = AnalyticsTools;
