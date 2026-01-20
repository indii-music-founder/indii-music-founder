import { describe, it, expect, vi, beforeEach } from 'vitest';
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
});
