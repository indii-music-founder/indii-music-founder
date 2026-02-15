import type { AgentMessage } from '@/core/store';
import { SummaryService } from '../utils/SummaryService';
import { Logger } from '@/core/logger/Logger';

/**
 * HistoryManager: Manages the "Active Memory" of a conversation.
 * 
 * Implements Indii Tier 2 Memory Architecture:
 * 1. Sliding window for high-fidelity recent context.
 * 2. Automatic summarization of older turns via Gemini 3 Flash.
 * 3. Prevention of context window saturation.
 */
export class HistoryManager {
    // High-fidelity turns kept in full
    private readonly MAX_RECENT_TURNS = 15;
    // Threshold before we trigger summarization logic
    private readonly MAX_TOTAL_TURNS = 25;

    /**
     * Retrieves the recent conversation history from the store.
     */
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
        const cleanHistory = agentHistory.filter(m =>
            (m.role === 'user' || m.role === 'model') &&
            m.text &&
            m.text.trim() !== ''
        );

        return cleanHistory;
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
     * Uses a sliding window for recent messages and summarizes the middle-history.
     */
    /**
     * Creates a "Compiled View" of the history.
     * Uses a sliding window for recent messages and summarizes history beyond the threshold.
     * 
     * @returns A promise resolving to the compiled history string for LLM context.
     */
    async getCompiledView(): Promise<string> {
        const history = await this.getRecentHistory();

        if (history.length <= this.MAX_RECENT_TURNS) {
            return this.formatHistory(history);
        }

        Logger.info('HistoryManager', `Compressing history context (${history.length} turns)`);

        // 1. Split history: [Historical] [Recent Window]
        const recentWindow = history.slice(-this.MAX_RECENT_TURNS);
        const olderTurns = history.slice(0, -this.MAX_RECENT_TURNS);

        // 2. Summarize older turns
        const historicalText = this.formatHistory(olderTurns);
        const summary = await SummaryService.summarize(historicalText);

        // 3. Assemble view
        const formattedRecent = this.formatHistory(recentWindow);

        return `
## Conversation Summary (History)
${summary}

## Recent Exchange (Last ${this.MAX_RECENT_TURNS} turns)
${formattedRecent}
`.trim();
    }
}
