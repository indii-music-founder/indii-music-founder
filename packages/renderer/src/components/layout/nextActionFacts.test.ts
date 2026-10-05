import { describe, it, expect } from 'vitest';
import { deriveNextActionFacts } from './nextActionFacts';
import type { DashboardRelease } from '@/services/distribution/types/distributor';
import type { EarningsSummary } from '@/services/revenue/schema';

describe('deriveNextActionFacts', () => {
    it('returns empty array when data is loading or absent', () => {
        expect(deriveNextActionFacts({
            releases: null,
            releasesLoading: true,
            earnings: null,
            earningsLoading: false,
        })).toEqual([]);

        expect(deriveNextActionFacts({
            releases: [],
            releasesLoading: false,
            earnings: null,
            earningsLoading: false,
        })).toEqual([]);
    });

    it('identifies pending draft/validating deployments as a candidate', () => {
        const mockRelease: DashboardRelease = {
            id: 'rel-1',
            title: 'Midnight Echoes',
            artist: 'Test Artist',
            deployments: {
                spotify: { status: 'draft' },
                apple: { status: 'delivered' },
            },
        };

        const result = deriveNextActionFacts({
            releases: [mockRelease],
            releasesLoading: false,
            earnings: null,
            earningsLoading: false,
        });

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('release_needs_submission');
        expect(result[0].targetModule).toBe('distribution');
        expect(result[0].title).toContain('Midnight Echoes');
    });

    it('prioritizes delivery error over pending draft', () => {
        const mockRelease: DashboardRelease = {
            id: 'rel-2',
            title: 'Broken Signal',
            artist: 'Test Artist',
            deployments: {
                spotify: { status: 'draft', error: 'Metadata rejected: missing ISRC' },
            },
        };

        const result = deriveNextActionFacts({
            releases: [mockRelease],
            releasesLoading: false,
            earnings: null,
            earningsLoading: false,
        });

        expect(result.some(c => c.id === 'release_delivery_issue')).toBe(true);
        const issue = result.find(c => c.id === 'release_delivery_issue');
        expect(issue?.title).toContain('Broken Signal');
        expect(issue?.description).toContain('missing ISRC');
    });

    it('extracts real earnings when totalStreams > 0', () => {
        const mockEarnings: EarningsSummary = {
            period: { startDate: '2026-08-01', endDate: '2026-08-31' },
            totalGrossRevenue: 120.50,
            totalNetRevenue: 98.40,
            totalStreams: 24500,
            totalDownloads: 12,
            currencyCode: 'USD',
            byPlatform: [],
            byTerritory: [],
            byRelease: [],
        };

        const result = deriveNextActionFacts({
            releases: [],
            releasesLoading: false,
            earnings: mockEarnings,
            earningsLoading: false,
        });

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('review_earnings');
        expect(result[0].targetModule).toBe('finance');
        expect(result[0].description).toContain('24,500 streams');
        expect(result[0].description).toContain('USD 98.40 net');
    });

    it('ignores earnings with 0 total streams', () => {
        const emptyEarnings: EarningsSummary = {
            period: { startDate: '2026-08-01', endDate: '2026-08-31' },
            totalGrossRevenue: 0,
            totalNetRevenue: 0,
            totalStreams: 0,
            totalDownloads: 0,
            currencyCode: 'USD',
            byPlatform: [],
            byTerritory: [],
            byRelease: [],
        };

        const result = deriveNextActionFacts({
            releases: [],
            releasesLoading: false,
            earnings: emptyEarnings,
            earningsLoading: false,
        });

        expect(result).toHaveLength(0);
    });
});
