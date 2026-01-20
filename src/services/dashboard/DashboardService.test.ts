import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DashboardService } from './DashboardService';

// Mock the store
vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn()
    }
}));

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
        (useStore.getState as any).mockReturnValue({
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
        (useStore.getState as any).mockReturnValue({
            generatedHistory: mockHistory,
            agentMessages: [],
            projects: []
        });

        const analytics = await DashboardService.getAnalytics();

        // Total generations (images)
        // Index 1 (image), Index 3 (image), Index 4 (image)
        // Total 3 images.
        expect(analytics.totalGenerations).toBe(3);

        // Video seconds: 10 + 5 (default) = 15
        expect(analytics.totalVideoSeconds).toBe(15);

        // Weekly Activity:
        // Index 6: Today (1 item)
        // Index 5: Yesterday (1 item)
        // Index 4: 2 days ago (1 item)
        // Others: 0
        const expectedActivity = [0, 0, 0, 0, 1, 1, 1];
        expect(analytics.weeklyActivity).toEqual(expectedActivity);
    });
});
