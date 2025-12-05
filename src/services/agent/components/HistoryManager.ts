import { useStore, AgentMessage } from '@/core/store';

export class HistoryManager {
    private readonly MAX_HISTORY_LENGTH = 10;

    /**
     * Retrieves the recent conversation history from the store.
     * Filters out system messages that are purely internal logs if necessary.
     */
    getRecentHistory(): AgentMessage[] {
        const { agentHistory } = useStore.getState();
        // Get the last N messages
        return agentHistory.slice(-this.MAX_HISTORY_LENGTH);
    }

    /**
     * Formats the history into a string suitable for LLM context.
     * Uses a "Transcript" format.
     */
    formatHistory(messages: AgentMessage[]): string {
        if (messages.length === 0) return '';

        return messages.map(msg => {
            const role = msg.role === 'user' ? 'User' : 'Assistant';
            return `${role}: ${msg.text}`;
        }).join('\n');
    }

    /**
     * Creates a "Compiled View" of the history, potentially summarizing older turns
     * (Placeholder for future optimization)
     */
    getCompiledView(): string {
        const history = this.getRecentHistory();
        return this.formatHistory(history);
    }
}
