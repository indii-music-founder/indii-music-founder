import { BaseAgent } from './BaseAgent';
import { AgentConfig, AgentContext, AgentProgressCallback, AgentResponse } from './types';
import { GeminiRetrieval } from '@/services/rag/GeminiRetrievalService';
import { logger } from '@/utils/logger';

/**
 * RAGAgent (Retrieval-Augmented Generation Agent)
 * 
 * An abstract BaseAgent subclass that automatically preconditions its execution
 * by querying the Gemini Retrieval Service (File Search Corpora) to pull in
 * highly specific domain knowledge before executing its primary task.
 */
export class RAGAgent extends BaseAgent {
    constructor(config: AgentConfig) {
        super(config);
    }

    /**
     * Executes the agent by first querying the global knowledge base (RAG proxy)
     * and injecting the semantic insights directly into the context memory before running the standard BaseAgent loop.
     */
    protected async _executeInternal(
        task: string,
        context?: AgentContext,
        onProgress?: AgentProgressCallback,
        signal?: AbortSignal,
        attachments?: { mimeType: string; base64: string }[]
    ): Promise<AgentResponse> {
        // Step 1: Query the Gemini Retrieval System for relevant domain knowledge
        try {
            onProgress?.({ type: 'thought', content: `Consulting the central knowledge base for domain expertise...` });

            // Build a specialized prompt to probe the knowledge base
            const probeQuery = `Extract any strictly relevant protocols, guidelines, rules, or insights from the knowledge base that correspond to the following task: "${task}". If there is no relevant information, output "NONE".`;

            const targetCorpus = context?.ragCorpus || context?.projectId;
            const queryResponse = await GeminiRetrieval.query(null, probeQuery, undefined, undefined, targetCorpus);

            // Extract the generated text
            const ragText = queryResponse?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (ragText && !ragText.includes("NONE") && !signal?.aborted) {
                // Ensure context exists
                const safeContext = context || {
                    chatHistory: [],
                    attachments: [],
                };

                // Inject the insights gathered from the knowledge base into memory
                safeContext.memoryContext = safeContext.memoryContext
                    ? safeContext.memoryContext + `\n\n--- DOMAIN KNOWLEDGE BASE INSIGHTS ---\n${ragText}\n------------------------\n`
                    : `--- DOMAIN KNOWLEDGE BASE INSIGHTS ---\n${ragText}\n------------------------\n`;

                onProgress?.({ type: 'thought', content: 'Injected specialized domain knowledge into agent context.' });

                // Re-assign mutated context back
                context = safeContext;
            } else {
                logger.debug(`[RAGAgent] No specific domain knowledge extracted for task.`);
                onProgress?.({ type: 'thought', content: 'Proceeding with standard protocol (no supplemental insights required).' });
            }
        } catch (error) {
            logger.warn(`[RAGAgent] Knowledge Base Query Failed for ${this.id}:`, error);
            onProgress?.({ type: 'thought', content: 'Proceeding without supplemental domain knowledge (KB offline).' });
        }

        if (signal?.aborted) {
            throw new Error('Operation cancelled');
        }

        // Step 2: Proceed with normal BaseAgent tool-calling execution loop
        return super._executeInternal(task, context, onProgress, signal, attachments);
    }
}
