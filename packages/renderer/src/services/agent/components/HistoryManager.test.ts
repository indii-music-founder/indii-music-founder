import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStore } from '@/core/store';
import { SummaryService } from '../utils/SummaryService';
import { alwaysOnMemoryEngine } from '../memory/AlwaysOnMemoryEngine';
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

    it('keeps saved memories out of history when the knowledge base is disabled', async () => {
        vi.mocked(useStore.getState).mockReturnValue({
            agentHistory: messages(2), userProfile: { uid: 'user-1' }, isKnowledgeBaseEnabled: false,
        } as ReturnType<typeof useStore.getState>);

        const view = await new HistoryManager().getCompiledView();

        expect(view).toContain('Oldest standing instruction');
        expect(alwaysOnMemoryEngine.retrieve).not.toHaveBeenCalled();
        expect(view).not.toContain('Saved Memories');
    });

    it('labels enabled recent memories without claiming they match the query', async () => {
        vi.mocked(useStore.getState).mockReturnValue({
            agentHistory: messages(2), userProfile: { uid: 'user-1' }, isKnowledgeBaseEnabled: true,
        } as ReturnType<typeof useStore.getState>);
        vi.mocked(alwaysOnMemoryEngine.retrieve).mockResolvedValueOnce([
            { summary: 'Artist prefers analog film visuals', content: 'Saved preference' } as never,
        ]);

        const view = await new HistoryManager().getCompiledView();

        expect(alwaysOnMemoryEngine.retrieve).toHaveBeenCalledWith({ limit: 3 });
        expect(view).toContain('Recent Saved Memories');
        expect(view).toContain('Artist prefers analog film visuals');
        expect(view).not.toContain('Semantic Recall');
    });

    it('exposes only the older-turn summary for direct provider chat', async () => {
        vi.mocked(useStore.getState).mockReturnValue({ agentHistory: messages(40), activeSessionId: 'session-a' } as ReturnType<typeof useStore.getState>);

        const compiled = await new HistoryManager().getCompiledHistory();

        expect(compiled.historicalSummary).toBe('Compressed prior turns');
        expect(compiled.historicalSummary).not.toContain('Turn 39');
        expect(compiled.view).toContain('Turn 39');
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

        expect(await new HistoryManager().getCompiledView()).not.toContain('Conversation Summary (History)');
        expect(SummaryService.summarize).toHaveBeenCalledTimes(1);
    });

    it('does not cache a failed summary as complete history', async () => {
        const manager = new HistoryManager();
        vi.mocked(useStore.getState).mockReturnValue({ agentHistory: messages(30), activeSessionId: 'session-a' } as ReturnType<typeof useStore.getState>);
        vi.mocked(SummaryService.summarize).mockRejectedValueOnce(new Error('summary unavailable'));

        const fallback = await manager.getCompiledView();
        expect(fallback).toContain('Recent Exchange');
        expect(fallback).not.toContain('Conversation Summary (History)');
        await expect(manager.getCompiledView()).resolves.toContain('Compressed prior turns');
        expect(SummaryService.summarize).toHaveBeenCalledTimes(2);
    });
});
