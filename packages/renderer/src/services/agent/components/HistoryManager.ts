import type { AgentMessage } from '@/core/store';
import { SummaryService } from '../utils/SummaryService';
import { Logger } from '@/core/logger/Logger';
import { alwaysOnMemoryEngine } from '../memory/AlwaysOnMemoryEngine';
import { importWithRetry } from '@/utils/dynamicImport';

/**
 * HistoryManager: Manages the "Active Memory" of a conversation.
 * 
 * Implements Indii Tier 2 Memory Architecture:
 * 1. Sliding window for high-fidelity recent context.
 * 2. Automatic summarization of older turns via Gemini 3 Flash.
 * 3. Prevention of context window saturation.
 * 4. Semantic retrieval of relevant past exchanges (episodic memory).
 */
export class HistoryManager {
    // High-fidelity turns kept in full
    private readonly MAX_RECENT_TURNS = 15;
    // Threshold before we trigger summarization logic
    private readonly MAX_TOTAL_TURNS = 25;
    private readonly SUMMARY_INPUT_CHARS = 8_000;
    private summaryCache: {
        sessionId: string | null;
        source: Array<Pick<AgentMessage, 'id' | 'role' | 'text'>>;
        summary: string;
    } | null = null;
    private summaryQueue: Promise<void> = Promise.resolve();

    private cleanHistory(history: AgentMessage[]): AgentMessage[] {
        return history.filter(m =>
            (m.role === 'user' || m.role === 'model') &&
            m.text && m.text.trim() !== ''
        );
    }

    /**
     * Retrieves the recent conversation history from the store.
     * Filters for clean user/model messages.
     * 
     * @returns A promise resolving to the list of clean agent messages.
     */
    async getRecentHistory(): Promise<AgentMessage[]> {
        const { useStore } = await importWithRetry(() => import('@/core/store'));
        const state = useStore.getState();

        // Get the last N messages
        return this.cleanHistory(state.agentHistory || []).slice(-this.MAX_TOTAL_TURNS);
    }

    /**
     * Formats the history into a string suitable for LLM context.
     */
    formatHistory(messages: AgentMessage[]): string {
        if (messages.length === 0) return '';

        return messages.map(msg => {
            const role = msg.role === 'user' ? 'User' : 'Assistant';
            return `${role}: ${msg.text}`;
        }).join('\n');
    }

    /**
     * Creates a "Compiled View" of the history.
     * Uses a sliding window for recent messages and summarizes history beyond the threshold.
     * 
     * @returns A promise resolving to the compiled history string for LLM context.
     */
    async getCompiledView(): Promise<string> {
        return (await this.getCompiledHistory()).view;
    }

    async getCompiledHistory(): Promise<{ view: string; historicalSummary: string }> {
        const { useStore } = await importWithRetry(() => import('@/core/store'));
        const state = useStore.getState();
        const userId = state.userProfile?.uid;

        const history = this.cleanHistory(state.agentHistory || []);

        // Recent saved memories are optional context. The engine's retrieve()
        // currently ignores its query, so do not present these as semantic matches.
        let memoryRecall = '';
        if (userId && state.isKnowledgeBaseEnabled && history.length > 0) {
            const recent = await alwaysOnMemoryEngine.retrieve({ limit: 3 });
            if (recent.length > 0) {
                memoryRecall = `\n## Recent Saved Memories\n${recent.map(r => `- ${r.summary || r.content}`).join('\n')}\n`;
            }
        }

        if (history.length <= this.MAX_RECENT_TURNS) {
            return { view: (this.formatHistory(history) + memoryRecall).trim(), historicalSummary: '' };
        }

        Logger.info('HistoryManager', `Compressing history context (${history.length} turns)`);

        // 2. Split history: [Historical] [Recent Window]
        const recentWindow = history.slice(-this.MAX_RECENT_TURNS);
        const olderTurns = history.slice(0, -this.MAX_RECENT_TURNS);

        // 3. Fold every older turn into a bounded rolling summary. The active
        // store retains the full session; getRecentHistory() is only a display
        // window and must not decide what the summarizer can see.
        const summary = await this.summarizeOlder(state.activeSessionId || null, olderTurns)
            .catch(() => '');

        // 4. Assemble view
        const formattedRecent = this.formatHistory(recentWindow);

        return { view: `
${summary ? '## Conversation Summary (History)\n' + summary : ''}
${memoryRecall}
## Recent Exchange (Last ${this.MAX_RECENT_TURNS} turns)
${formattedRecent}
`.trim(), historicalSummary: summary };
    }

    private summarizeOlder(sessionId: string | null, olderTurns: AgentMessage[]): Promise<string> {
        const work = this.summaryQueue.then(async () => {
            const cache = this.summaryCache;
            const reusable = cache?.sessionId === sessionId
                && cache.source.length <= olderTurns.length
                && cache.source.every((message, index) => {
                    const current = olderTurns[index];
                    return current?.id === message.id && current.role === message.role && current.text === message.text;
                });
            const summarizedCount = reusable ? cache.source.length : 0;
            let summary = reusable ? cache.summary : '';
            const newHistory = this.formatHistory(olderTurns.slice(summarizedCount));

            for (let offset = 0; offset < newHistory.length;) {
                const prefix = summary ? `Prior conversation summary:\n${summary}\n\nFurther conversation:\n` : '';
                const available = this.SUMMARY_INPUT_CHARS - prefix.length;
                if (available <= 0) throw new Error('Conversation summary exceeds the summarizer input budget.');
                const chunk = newHistory.slice(offset, offset + available);
                summary = await SummaryService.summarize(prefix + chunk);
                offset += chunk.length;
            }

            this.summaryCache = {
                sessionId,
                source: olderTurns.map(({ id, role, text }) => ({ id, role, text })),
                summary,
            };
            return summary;
        });
        this.summaryQueue = work.then(() => undefined, () => undefined);
        return work;
    }

    /**
     * Persist the current session transcript to Firestore for durable storage.
     * Allows cross-session transcript search via the Squeezer.
     *
     * Storage: `users/{userId}/session_transcripts/{sessionId}`
     */
    async persistTranscript(userId: string, sessionId: string): Promise<void> {
        if (!userId || !sessionId) return;

        try {
            const history = await this.getRecentHistory();
            if (history.length === 0) return;

            const { doc, setDoc, serverTimestamp } = await importWithRetry(() => import('firebase/firestore'));
            const { db } = await importWithRetry(() => import('@/services/firebase'));

            const transcript = this.formatHistory(history);
            const docRef = doc(db, `users/${userId}/session_transcripts/${sessionId}`);

            await setDoc(docRef, {
                sessionId,
                userId,
                transcript,
                turnCount: history.length,
                firstTurn: history[0]?.text?.substring(0, 100) || '',
                lastTurn: history[history.length - 1]?.text?.substring(0, 100) || '',
                savedAt: serverTimestamp(),
            }, { merge: true });

            Logger.info('HistoryManager', `Persisted transcript (${history.length} turns) for session ${sessionId}`);
        } catch (error: unknown) {
            Logger.warn('HistoryManager', 'Failed to persist transcript (non-blocking):', error);
        }
    }

    /**
     * Search past session transcripts by keyword.
     * Returns matching transcript snippets with session metadata.
     */
    async searchTranscripts(
        userId: string,
        query: string,
        limit: number = 5
    ): Promise<{ results: Array<{ sessionId: string; snippet: string; turnCount: number }>; complete: boolean; scannedSessions: number }> {
        const empty = { results: [], complete: true, scannedSessions: 0 };
        if (!userId || !query.trim()) return empty;

        const { auth, db } = await importWithRetry(() => import('@/services/firebase'));
        if (auth.currentUser?.uid !== userId) throw new Error('Session search requires the signed-in account.');
        const { sessionService } = await importWithRetry(() => import('@/services/agent/SessionService'));
        const { collection, getDocs, orderBy, query: firestoreQuery, limit: firestoreLimit } = await importWithRetry(() => import('firebase/firestore'));
        const { sessions, nextCursor } = await sessionService.getSessionsForUserPaginated(undefined, 20);
        const results: Array<{ sessionId: string; snippet: string; turnCount: number }> = [];
        const needle = query.toLowerCase();
        const resultLimit = Math.min(10, Math.max(1, Math.trunc(limit) || 5));
        let complete = !nextCursor;
        let scannedSessions = 0;

        for (const session of sessions) {
            scannedSessions++;
            let messages: AgentMessage[];
            if (session.messageStorage === 'subcollection') {
                const q = firestoreQuery(
                    collection(db, 'sessions', session.id, 'messages'),
                    orderBy('timestamp', 'desc'), firestoreLimit(101),
                );
                const snapshot = await getDocs(q);
                if (snapshot.docs.length > 100) complete = false;
                messages = snapshot.docs.slice(0, 100).map(item => item.data() as AgentMessage);
            } else {
                const legacy = session.messages || [];
                if (legacy.length > 100) complete = false;
                messages = legacy.slice(-100);
            }
            const matching = messages.find(message =>
                typeof message.text === 'string' && message.text.toLowerCase().includes(needle));
            if (matching) {
                const index = matching.text.toLowerCase().indexOf(needle);
                results.push({
                    sessionId: session.id,
                    snippet: `...${matching.text.slice(Math.max(0, index - 100), index + query.length + 100)}...`,
                    turnCount: messages.length,
                });
            }
            if (results.length >= resultLimit) {
                if (scannedSessions < sessions.length) complete = false;
                break;
            }
        }
        return { results, complete, scannedSessions };
    }
}
