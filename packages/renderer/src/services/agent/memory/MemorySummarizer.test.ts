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
});
