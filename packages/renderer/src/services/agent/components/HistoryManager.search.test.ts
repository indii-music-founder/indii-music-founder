import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessions, getDocs } = vi.hoisted(() => ({
    getSessions: vi.fn(),
    getDocs: vi.fn(),
}));
vi.mock('@/services/firebase', () => ({ auth: { currentUser: { uid: 'user1' } }, db: {} }));
vi.mock('../utils/SummaryService', () => ({ SummaryService: { summarize: vi.fn() } }));
vi.mock('../memory/AlwaysOnMemoryEngine', () => ({ alwaysOnMemoryEngine: { retrieve: vi.fn() } }));
vi.mock('@/services/agent/SessionService', () => ({
    sessionService: { getSessionsForUserPaginated: getSessions },
}));
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(() => ({})), orderBy: vi.fn(() => ({})), limit: vi.fn(() => ({})),
    query: vi.fn(() => ({})), getDocs,
}));

import { HistoryManager } from './HistoryManager';

describe('HistoryManager session search', () => {
    beforeEach(() => vi.clearAllMocks());

    it('searches the real message subcollection and reports a match', async () => {
        getSessions.mockResolvedValue({ sessions: [{ id: 'session-1', messageStorage: 'subcollection', messages: [] }], nextCursor: undefined });
        getDocs.mockResolvedValue({ docs: [{ data: () => ({ role: 'user', text: 'Release date is Friday' }) }] });

        const result = await new HistoryManager().searchTranscripts('user1', 'Friday');

        expect(result).toEqual({
            results: [{ sessionId: 'session-1', snippet: '...Release date is Friday...', turnCount: 1 }],
            complete: true, scannedSessions: 1,
        });
        expect(getDocs).toHaveBeenCalledTimes(1);
    });

    it('marks an empty bounded scan incomplete when older sessions exist', async () => {
        getSessions.mockResolvedValue({
            sessions: [{ id: 'session-1', messageStorage: 'subcollection', messages: [] }],
            nextCursor: { updatedAt: 1, id: 'older' },
        });
        getDocs.mockResolvedValue({ docs: [{ data: () => ({ role: 'user', text: 'Another subject' }) }] });

        expect(await new HistoryManager().searchTranscripts('user1', 'Friday')).toEqual({
            results: [], complete: false, scannedSessions: 1,
        });
    });

    it('searches legacy messages and marks a truncated session incomplete', async () => {
        const messages = Array.from({ length: 101 }, (_, index) => ({
            id: `message-${index}`, role: 'user', text: index === 100 ? 'Friday release' : 'Other', timestamp: index,
        }));
        getSessions.mockResolvedValue({ sessions: [{ id: 'legacy-session', messages }], nextCursor: undefined });

        expect(await new HistoryManager().searchTranscripts('user1', 'Friday')).toEqual({
            results: [{ sessionId: 'legacy-session', snippet: '...Friday release...', turnCount: 100 }],
            complete: false, scannedSessions: 1,
        });
        expect(getDocs).not.toHaveBeenCalled();
    });
});
