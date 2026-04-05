import { ContextResolver } from './ContextResolver';
import { AgentContext } from '../types';
import { HistoryManager } from './HistoryManager';
import { memoryService } from '../MemoryService';
import { bigBrainEngine } from '../memory/BigBrainEngine';
import { logger } from '@/utils/logger';

export interface PipelineContext extends AgentContext {
    chatHistoryString: string;
    relevantMemories: string[];
    userAlignmentRules?: string[];
    memoryContext: string;
    /** Big Brain auto-recall block (XML-formatted, all 4 layers) */
    autoRecallBlock: string;
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

        // 3. Big Brain Auto-Recall (Unified across all 4 layers)
        const { useStore } = await import('@/core/store');
        const { isKnowledgeBaseEnabled, userProfile } = useStore.getState();
        const userId = userProfile?.uid;

        let autoRecallBlock = '';
        let relevantMemories: string[] = [];
        let userAlignmentRules: string[] = [];

        if (userId && isKnowledgeBaseEnabled) {
            try {
                // Extract the user's latest message for intent matching
                const recentContext = this.extractRecentContext(chatHistoryString);

                // Determine active agent ID
                const agentId = stateContext.activeModule || 'agent0';

                // Assemble context from all 4 layers in parallel
                const bigBrainContext = await bigBrainEngine.assembleContext(
                    userId,
                    agentId,
                    recentContext,
                    stateContext.projectId
                );

                // Format into XML block for prompt injection
                autoRecallBlock = bigBrainEngine.formatForPrompt(bigBrainContext);

                // Extract individual components for backward compatibility
                userAlignmentRules = bigBrainContext.alignmentRules;

                // Also keep the relevantMemories array for the legacy formatMemoryContext
                if (bigBrainContext.episodicRecall) {
                    relevantMemories = bigBrainContext.episodicRecall
                        .split('\n')
                        .filter(l => l.startsWith('- '))
                        .map(l => l.substring(2));
                }

                logger.debug(
                    `[ContextPipeline] BigBrain injected ${bigBrainContext.totalCharacters} chars ` +
                    `(vault:${bigBrainContext.meta.vaultFactCount}, ` +
                    `episodic:${bigBrainContext.meta.episodicMatches}, ` +
                    `rules:${bigBrainContext.meta.alignmentRuleCount})`
                );
            } catch (err: unknown) {
                logger.warn('[ContextPipeline] BigBrain assembly failed (non-blocking):', err);
                // Fallback: still try to get basic memories
                relevantMemories = await this.fallbackRetrieveMemories(stateContext.projectId, chatHistoryString);
            }
        } else if (isKnowledgeBaseEnabled) {
            // No user but knowledge base enabled — basic memory retrieval
            relevantMemories = await this.fallbackRetrieveMemories(stateContext.projectId, chatHistoryString);
        }

        // 4. Format legacy memory context for backward compatibility
        const memoryContext = this.formatMemoryContext(relevantMemories);

        // 5. Assemble Pipeline Context
        return {
            ...stateContext,
            chatHistoryString,
            relevantMemories,
            userAlignmentRules,
            memoryContext,
            autoRecallBlock,
        };
    }

    /**
     * Fallback memory retrieval (used when BigBrain is unavailable)
     */
    private async fallbackRetrieveMemories(
        projectId: string | undefined,
        chatHistory: string
    ): Promise<string[]> {
        if (!projectId) return [];

        try {
            const recentContext = this.extractRecentContext(chatHistory);
            if (!recentContext) return [];

            return await memoryService.retrieveRelevantMemories(
                projectId,
                recentContext,
                5
            );
        } catch (error: unknown) {
            logger.warn('[ContextPipeline] Fallback memory retrieval failed:', error);
            return [];
        }
    }

    /**
     * Extract recent context from chat history for memory query
     */
    private extractRecentContext(chatHistory: string): string {
        if (!chatHistory) return '';

        const lines = chatHistory.split('\n').filter(l => l.trim());
        const recentLines = lines.slice(-5);

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
