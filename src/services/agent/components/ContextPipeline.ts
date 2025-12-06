import { ContextResolver, AgentContext } from './ContextResolver';
import { HistoryManager } from './HistoryManager';
import { memoryService } from '../MemoryService';

export interface PipelineContext extends AgentContext {
    chatHistoryString: string;
    relevantMemories: string[];
    memoryContext: string;
}

export class ContextPipeline {
    private resolver: ContextResolver;
    private historyManager: HistoryManager;

    constructor() {
        this.resolver = new ContextResolver();
        this.historyManager = new HistoryManager();
    }

    async buildContext(): Promise<PipelineContext> {
        // 1. Fetch State (The "Working Context")
        const stateContext = await this.resolver.resolveContext();

        // 2. Fetch History (The "Session")
        const chatHistoryString = this.historyManager.getCompiledView();

        // 3. Retrieve Relevant Memories (Semantic Long-Term Memory)
        const relevantMemories = await this.retrieveRelevantMemories(
            stateContext.currentProjectId,
            chatHistoryString
        );

        // 4. Format memory context for agent consumption
        const memoryContext = this.formatMemoryContext(relevantMemories);

        // 5. Assemble Pipeline Context
        return {
            ...stateContext,
            chatHistoryString,
            relevantMemories,
            memoryContext
        };
    }

    /**
     * Retrieve relevant memories based on recent conversation
     */
    private async retrieveRelevantMemories(
        projectId: string | undefined,
        chatHistory: string
    ): Promise<string[]> {
        if (!projectId) return [];

        try {
            // Extract a query from recent chat history (last few exchanges)
            const recentContext = this.extractRecentContext(chatHistory);

            if (!recentContext) return [];

            // Retrieve semantically relevant memories
            const memories = await memoryService.retrieveRelevantMemories(
                projectId,
                recentContext,
                5 // Limit to top 5 relevant memories
            );

            return memories;
        } catch (error) {
            console.warn('[ContextPipeline] Failed to retrieve memories:', error);
            return [];
        }
    }

    /**
     * Extract recent context from chat history for memory query
     */
    private extractRecentContext(chatHistory: string): string {
        if (!chatHistory) return '';

        // Take the last ~500 characters of conversation as query context
        const lines = chatHistory.split('\n').filter(l => l.trim());
        const recentLines = lines.slice(-5); // Last 5 exchanges

        return recentLines.join(' ').slice(-500);
    }

    /**
     * Format memories into a context string for agent consumption
     */
    private formatMemoryContext(memories: string[]): string {
        if (memories.length === 0) return '';

        return `
## Long-Term Memory (Relevant Context)
The following memories from previous sessions may be relevant:
${memories.map((m, i) => `${i + 1}. ${m}`).join('\n')}

Use these memories to maintain continuity and apply learned preferences/rules.
`.trim();
    }

    /**
     * Extract and save learnings from a completed conversation
     * Call this after significant interactions
     */
    async extractAndSaveLearnings(
        projectId: string,
        learnings: Array<{ content: string; type: 'fact' | 'summary' | 'rule' }>
    ): Promise<void> {
        for (const learning of learnings) {
            await memoryService.saveMemory(projectId, learning.content, learning.type);
        }
    }
}
