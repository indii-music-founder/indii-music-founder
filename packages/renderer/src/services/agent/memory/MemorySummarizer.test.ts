import { describe, expect, it, vi } from 'vitest';
import { logger } from '@/utils/logger';
import { MemorySummarizer } from './MemorySummarizer';

const generateText = vi.hoisted(() => vi.fn());
vi.mock('../../intelligence/FirebaseIntelligenceService', () => ({
    FirebaseIntelligenceService: { getInstance: () => ({ generateText }) },
}));

describe('MemorySummarizer parse diagnostics', () => {
    it('keeps malformed memory output out of logs while returning the fallback', async () => {
        const rawResponse = 'private-memory-output-do-not-log';
        generateText.mockResolvedValue(rawResponse);
        const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
        try {
            expect(await MemorySummarizer.extractEntities('artist note')).toEqual([]);
            expect(JSON.stringify(warn.mock.calls)).not.toContain(rawResponse);
        } finally {
            warn.mockRestore();
        }
    });

    it('distinguishes synthesis failures from a valid empty insight', async () => {
        const memories = [{ id: 'first', content: 'First' }, { id: 'second', content: 'Second' }] as never[];
        generateText.mockRejectedValueOnce(new Error('Provider unavailable'));
        await expect(MemorySummarizer.generateInsight('user-1', memories)).rejects.toThrow('Provider unavailable');
        generateText.mockResolvedValueOnce('Invalid response');
        await expect(MemorySummarizer.generateInsight('user-1', memories)).rejects.toThrow('invalid response');
        generateText.mockResolvedValueOnce('{"insights":[],"connections":[]}');
        await expect(MemorySummarizer.generateInsight('user-1', memories)).resolves.toBeNull();
    });

    it('ISSUE-1587: generateInsight derives numeric top-level confidence when omitted by model and uses temperature 1.0', async () => {
        generateText.mockResolvedValueOnce(JSON.stringify({
            connections: [
                { fromId: 'mem-1', toId: 'mem-2', relationship: 'causal', confidence: 0.9 },
            ],
            insights: ['Artist combines dark analog synths with noir visual direction.'],
        }));

        const insight = await MemorySummarizer.generateInsight('user-1', [
            { id: 'mem-1', content: 'Uses Prophet-6 dark patches' } as never,
            { id: 'mem-2', content: 'Prefers high-contrast noir album art' } as never,
        ]);

        expect(insight).not.toBeNull();
        expect(insight?.confidence).toBeCloseTo(0.9);
        expect(insight?.connections[0]?.confidence).toBeCloseTo(0.9);
        expect(insight?.insight).toContain('dark analog synths');
        expect(generateText).toHaveBeenLastCalledWith(
            expect.any(String),
            0,
            expect.objectContaining({
                temperature: 1.0,
                responseMimeType: 'application/json',
            }),
        );
    });
});
