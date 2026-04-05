import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DashboardService } from './DashboardService';
import { SalesAnalyticsData } from './schema';

// Mock the store
vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn()
    }
}));

// Define local mock data for testing positive cases
const TEST_ANALYTICS_DATA: SalesAnalyticsData = {
    conversionRate: { value: 2.5, trend: 'up', formatted: '2.5%' },
    totalVisitors: { value: 1000, trend: 'up', formatted: '1,000' },
    clickRate: { value: 5.0, trend: 'neutral', formatted: '5.0%' },
    avgOrderValue: { value: 50, trend: 'down', formatted: '$50.00' },
    revenueChart: [10, 20, 30, 40, 50],
    period: '30d',
    lastUpdated: 1234567890
};

describe('DashboardService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('getAnalytics calculates word counts correctly', async () => {
        const mockHistory = [
            { prompt: 'cool beautiful amazing', type: 'image', timestamp: Date.now() },
            { prompt: 'beautiful elephant', type: 'image', timestamp: Date.now() },
            { prompt: 'cool amazing beautiful', type: 'image', timestamp: Date.now() },
            { prompt: 'the a an with', type: 'image', timestamp: Date.now() }, // Stop words
            { prompt: 'wow' }, // Length 3, should be ignored
        ] as any[];

        const { useStore } = await import('@/core/store');
        (useStore.getState as import("vitest").Mock).mockReturnValue({
            generatedHistory: mockHistory,
            agentMessages: [],
            projects: []
        });

        const analytics = await DashboardService.getAnalytics();

        // 4 items have type 'image', one is undefined (defaults to undefined, filtered out by h.type === 'image')
        expect(analytics.totalGenerations).toBe(4);

        const topWords = analytics.topPromptWords;

        // beautiful: 3
        // cool: 2
        // amazing: 2
        // elephant: 1

        const beautiful = topWords.find(w => w.word === 'beautiful');
        expect(beautiful).toBeDefined();
        expect(beautiful?.count).toBe(3);

        const cool = topWords.find(w => w.word === 'cool');
        expect(cool).toBeDefined();
        expect(cool?.count).toBe(2);

        const elephant = topWords.find(w => w.word === 'elephant');
        expect(elephant).toBeDefined();
        expect(elephant?.count).toBe(1);

        const wow = topWords.find(w => w.word === 'wow');
        expect(wow).toBeUndefined();

        const withWord = topWords.find(w => w.word === 'with');
        expect(withWord).toBeUndefined(); // stop word
    });

    it('getAnalytics calculates video stats and weekly activity correctly', async () => {
        const now = 1700000000000;
        vi.setSystemTime(now);

        const dayMs = 24 * 60 * 60 * 1000;

        const mockHistory = [
            // Today (0 days ago) - Video 10s
            { type: 'video', timestamp: now, duration: 10, prompt: 'video' },
            // Yesterday (1 day ago) - Image
            { type: 'image', timestamp: now - dayMs, prompt: 'image' },
            // 2 days ago - Video 5s (default) - no duration prop
            { type: 'video', timestamp: now - 2 * dayMs, prompt: 'short video' },
            // 7 days ago - Should be excluded from weekly activity (7 * 24h exactly might be edge case depending on math)
            // Math.floor((now - (now - 7 * dayMs)) / dayMs) = 7. So excluded.
            { type: 'image', timestamp: now - 7 * dayMs - 100, prompt: 'old' },
            // Future - Should be ignored?
            // Math.floor((now - (now + dayMs)) / dayMs) = -1. Excluded.
            { type: 'image', timestamp: now + dayMs, prompt: 'future' },
        ] as any[];

        const { useStore } = await import('@/core/store');
        (useStore.getState as import("vitest").Mock).mockReturnValue({
            generatedHistory: mockHistory,
            agentMessages: [],
            projects: []
        });

        const analytics = await DashboardService.getAnalytics();

        expect(analytics.totalGenerations).toBe(3);
        expect(analytics.totalVideoSeconds).toBe(15);

        const expectedActivity = [0, 0, 0, 0, 1, 1, 1];
        expect(analytics.weeklyActivity).toEqual(expectedActivity);
    });

    it('getSalesAnalytics fetches from API and caches result', async () => {
        const mockData = { ...TEST_ANALYTICS_DATA, totalVisitors: { value: 9999, trend: 'up' as const, formatted: '9,999' } };

        // Mock global.fetch
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => mockData
        });
        global.fetch = fetchMock;

        // Mock env variable
        vi.stubEnv('VITE_API_URL', 'https://api.example.com');

        const { useStore } = await import('@/core/store');
        (useStore.getState as import("vitest").Mock).mockReturnValue({ userProfile: { id: 'test-user' } });

        // First call
        const result1 = await DashboardService.getSalesAnalytics('30d');
        expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/api/analytics/sales?period=30d');
        expect(result1.totalVisitors.value).toBe(9999);

        // Second call (should be cached)
        fetchMock.mockClear();
        const result2 = await DashboardService.getSalesAnalytics('30d');
        expect(fetchMock).not.toHaveBeenCalled();
        expect(result2.totalVisitors.value).toBe(9999);
    });

    it('getSalesAnalytics falls back to zero state on fetch failure', async () => {
        // Mock global.fetch to fail
        const fetchMock = vi.fn().mockRejectedValue(new Error('Network Error'));
        global.fetch = fetchMock;

        vi.stubEnv('VITE_API_URL', 'https://api.example.com');

        // Use a different period to avoid cache from previous test
        const result = await DashboardService.getSalesAnalytics('90d');

        // Should return ZERO state, NOT mock data
        expect(result.conversionRate.value).toBe(0);
        expect(result.totalVisitors.value).toBe(0);
        expect(result.period).toBe('90d');
        expect(fetchMock).toHaveBeenCalled();
    });

    describe('getProjects', () => {
        it('should return empty array if store is empty and loadProjects fails or returns nothing', async () => {
            const mockLoadProjects = vi.fn();
            const { useStore } = await import('@/core/store');
            (useStore.getState as import("vitest").Mock).mockReturnValue({
                projects: [],
                loadProjects: mockLoadProjects,
            });

            const projects = await DashboardService.getProjects();
            expect(projects).toEqual([]);
            expect(mockLoadProjects).toHaveBeenCalled();
        });

        it('should call loadProjects if projects are empty, then return populated projects', async () => {
            const mockLoadProjects = vi.fn();
            const { useStore } = await import('@/core/store');

            // First call returns empty, triggers load
            (useStore.getState as import("vitest").Mock).mockReturnValueOnce({
                projects: [],
                loadProjects: mockLoadProjects,
            });

            // Second call (after await loadProjects) returns populated
            (useStore.getState as import("vitest").Mock).mockReturnValueOnce({
                projects: [
                    { id: '1', name: 'Test Project', date: 1000, assetCount: 5, thumbnail: 'thumb.jpg' }
                ],
                loadProjects: mockLoadProjects,
            });

            const projects = await DashboardService.getProjects();

            expect(mockLoadProjects).toHaveBeenCalled();
            expect(projects).toHaveLength(1);
            expect(projects[0]).toEqual({
                id: '1',
                name: 'Test Project',
                type: 'creative',
                lastModified: 1000,
                assetCount: 5,
                thumbnail: 'thumb.jpg'
            });
        });

        it('should return cached projects without calling loadProjects if they exist', async () => {
            const mockLoadProjects = vi.fn();
            const { useStore } = await import('@/core/store');
            (useStore.getState as import("vitest").Mock).mockReturnValue({
                projects: [
                    { id: '1', name: 'Cached Project', date: 2000 }
                ],
                loadProjects: mockLoadProjects,
            });

            const projects = await DashboardService.getProjects();

            expect(mockLoadProjects).not.toHaveBeenCalled();
            expect(projects).toHaveLength(1);
            expect(projects[0]!.name).toBe('Cached Project');
        });
    });
});
