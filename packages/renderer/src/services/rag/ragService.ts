import { AutonomousIntelligence as AI } from '../intelligence/AutonomousIntelligence';

import { knowledgeRetrievalService, FrontendKnowledgeDoc } from '../../modules/knowledge/services/KnowledgeRetrievalService';
import type { KnowledgeAsset, KnowledgeDocumentIndexingStatus, UserProfile, AudioAnalysisJob } from '../../modules/workflow/types';
import { logger } from '@/utils/logger';

interface Attribution {
    sourceId?: string;
    content?: { parts?: { text: string }[] };
}

/**
 * Runs the RAG workflow using Gemini Semantic Retrieval (AQA).
 */
export async function runAgenticWorkflow(
    query: string,
    userProfile: UserProfile,
    activeTrack: AudioAnalysisJob | null,
    onUpdate: (update: string) => void,
    _updateDocStatus: (docId: string, status: KnowledgeDocumentIndexingStatus) => void,
    _fileContent?: string
): Promise<{ asset: KnowledgeAsset; updatedProfile: UserProfile | null }> {

    onUpdate("Initializing Gemini Knowledge Base...");

    let responseText = "No answer found.";
    const sources: Attribution[] = [];
    const reasoning = ["Query started"];
    let files: FrontendKnowledgeDoc[] = [];

    // 1. Retrieval Phase (Safe Failover)
    try {
        files = await knowledgeRetrievalService.getDocuments();
    } catch (err: unknown) {
        logger.warn("RAG Retrieval Failed (proceeding with Pure LLM):", err);
        reasoning.push(`Retrieval Error: ${err}`);
        // Fallback to empty files list -> triggers Pure LLM
        files = [];
    }

    try {
        if (files.length > 0) {
            onUpdate(`Searching across ${files.length} document(s)...`);

            // Pass null for fileUri to trigger Store-wide search across all indexed files
            const resultText = await knowledgeRetrievalService.chat(
                query,
                null
            );

            responseText = resultText || "No relevant info found in documents.";

            if (responseText) {
                reasoning.push(`Multi-file search performed across ${files.length} documents.`);
                sources.push({
                    sourceId: "Knowledge Base",
                    content: { parts: [{ text: "Consolidated knowledge from multiple sources" }] }
                });
            }
        } else {
            // 3. Fallback: Pure LLM (No documents or Retrieval Failed)
            onUpdate("Using general knowledge...");
            if (sources.length === 0) reasoning.push("No files or Retrieval failed. Fallback to General LLM.");

            responseText = await AI.generateText(query) || "I couldn't generate a response.";
        }

    } catch (error: unknown) {
        logger.error("Agent Logic Failed:", error);
        responseText = "I'm having trouble processing that right now.";
        reasoning.push(`Critical Error: ${error}`);
    }

    // 4. Construct Knowledge Asset
    const asset: KnowledgeAsset = {
        id: crypto.randomUUID(),
        assetType: 'knowledge',
        title: `Answer: ${query}`,
        content: responseText,
        date: Date.now(),
        tags: ['gemini-response', sources.length > 0 ? 'rag' : 'general-knowledge'],
        sources: sources.map((s) => ({
            name: s.sourceId || 'AI',
            content: s.content?.parts?.[0]?.text || ''
        })),
        retrievalDetails: sources as Record<string, unknown>[],
        reasoningTrace: reasoning
    };

    return { asset, updatedProfile: null };
}

/**
 * Takes raw content (string, File, or Blob) and ingests it into the Gemini File Search system.
 */
export async function processForKnowledgeBase(
    content: string | File | Blob,
    fileName: string,
    _extraMetadata: { size?: string; type?: string; originalDate?: string; projectId?: string } = {}
): Promise<{ title: string; content: string; entities: string[]; tags: string[]; embeddingId?: string }> {
    // 1. Extract Metadata (Title, Summary) using standard Gemini
    // We only do this if content is a string or we can read it easily for metadata extraction
    let displayTitle = fileName;
    // content is used below in various conditionals

    if (typeof content === 'string') {
        const schema = {
            type: 'object',
            properties: {
                title: { type: 'string' },
                summary: { type: 'string' }
            },
            required: ['title', 'summary']
        };

        try {
            const metadata = await AI.generateStructuredData<{ title: string; summary: string }>(
                `Summarize this content and extract a title:\n${content}`,
                schema as Record<string, unknown>
            );
            displayTitle = metadata.title || fileName;
        } catch (error: unknown) {
            logger.warn("Metadata extraction failed, using defaults:", error);
        }
    }

    // 2. Ingest into Knowledge Base (New System)
    try {
        let fileObj: File;
        if (content instanceof File) {
            fileObj = content;
        } else if (content instanceof Blob) {
            fileObj = new File([content], displayTitle, { type: content.type });
        } else {
            fileObj = new File([content], displayTitle + '.txt', { type: 'text/plain' });
        }
        
        await knowledgeRetrievalService.uploadFiles([fileObj] as unknown as FileList);
        logger.info(`[RAG] Ingested native file: ${fileObj.name} (${fileObj.type})`);

        return {
            title: displayTitle,
            content: typeof content === 'string' ? content : `Native ${fileObj.type} file stored in Knowledge Base.`,
            entities: [],
            tags: ['knowledge-base', fileObj.type?.split('/').pop() || 'raw'],
            embeddingId: fileObj.name // We don't have the generated doc ID here, but this preserves the old schema loosely
        };
    } catch (e: unknown) {
        logger.error("[RAG] Ingestion failed:", e);
        return {
            title: displayTitle,
            content: "Failed to process",
            entities: [],
            tags: ['error'],
            embeddingId: ''
        };
    }
}
