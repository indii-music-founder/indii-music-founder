import type { AgentMessage } from '@/core/store';
import { agentRegistry } from '@/services/agent/registry';
import { SummaryService } from '@/services/agent/utils/SummaryService';
import { Logger } from '@/core/logger/Logger';
import { alwaysOnMemoryEngine } from '@/services/agent/memory/AlwaysOnMemoryEngine';
import { readOptionalContext } from '@/services/agent/components/OptionalContext';
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
            ((typeof m.text === 'string' && m.text.trim() !== '') ||
                (Array.isArray(m.attachments) && m.attachments.length > 0))
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
            const role = msg.role === 'user'
                ? 'User'
                : msg.agentId
                    ? `[${agentRegistry.get(msg.agentId)?.name || msg.agentId}]`
                    : 'Assistant';
            const trimmedText = typeof msg.text === 'string' ? msg.text.trim() : '';
            const attachmentSummary = Array.isArray(msg.attachments) && msg.attachments.length > 0
                ? `[Attached: ${msg.attachments.map(att => (
                    att.filename
                        ? `${att.filename} (${att.mimeType || 'file'})`
                        : (att.mimeType || 'file')
                )).join(', ')}]`
                : '';

            if (trimmedText && attachmentSummary) {
                return `${role}: ${msg.text} ${attachmentSummary}`;
            }
            if (attachmentSummary) {
                return `${role}: ${attachmentSummary}`;
            }
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

    async getCompiledHistory(signal?: AbortSignal, room?: { id: string; messages: AgentMessage[] }): Promise<{ view: string; historicalSummary: string; historyWarning?: string }> {
        const { useStore } = await importWithRetry(() => import('@/core/store'));
        const state = useStore.getState();
        signal?.throwIfAborted();
        const userId = state.userProfile?.uid;
        const notices: string[] = [];

        const history = this.cleanHistory(room?.messages ?? state.agentHistory ?? []);

        // Recent saved memories are optional context. The engine's retrieve()
        // currently ignores its query, so do not present these as semantic matches.
        let memoryRecall = '';
        let memoriesUnavailable = false;
        if (userId && state.isKnowledgeBaseEnabled && history.length > 0) {
            const recall = await readOptionalContext('recent saved memories',
                () => alwaysOnMemoryEngine.retrieve({ limit: 3, ...(room ? { sessionId: room.id } : {}) }), 1_000, signal);
            const recent = recall.value || [];
            if (recall.unavailable) {
                Logger.warn('HistoryManager', 'Recent saved memories unavailable:', recall.unavailable);
                notices.push('Recent saved memories are unavailable for this turn.');
                memoriesUnavailable = true;
            }
            if (recent.length > 0) {
                memoryRecall = `\n## Recent Saved Memories\n${recent.map(r => `- ${r.summary || r.content}`).join('\n')}\n`;
            }
        }

        if (history.length <= this.MAX_RECENT_TURNS) {
            return { view: [this.formatHistory(history), memoryRecall, ...notices].filter(Boolean).join('\n').trim(), historicalSummary: notices.join('\n'), historyWarning: notices.length ? 'Saved memories are unavailable for this reply.' : undefined };
        }

        Logger.info('HistoryManager', `Compressing history context (${history.length} turns)`);

        // 2. Split history: [Historical] [Recent Window]
        const recentWindow = history.slice(-this.MAX_RECENT_TURNS);
        const olderTurns = history.slice(0, -this.MAX_RECENT_TURNS);

        // 3. Fold every older turn into a bounded rolling summary. The active
        // store retains the full session; getRecentHistory() is only a display
        // window and must not decide what the summarizer can see.
        // ISSUE-1661: the summary used to be cancelled at the 5 s budget on every
        // send, so a long session never finished (or cached) it and each send
        // started over. It now keeps running in the background, saving progress
        // after each turn; a send that can't wait uses whatever part is done.
        const sessionId = room?.id ?? state.activeSessionId ?? null;
        const result = await readOptionalContext('older conversation summary',
            () => this.summarizeOlder(sessionId, olderTurns),
            5_000, signal);
        const partial = result.unavailable ? this.cachedSummaryPrefix(sessionId, olderTurns) : undefined;
        const summary = result.value || partial?.summary || '';
        if (partial) {
            Logger.info('HistoryManager', `Using a partial summary (${partial.covered} of ${olderTurns.length} older turns); the rest continues in the background`);
            notices.push(`The summary above covers the first ${partial.covered} of ${olderTurns.length} older turns; turns after that and before the recent ${this.MAX_RECENT_TURNS} are not summarized for this turn. Ask the artist to restate any detail from them that the current request needs.`);
        } else if (result.unavailable) {
            Logger.warn('HistoryManager', 'Older conversation summary unavailable:', result.unavailable);
            notices.push(`Older conversation context (${olderTurns.length} turns) is unavailable for this turn. Only the recent ${this.MAX_RECENT_TURNS} turns below are available. Do not infer earlier instructions, approvals, facts, or completion; ask the artist to restate any earlier detail needed for the current request.`);
        }
        const historicalSummary = [summary, ...notices].filter(Boolean).join('\n');
        const olderContextMissing = Boolean(result.unavailable) && !partial;

        // 4. Assemble view
        const formattedRecent = this.formatHistory(recentWindow);

        return { view: `
${summary ? '## Conversation Summary (History)\n' + summary : ''}
${notices.join('\n')}
${memoryRecall}
## Recent Exchange (Last ${this.MAX_RECENT_TURNS} turns)
${formattedRecent}
`.trim(), historicalSummary, historyWarning: olderContextMissing
            ? 'Earlier conversation context is unavailable for this reply. Restate any earlier details needed for this request.'
            : memoriesUnavailable ? 'Saved memories are unavailable for this reply.' : undefined };
    }

    /** The cached summary for this session if it covers a prefix of `olderTurns`. */
    private cachedSummaryPrefix(sessionId: string | null, olderTurns: AgentMessage[]): { summary: string; covered: number } | undefined {
        const cache = this.summaryCache;
        if (!cache || cache.sessionId !== sessionId || !cache.summary || cache.source.length === 0) return undefined;
        if (!this.isPrefixOf(cache.source, olderTurns)) return undefined;
        return { summary: cache.summary, covered: cache.source.length };
    }

    private isPrefixOf(source: Array<Pick<AgentMessage, 'id' | 'role' | 'text'>>, turns: AgentMessage[]): boolean {
        return source.length <= turns.length && source.every((message, index) => {
            const current = turns[index];
            return current?.id === message.id && current.role === message.role && current.text === message.text;
        });
    }

    private summarizeOlder(sessionId: string | null, olderTurns: AgentMessage[], signal?: AbortSignal): Promise<string> {
        const work = this.summaryQueue.then(async () => {
            signal?.throwIfAborted();
            const cache = this.summaryCache;
            const reusable = cache?.sessionId === sessionId && this.isPrefixOf(cache.source, olderTurns);
            let covered = reusable ? cache.source.length : 0;
            let summary = reusable ? cache.summary : '';
            const save = (count: number) => {
                this.summaryCache = {
                    sessionId,
                    source: olderTurns.slice(0, count).map(({ id, role, text }) => ({ id, role, text })),
                    summary,
                };
            };
            const prefixFor = () => summary ? `Prior conversation summary:\n${summary}\n\nFurther conversation:\n` : '';
            const fold = async (text: string) => {
                signal?.throwIfAborted();
                summary = await SummaryService.summarize(prefixFor() + text, signal);
                signal?.throwIfAborted();
            };

            // Fold whole turns, so progress can be saved after each one and a
            // later send continues from there instead of starting over.
            let buffer = '';
            let bufferEnd = covered;
            for (let index = covered; index < olderTurns.length; index++) {
                const turnText = this.formatHistory([olderTurns[index]!]) + '\n';
                const available = this.SUMMARY_INPUT_CHARS - prefixFor().length;
                if (available <= 0) throw new Error('Conversation summary exceeds the summarizer input budget.');
                if (buffer.length + turnText.length <= available) {
                    buffer += turnText;
                    bufferEnd = index + 1;
                    continue;
                }
                if (buffer) {
                    await fold(buffer);
                    covered = bufferEnd;
                    save(covered);
                    buffer = '';
                }
                // A single turn longer than the budget is folded in pieces.
                const roomNow = this.SUMMARY_INPUT_CHARS - prefixFor().length;
                if (turnText.length <= roomNow) {
                    buffer = turnText;
                    bufferEnd = index + 1;
                    continue;
                }
                for (let offset = 0; offset < turnText.length;) {
                    const room = this.SUMMARY_INPUT_CHARS - prefixFor().length;
                    if (room <= 0) throw new Error('Conversation summary exceeds the summarizer input budget.');
                    const piece = turnText.slice(offset, offset + room);
                    await fold(piece);
                    offset += piece.length;
                }
                covered = index + 1;
                save(covered);
            }
            if (buffer) {
                await fold(buffer);
                covered = bufferEnd;
            }
            save(covered);
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
