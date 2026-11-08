import { describe, it, expect, beforeEach } from 'vitest';
import { PromptAdditiveTracker } from '../PromptAdditiveTracker';

describe('PromptAdditiveTracker', () => {
    beforeEach(() => {
        PromptAdditiveTracker.resetForTesting();
    });

    it('records and returns frequent additives sorted by usage count', () => {
        PromptAdditiveTracker.recordUsage('Octane Render', 'Engine');
        PromptAdditiveTracker.recordUsage('Cinematic Lighting', 'Lighting');
        PromptAdditiveTracker.recordUsage('Octane Render', 'Engine');
        PromptAdditiveTracker.recordUsage('Velvet', 'Texture');

        const frequent = PromptAdditiveTracker.getFrequentAdditives();
        expect(frequent.length).toBe(3);
        expect(frequent[0].tag).toBe('Octane Render');
        expect(frequent[0].count).toBe(2);
        expect(frequent[0].category).toBe('Engine');

        expect(frequent[1].count).toBe(1);
    });

    it('filters by category when specified', () => {
        PromptAdditiveTracker.recordUsage('Cyberpunk City', 'Environment');
        PromptAdditiveTracker.recordUsage('Warm Golden Hour', 'Lighting');

        const envs = PromptAdditiveTracker.getFrequentAdditives(5, 'Environment');
        expect(envs.length).toBe(1);
        expect(envs[0].tag).toBe('Cyberpunk City');
    });

    it('limits returned results to specified limit', () => {
        for (let i = 1; i <= 10; i++) {
            PromptAdditiveTracker.recordUsage(`Tag ${i}`);
        }

        const top3 = PromptAdditiveTracker.getFrequentAdditives(3);
        expect(top3.length).toBe(3);
    });
});
