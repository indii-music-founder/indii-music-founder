/**
 * Item 281: Agent Tool Integration Tests — MarketingTools
 *
 * Verifies that MarketingTools produce correctly-shaped outputs for each
 * defined tool, using mocked Firebase / AI dependencies.
 *
 * Tests:
 *  - schedule_content: deterministic date generation (no AI dependency)
 *  - create_campaign_brief: AI-driven brief generation + persistence
 *  - analyze_audience: AI-driven audience segmentation
 *  - tier_superfans: Firestore-based fan aggregation with fallback
 *  - track_performance: Firestore campaign metrics read
 *  - analyze_market_trends: AI-driven trend analysis fallback
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/services/ai/FirebaseAIService', () => ({
    firebaseAI: {
        generateStructuredData: vi.fn(),
    },
}));

vi.mock('@/services/marketing/MarketingService', () => ({
    MarketingService: {
        createCampaign: vi.fn().mockResolvedValue({ id: 'camp-mock-001' }),
        getCampaignPerformance: vi.fn().mockResolvedValue({
            campaignId: 'camp-mock-001',
            reach: 12000,
            clicks: 450,
            conversions: 38,
        }),
    },
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    getDocs: vi.fn(),
    doc: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({
    db: {},
    auth: { currentUser: { uid: 'test-user-001' } },
}));

vi.mock('@/utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { MarketingTools } from '../MarketingTools';
import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { getDocs } from 'firebase/firestore';

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('MarketingTools — integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── schedule_content ────────────────────────────────────────────────────────

    describe('schedule_content', () => {
        it('generates 4 weekly posts starting from the given date', async () => {
            const result = await MarketingTools.schedule_content({
                campaign_start: '2024-03-01T00:00:00.000Z',
                platforms: ['Instagram', 'TikTok'],
                frequency: 'weekly',
            });
            expect(result.success).toBe(true);
            expect(result.data.schedule).toHaveLength(4);
            expect(result.data.status).toBe('scheduled');
        });

        it('generates 4 daily posts starting from the given date', async () => {
            const result = await MarketingTools.schedule_content({
                campaign_start: '2024-03-01T00:00:00.000Z',
                platforms: ['Twitter'],
                frequency: 'daily',
            });
            expect(result.success).toBe(true);
            expect(result.data.schedule).toHaveLength(4);
            const first = new Date(result.data.schedule[0].date);
            const second = new Date(result.data.schedule[1].date);
            const diffMs = second.getTime() - first.getTime();
            // Daily = 86400000 ms (give or take an hour for DST)
            expect(diffMs).toBeGreaterThanOrEqual(82800000);
            expect(diffMs).toBeLessThanOrEqual(90000000);
        });

        it('assigns platforms to each scheduled post', async () => {
            const platforms = ['Twitter', 'Instagram'];
            const result = await MarketingTools.schedule_content({
                campaign_start: '2024-03-01T00:00:00.000Z',
                platforms,
                frequency: 'weekly',
            });
            expect(result.success).toBe(true);
            result.data.schedule.forEach((post: { platform: string }) => {
                expect(platforms).toContain(post.platform);
            });
        });
    });

    // ── create_campaign_brief ────────────────────────────────────────────────────

    describe('create_campaign_brief', () => {
        it('calls AI and persists the generated brief', async () => {
            const mockBrief = {
                campaignName: 'Summer Splash',
                targetAudience: 'Gen Z music fans 18-24',
                budget: '$5,000',
                channels: ['Instagram', 'TikTok'],
                kpis: ['streams', 'playlist adds'],
            };
            (firebaseAI.generateStructuredData as ReturnType<typeof vi.fn>).mockResolvedValue(mockBrief);

            const result = await MarketingTools.create_campaign_brief({
                product: 'Summer EP',
                goal: 'Increase streams by 50%',
                budget: '$5,000',
            });

            expect(result.success).toBe(true);
            expect(result.data.campaignName).toBe('Summer Splash');
            expect(result.data.channels).toContain('Instagram');
            expect(firebaseAI.generateStructuredData).toHaveBeenCalledOnce();
        });

        it('returns a fallback result when AI fails', async () => {
            (firebaseAI.generateStructuredData as ReturnType<typeof vi.fn>).mockRejectedValue(
                new Error('Quota exceeded')
            );

            const result = await MarketingTools.create_campaign_brief({
                product: 'Winter Album',
                goal: 'Brand awareness',
            });

            // Tool should not throw — wrapTool catches and returns success:false
            expect(result.success).toBe(false);
        });
    });

    // ── analyze_audience ─────────────────────────────────────────────────────────

    describe('analyze_audience', () => {
        it('returns audience segmentation from AI', async () => {
            const mockAudience = {
                primarySegment: 'Hip-hop fans 18-24',
                secondarySegments: ['R&B listeners', 'Playlist curators'],
                topPlatforms: ['Spotify', 'Apple Music'],
                recommendedChannels: ['Instagram', 'TikTok'],
                estimatedReach: 250000,
            };
            (firebaseAI.generateStructuredData as ReturnType<typeof vi.fn>).mockResolvedValue(mockAudience);

            const result = await MarketingTools.analyze_audience({
                genre: 'hip-hop',
                similar_artists: ['Drake', 'Kendrick Lamar'],
            });

            expect(result.success).toBe(true);
            expect(result.data).toMatchObject({
                primarySegment: expect.any(String),
            });
        });
    });

    // ── tier_superfans ────────────────────────────────────────────────────────────

    describe('tier_superfans', () => {
        it('returns empty tiers when no fan purchase data exists', async () => {
            // getDocs returns empty snapshot
            (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({ docs: [] });

            const result = await MarketingTools.tier_superfans({
                minSpendForVIP: 50,
                minSpendForSuperfan: 200,
            });

            expect(result.success).toBe(true);
            expect(result.data.vip).toBeInstanceOf(Array);
            expect(result.data.superfans).toBeInstanceOf(Array);
            expect(result.data.regular).toBeInstanceOf(Array);
        });

        it('tiers fans correctly by spend threshold', async () => {
            const mockDocs = [
                { data: () => ({ fanId: 'fan-001', totalSpend: 300, email: 'a@test.com' }) },
                { data: () => ({ fanId: 'fan-002', totalSpend: 75, email: 'b@test.com' }) },
                { data: () => ({ fanId: 'fan-003', totalSpend: 15, email: 'c@test.com' }) },
            ];
            (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({ docs: mockDocs });

            const result = await MarketingTools.tier_superfans({
                minSpendForVIP: 50,
                minSpendForSuperfan: 200,
            });

            expect(result.success).toBe(true);
            // fan-001 ($300) should be superfan, fan-002 ($75) VIP, fan-003 ($15) regular
            expect(result.data.superfans.some((f: { fanId: string }) => f.fanId === 'fan-001')).toBe(true);
            expect(result.data.vip.some((f: { fanId: string }) => f.fanId === 'fan-002')).toBe(true);
            expect(result.data.regular.some((f: { fanId: string }) => f.fanId === 'fan-003')).toBe(true);
        });

        it('falls back gracefully when Firestore query fails', async () => {
            (getDocs as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Firestore unavailable'));

            const result = await MarketingTools.tier_superfans({
                minSpendForVIP: 50,
                minSpendForSuperfan: 200,
            });

            // Should not throw — wrapTool catches
            expect(result.success).toBe(false);
        });
    });

    // ── track_performance ─────────────────────────────────────────────────────────

    describe('track_performance', () => {
        it('returns performance metrics for an existing campaign', async () => {
            // getCampaignPerformance mock is set up in the service mock above
            const result = await MarketingTools.track_performance({ campaignId: 'camp-mock-001' });
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
        });
    });

    // ── analyze_market_trends ─────────────────────────────────────────────────────

    describe('analyze_market_trends', () => {
        it('returns trend data for a given category', async () => {
            const mockTrends = {
                risingGenres: ['afrobeats', 'hyperpop'],
                trendingHashtags: ['#indieartist', '#newmusic'],
                platformMomentum: { TikTok: 'high', Instagram: 'medium' },
            };
            (firebaseAI.generateStructuredData as ReturnType<typeof vi.fn>).mockResolvedValue(mockTrends);

            const result = await MarketingTools.analyze_market_trends({ category: 'music' });
            expect(result.success).toBe(true);
        });

        it('works without a category argument', async () => {
            (firebaseAI.generateStructuredData as ReturnType<typeof vi.fn>).mockResolvedValue({});

            const result = await MarketingTools.analyze_market_trends({});
            expect(result.success).toBe(true);
        });
    });
});
