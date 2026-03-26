import type { AgentMessage } from '@/core/store';
import { SummaryService } from '../utils/SummaryService';
import { Logger } from '@/core/logger/Logger';
import { memoryService } from '../MemoryService';

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

    /**
     * Retrieves the recent conversation history from the store.
     * Filters for clean user/model messages.
     * 
     * @returns A promise resolving to the list of clean agent messages.
     */
    async getRecentHistory(): Promise<AgentMessage[]> {
        const { useStore } = await import('@/core/store');
        const { agentHistory } = useStore.getState();

        // Filter out system messages and internal logs for the conversation window
        const cleanHistory = (agentHistory || []).filter(m =>
            (m.role === 'user' || m.role === 'model') &&
            m.text &&
            m.text.trim() !== ''
        );

        // Get the last N messages
        return cleanHistory.slice(-this.MAX_TOTAL_TURNS);
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
        const { useStore } = await import('@/core/store');
        const state = useStore.getState();
        const projectId = state.currentProjectId;
        const sessionId = state.activeSessionId;

        const history = await this.getRecentHistory();

        // 1. Semantic Recall (Tier 2 Integration)
        let semanticRecall = '';
        if (projectId && sessionId && history.length > 0) {
            const lastMessage = history[history.length - 1]!.text;
            const relevant = await memoryService.retrieveRelevantMemories(projectId, {
                query: lastMessage,
                filters: { sessionId, types: ['session_message', 'fact'] },
                limit: 3
            });
            if (relevant.length > 0) {
                semanticRecall = `\n## Relevant Past Context (Semantic Recall)\n${relevant.map(r => `- ${r}`).join('\n')}\n`;
            }
        }

        if (history.length <= this.MAX_RECENT_TURNS) {
            return (this.formatHistory(history) + semanticRecall).trim();
        }

        Logger.info('HistoryManager', `Compressing history context (${history.length} turns)`);

        // 2. Split history: [Historical] [Recent Window]
        const recentWindow = history.slice(-this.MAX_RECENT_TURNS);
        const olderTurns = history.slice(0, -this.MAX_RECENT_TURNS);

        // 3. Summarize older turns
        const historicalText = this.formatHistory(olderTurns);
        const summary = await SummaryService.summarize(historicalText);

        // 4. Assemble view
        const formattedRecent = this.formatHistory(recentWindow);

        return `
## Conversation Summary (History)
${summary}
${semanticRecall}
## Recent Exchange (Last ${this.MAX_RECENT_TURNS} turns)
${formattedRecent}
`.trim();
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

            const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
            const { db } = await import('@/services/firebase');

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
        } catch (error) {
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
    ): Promise<Array<{ sessionId: string; snippet: string; turnCount: number }>> {
        if (!userId || !query) return [];

        try {
            const { collection, getDocs, orderBy, query: firestoreQuery, limit: firestoreLimit } = await import('firebase/firestore');
            const { db } = await import('@/services/firebase');

            // Firestore doesn't support full-text search, so we fetch recent transcripts
            // and filter client-side. For production, this would be backed by a search index.
            const collRef = collection(db, `users/${userId}/session_transcripts`);
            const q = firestoreQuery(collRef, orderBy('savedAt', 'desc'), firestoreLimit(20));
            const snap = await getDocs(q);

            const results: Array<{ sessionId: string; snippet: string; turnCount: number }> = [];
            const queryLower = query.toLowerCase();

            snap.docs.forEach(docSnap => {
                const data = docSnap.data();
                const transcript = (data.transcript || '') as string;
                if (transcript.toLowerCase().includes(queryLower)) {
                    // Extract a snippet around the match
                    const idx = transcript.toLowerCase().indexOf(queryLower);
                    const start = Math.max(0, idx - 100);
                    const end = Math.min(transcript.length, idx + query.length + 100);
                    const snippet = transcript.substring(start, end);

                    results.push({
                        sessionId: data.sessionId as string,
                        snippet: `...${snippet}...`,
                        turnCount: data.turnCount as number || 0,
                    });
                }
            });

            return results.slice(0, limit);
        } catch (error) {
            Logger.warn('HistoryManager', 'Failed to search transcripts:', error);
            return [];
        }
    }
}
