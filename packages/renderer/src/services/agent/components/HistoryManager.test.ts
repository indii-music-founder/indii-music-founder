import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStore } from '@/core/store';
import { SummaryService } from '../utils/SummaryService';
import { HistoryManager } from './HistoryManager';

vi.mock('@/core/store', () => ({ useStore: { getState: vi.fn() } }));
vi.mock('../utils/SummaryService', () => ({ SummaryService: { summarize: vi.fn() } }));
vi.mock('../memory/AlwaysOnMemoryEngine', () => ({
    alwaysOnMemoryEngine: { retrieve: vi.fn().mockResolvedValue([]) },
}));

const messages = (count: number) => Array.from({ length: count }, (_, index) => ({
    id: `message-${index}`,
    role: index % 2 === 0 ? 'user' as const : 'model' as const,
    text: index === 0 ? 'Oldest standing instruction' : `Turn ${index}`,
    timestamp: index,
}));

describe('HistoryManager compaction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(SummaryService.summarize).mockImplementation(async () => 'Compressed prior turns');
    });

    it('includes turns older than the recent 25 in the summary input', async () => {
        vi.mocked(useStore.getState).mockReturnValue({ agentHistory: messages(40), activeSessionId: 'session-a' } as ReturnType<typeof useStore.getState>);

        const view = await new HistoryManager().getCompiledView();

        expect(vi.mocked(SummaryService.summarize).mock.calls[0]?.[0]).toContain('Oldest standing instruction');
        expect(view).toContain('Compressed prior turns');
        expect(view).toContain('Turn 39');
    });

    it('summarizes only newly aged turns until the session or an old turn changes', async () => {
        const manager = new HistoryManager();
        let history = messages(30);
        vi.mocked(useStore.getState).mockImplementation(() => ({ agentHistory: history, activeSessionId: 'session-a' }) as ReturnType<typeof useStore.getState>);

        await manager.getCompiledView();
        await manager.getCompiledView();
        expect(SummaryService.summarize).toHaveBeenCalledTimes(1);

        history = messages(31);
        await manager.getCompiledView();
        expect(SummaryService.summarize).toHaveBeenCalledTimes(2);
        expect(vi.mocked(SummaryService.summarize).mock.calls[1]?.[0]).toContain('Prior conversation summary');
        expect(vi.mocked(SummaryService.summarize).mock.calls[1]?.[0]).toContain('Turn 15');

        history = messages(31).map((message, index) => index === 0 ? { ...message, text: 'Revised oldest instruction' } : message);
        await manager.getCompiledView();
        expect(vi.mocked(SummaryService.summarize).mock.calls[2]?.[0]).toContain('Revised oldest instruction');
    });

    it('bounds each summarizer input for a long session', async () => {
        const history = messages(17).map((message, index) => index === 0 ? { ...message, text: 'x'.repeat(18_000) } : message);
        vi.mocked(useStore.getState).mockReturnValue({ agentHistory: history, activeSessionId: 'session-a' } as ReturnType<typeof useStore.getState>);

        await new HistoryManager().getCompiledView();

        expect(SummaryService.summarize).toHaveBeenCalledTimes(3);
        for (const [input] of vi.mocked(SummaryService.summarize).mock.calls) {
            expect(input.length).toBeLessThan(8_100);
        }
    });

    it('counts the prior summary against every later summarizer input', async () => {
        const history = messages(17).map((message, index) => index === 0 ? { ...message, text: 'x'.repeat(18_000) } : message);
        vi.mocked(useStore.getState).mockReturnValue({ agentHistory: history, activeSessionId: 'session-a' } as ReturnType<typeof useStore.getState>);
        vi.mocked(SummaryService.summarize).mockResolvedValue('s'.repeat(1_000));

        await new HistoryManager().getCompiledView();

        expect(SummaryService.summarize).toHaveBeenCalledTimes(3);
        for (const [input] of vi.mocked(SummaryService.summarize).mock.calls) {
            expect(input.length).toBeLessThanOrEqual(8_000);
        }
    });

    it('does not silently truncate an upstream summary that cannot fit', async () => {
        const history = messages(17).map((message, index) => index === 0 ? { ...message, text: 'x'.repeat(18_000) } : message);
        vi.mocked(useStore.getState).mockReturnValue({ agentHistory: history, activeSessionId: 'session-a' } as ReturnType<typeof useStore.getState>);
        vi.mocked(SummaryService.summarize).mockResolvedValue('s'.repeat(8_000));

        await expect(new HistoryManager().getCompiledView()).rejects.toThrow('Conversation summary exceeds the summarizer input budget.');
        expect(SummaryService.summarize).toHaveBeenCalledTimes(1);
    });

    it('does not cache a failed summary as complete history', async () => {
        const manager = new HistoryManager();
        vi.mocked(useStore.getState).mockReturnValue({ agentHistory: messages(30), activeSessionId: 'session-a' } as ReturnType<typeof useStore.getState>);
        vi.mocked(SummaryService.summarize).mockRejectedValueOnce(new Error('summary unavailable'));

        await expect(manager.getCompiledView()).rejects.toThrow('summary unavailable');
        await expect(manager.getCompiledView()).resolves.toContain('Compressed prior turns');
        expect(SummaryService.summarize).toHaveBeenCalledTimes(2);
    });
});
