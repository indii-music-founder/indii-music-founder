import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalyticsAgent } from './AnalyticsAgent';

// Mock the prompt import which uses Vite's ?raw
vi.mock('@agents/analytics/prompt.md?raw', () => ({
    default: 'Mock System Prompt'
}));

// Mock Firebase services
vi.mock('@/services/firebase', () => ({
    db: {},
    auth: {
        currentUser: { uid: 'test-user-id' }
    },
    functions: {}
}));

// Mock firestore methods
vi.mock('firebase/firestore', () => ({
    doc: vi.fn(),
    getDoc: vi.fn().mockResolvedValue({
        exists: () => true,
        data: () => ({ followers: 5000 })
    })
}));

// Mock functions httpsCallable
vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn().mockReturnValue(vi.fn().mockResolvedValue({
        data: {
            rows: [{ cohort: '2026-06-01', cohort_size: 100, retention_d7: 0.5, retention_d14: 0.3, retention_d30: 0.2 }],
            totalRows: 1,
            schema: [],
            jobId: 'mock-job-id'
        }
    }))
}));

describe('AnalyticsAgent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('calculate_viral_potential_score', () => {
        it('should calculate high viral score for pop genre with fast BPM', async () => {
            const args = {
                bpm: 128,
                genre: 'pop',
                mood: 'energetic'
            };
            const result = await AnalyticsAgent.functions!.calculate_viral_potential_score(args);
            expect(result.success).toBe(true);
            expect(result.data.viralScore).toBeGreaterThanOrEqual(75);
            expect(result.data.recommendation).toBe('High');
        });

        it('should calculate lower score for slow non-pop tracks', async () => {
            const args = {
                bpm: 80,
                genre: 'classical',
                mood: 'calm'
            };
            const result = await AnalyticsAgent.functions!.calculate_viral_potential_score(args);
            expect(result.success).toBe(true);
            expect(result.data.viralScore).toBeLessThan(75);
        });
    });

    describe('benchmark_release_velocity', () => {
        it('should fetch Spotify stats and calculate curves', async () => {
            const args = {
                trackId: 'isrc-123'
            };
            const result = await AnalyticsAgent.functions!.benchmark_release_velocity(args);
            expect(result.success).toBe(true);
            expect(result.data.followers).toBe(5000);
            expect(result.data.velocityCurve.day30).toBe(9000); // 5000 * 1.8
        });
    });

    describe('detect_streaming_anomalies', () => {
        it('should flag anomalies for massive spikes', async () => {
            const args = {
                trackId: 'track-456',
                currentStreams: 6000,
                averageStreams: 1000
            };
            const result = await AnalyticsAgent.functions!.detect_streaming_anomalies(args);
            expect(result.success).toBe(true);
            expect(result.data.anomalyType).toContain('Viral Spike');
            expect(result.data.severity).toBe('Critical');
        });

        it('should report low activity for flat streams', async () => {
            const args = {
                trackId: 'track-456',
                currentStreams: 1050,
                averageStreams: 1000
            };
            const result = await AnalyticsAgent.functions!.detect_streaming_anomalies(args);
            expect(result.success).toBe(true);
            expect(result.data.anomalyType).toBe('None');
        });
    });

    describe('run_cohort_analysis', () => {
        it('should trigger cohort analysis via cloud function', async () => {
            const args = {
                dataset_id: 'ds_1',
                table_id: 't_1',
                cohort_dimension: 'week',
                timeframe: 'last_30_days'
            };
            const result = await AnalyticsAgent.functions!.run_cohort_analysis(args);
            expect(result.success).toBe(true);
            expect(result.data.cohort_results).toHaveLength(1);
        });
    });
});
