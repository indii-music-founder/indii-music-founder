import { ContextResolver } from './ContextResolver';
import { AgentContext } from '../types';
import { HistoryManager } from './HistoryManager';
import { memoryService } from '../MemoryService';
import { userMemoryService } from '../UserMemoryService';
import { MemorySearchResult } from '@/types/UserMemory';
import { logger } from '@/utils/logger';
// useStore removed

export interface PipelineContext extends AgentContext {
    chatHistoryString: string;
    relevantMemories: string[];
    userAlignmentRules?: string[];
    memoryContext: string;
    swarmId?: string | null;
    traceId?: string;
    attachments?: { mimeType: string; base64: string }[];
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
        const chatHistoryString = await this.historyManager.getCompiledView();

        // 3. Retrieve Relevant Memories (Semantic Long-Term Memory)
        // Only retrieve if Knowledge Base toggle is enabled
        const { useStore } = await import('@/core/store');
        const { isKnowledgeBaseEnabled, userProfile } = useStore.getState();
        const relevantMemories = isKnowledgeBaseEnabled
            ? await this.retrieveRelevantMemories(stateContext.projectId, chatHistoryString)
            : [];

        // 3.5 Retrieve User Alignment Rules (Feedback)
        let userAlignmentRules: string[] = [];
        if (userProfile?.uid) {
            try {
                const recentContext = this.extractRecentContext(chatHistoryString);
                const rules = await userMemoryService.searchMemories({
                    userId: userProfile.uid,
                    query: recentContext || stateContext.activeModule || 'task',
                    categories: ['preference', 'feedback', 'interaction'],
                    limit: 5
                });
                userAlignmentRules = rules.map((r: MemorySearchResult) => r.memory.content);
                if (userAlignmentRules.length > 0) {
                    logger.debug(`[ContextPipeline] Retrieved ${userAlignmentRules.length} user alignment rules.`);
                }
            } catch (err) {
                logger.warn('[ContextPipeline] Failed to retrieve user alignment rules:', err);
            }
        }

        // 4. Format memory context for agent consumption
        const memoryContext = this.formatMemoryContext(relevantMemories);

        // 5. Assemble Pipeline Context
        return {
            ...stateContext,
            chatHistoryString,
            relevantMemories,
            userAlignmentRules,
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
            logger.warn('[ContextPipeline] Failed to retrieve memories:', error);
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
