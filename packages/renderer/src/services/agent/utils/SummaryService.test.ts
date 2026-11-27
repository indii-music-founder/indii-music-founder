import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';
import { SummaryService } from '@/services/agent/utils/SummaryService';

vi.mock('@/services/intelligence/AutonomousIntelligence', () => ({
    AutonomousIntelligence: { generateContent: vi.fn() },
}));

describe('SummaryService', () => {
    beforeEach(() => vi.clearAllMocks());

    it('rejects generation failure instead of silently dropping older history', async () => {
        vi.mocked(AutonomousIntelligence.generateContent).mockRejectedValueOnce(new Error('summary unavailable'));

        await expect(SummaryService.summarize('x'.repeat(600))).rejects.toThrow('summary unavailable');
    });

    it('rejects an empty generated summary', async () => {
        vi.mocked(AutonomousIntelligence.generateContent).mockResolvedValueOnce({
            response: { text: () => '  ' },
        } as Awaited<ReturnType<typeof AutonomousIntelligence.generateContent>>);

        await expect(SummaryService.summarize('x'.repeat(600))).rejects.toThrow('empty summary');
    });
});
