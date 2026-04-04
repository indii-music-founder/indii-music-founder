import { FirebaseAIService } from '@/services/ai/FirebaseAIService';
import { AI_MODELS } from '@/core/config/ai-models';
import { logger } from '@/utils/logger';
import { WikiStorageAdapter, WikiDocument } from './WikiStorageAdapter';
import { WikiLinter } from './WikiLinter';

export interface CompilationRequest {
    rawInput: string;
    source: string;
    topicHint?: string;
}

export interface CompilerResult {
    docId: string;
    content: string;
    isNew: boolean;
}

/**
 * WikiCompiler is the orchestration layer that turns raw interactions 
 * into structured Obsidian-style Markdown files.
 */
export class WikiCompiler {
    private storage: WikiStorageAdapter;

    constructor() {
        this.storage = new WikiStorageAdapter();
    }

    /**
     * Compiles a raw string of information into the appropriate Wiki document.
     */
    async compileInteraction(userId: string, request: CompilationRequest): Promise<CompilerResult | null> {
        logger.info(`[WikiCompiler] Starting compilation for input: ${request.rawInput.slice(0, 50)}...`);

        try {
            // 1. Determine which Doc ID this belongs to (Routing)
            const allDocs = await this.storage.listWikiDocs(userId);
            const docId = await this.routeToDoc(request.rawInput, allDocs, request.topicHint);

            // 2. Fetch Existing Content
            const existingDoc = await this.storage.readWikiDoc(userId, docId);
            const existingContent = existingDoc?.content || '';

            // 3. Compile: Ask the LLM to integrate the new information seamlessly
            const prompt = `You are the Master Wiki Compiler for an Obsidian-style Markdown knowledge base.
You must integrate new information seamlessly into an existing Markdown file without destroying its current structure.
If the wiki file is empty, write a new comprehensive entry.
Use [[Backlinks]] for important concepts or entities.

FILE TARGET: ${docId}.md

EXISTING CONTENT:
${existingContent || '(Empty document)'}

NEW INFORMATION TO INTEGRATE:
Source: ${request.source}
Data: ${request.rawInput}

Return ONLY the complete, updated Markdown document content. Do not include introductory text.`;

            const compiledContent = await FirebaseAIService.getInstance().generateText(
                prompt,
                AI_MODELS.TEXT.AGENT // Use PRO for high-quality Markdown synthesis
            );

            const cleanContent = compiledContent.replace(/^```markdown\s*/im, '').replace(/```$/im, '').trim();

            // 4. Linter / QA Run
            const lintContext = await WikiLinter.lintContent(cleanContent, existingContent);
            if (!lintContext.passed || lintContext.contradicts) {
                logger.warn(`[WikiCompiler] QA Linter rejected compilation for ${docId}. Issues:`, lintContext.issues);
                // Return null or handle conflict resolution here
                return null;
            }

            // 5. Store / Commit to Wiki
            await this.storage.writeWikiDoc(userId, docId, {
                content: cleanContent,
                category: request.topicHint || 'general',
                title: docId.replace('_', ' ')
            });

            return {
                docId,
                content: cleanContent,
                isNew: !existingDoc
            };

        } catch (error) {
            logger.error(`[WikiCompiler] Compilation pipeline failed:`, error);
            return null;
        }
    }

    /**
     * Uses Fast LLM to determine the appropriate Wiki Doc ID (slug) for this information.
     */
    private async routeToDoc(rawInput: string, existingDocs: WikiDocument[], hint?: string): Promise<string> {
        const docList = existingDocs.map(d => d.id).join(', ');

        const prompt = `Based on the new information, determine the single most appropriate Wiki Document ID to update.
Existing Document IDs: [${docList}]

New Information: ${rawInput.slice(0, 1000)}
Fallback Hint: ${hint || 'None'}

Return ONLY a snake_case string for the Document ID. If it belongs in an existing doc, return that ID exactly. If it requires a new topic, invent a concise new snake_case ID.
Example output: brand_guidelines OR release_strategy`;

        const response = await FirebaseAIService.getInstance().generateText(
            prompt,
            AI_MODELS.TEXT.FAST
        );

        const docId = response.replace(/[^a-zA-Z0-9_]/g, '').trim().toLowerCase();
        return docId || 'general_notes';
    }
}
