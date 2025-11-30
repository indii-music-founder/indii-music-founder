import { AI } from '../ai/AIService';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';
import { generateEmbedding, localQueryStore } from './fileSearchService';
import { saveAssetToStorage } from '../storage/repository';
import type { KnowledgeAsset, KnowledgeDocument, KnowledgeDocumentIndexingStatus, UserProfile, AudioAnalysisJob } from '../../modules/workflow/types';

/**
 * Runs the RAG workflow using local client-side retrieval.
 */
export async function runAgenticWorkflow(
    query: string,
    userProfile: UserProfile,
    activeTrack: AudioAnalysisJob | null,
    onUpdate: (update: string) => void,
    updateDocStatus: (docId: string, status: KnowledgeDocumentIndexingStatus) => void
): Promise<{ asset: KnowledgeAsset; updatedProfile: UserProfile | null }> {

    onUpdate("Searching Knowledge Base...");

    // Use the local search service with the documents currently in the profile
    const asset = await localQueryStore(
        userProfile.knowledgeBase,
        query,
        updateDocStatus
    );

    return { asset, updatedProfile: null };
}

/**
 * Takes raw content (e.g. a department report) and uses AI to process it for the Knowledge Base.
 * Extracts Title, Summary, Entities, and Tags to enable GraphRAG-style retrieval.
 */
export async function processForKnowledgeBase(reportContent: string, contextSource: string): Promise<{ title: string; content: string; entities: string[]; tags: string[]; embeddingId?: string }> {
    let contentToSummarize = reportContent;
    try {
        const parsed = JSON.parse(reportContent);
        if (parsed.assetType === 'document' && parsed.content) {
            contentToSummarize = `Title: ${parsed.title}\n\n${parsed.content}`;
        }
    } catch (e) { /* Not a JSON asset */ }

    const systemPrompt = `You are an expert Knowledge Engineer building a GraphRAG system for a music artist.
    
    YOUR TASK:
    1. **Summarize**: Create a concise, standalone knowledge snippet from the input.
    2. **Title**: Give it a clear, descriptive title.
    3. **Extract Entities**: Identify specific proper nouns (People, Songs, Albums, Venues, Brands, Tools).
    4. **Extract Tags**: Identify broad concepts (Themes, Genres, Moods, Departments).
    
    This metadata will be used to drastically reduce false positives in retrieval.`;

    const userPrompt = `Source Context: ${contextSource}\n\nContent to Process:\n${contentToSummarize}`;

    // GEMINI 3 MIGRATION: Upgrading to Gemini 3 Pro for superior entity extraction capabilities.
    const response = await AI.generateContent({
        model: AI_MODELS.TEXT.AGENT,
        contents: { role: 'user', parts: [{ text: userPrompt }] },
        config: {
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json',
            responseSchema: {
                type: 'OBJECT',
                properties: {
                    title: { type: 'STRING' },
                    content: { type: 'STRING' },
                    entities: { type: 'ARRAY', items: { type: 'STRING' } },
                    tags: { type: 'ARRAY', items: { type: 'STRING' } }
                },
                required: ['title', 'content', 'entities', 'tags']
            },
            ...AI_CONFIG.THINKING.LOW
        }
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
    const metadata = JSON.parse(text || "{}");

    // Generate Embedding for Vector Search
    let embeddingId: string | undefined;
    try {
        const embedding = await generateEmbedding(metadata.content || contentToSummarize);
        // Save embedding to IndexedDB as a blob/asset
        // We store it as a JSON string
        const embeddingJson = JSON.stringify(embedding);
        const blob = new Blob([embeddingJson], { type: 'application/json' });
        embeddingId = await saveAssetToStorage(blob);
    } catch (e) {
        console.warn("Failed to generate embedding for knowledge doc:", e);
    }

    return { ...metadata, embeddingId };
}
