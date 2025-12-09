import { AI } from '../ai/AIService';
import { AI_MODELS } from '@/core/config/ai-models';
import { GeminiRetrieval } from './GeminiRetrievalService';
import type { KnowledgeAsset, KnowledgeDocumentIndexingStatus, UserProfile, AudioAnalysisJob } from '../../modules/workflow/types';

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
    _updateDocStatus: (docId: string, status: KnowledgeDocumentIndexingStatus) => void
): Promise<{ asset: KnowledgeAsset; updatedProfile: UserProfile | null }> {

    onUpdate("Initializing Gemini Knowledge Base...");

    // 1. Ensure Corpus Exists
    // In a real app, we'd cache this ID in the user profile or store
    const corpusName = await GeminiRetrieval.initCorpus();

    onUpdate("Querying Semantic Retriever...");

    try {
        // 2. Query AQA Model
        const response = await GeminiRetrieval.query(corpusName, query);
        const answer = response.answer?.content?.parts?.[0]?.text || "No answer found.";
        const attributedPassages: Attribution[] = response.answer?.groundingAttributions || [];

        // 3. Construct Knowledge Asset
        const asset: KnowledgeAsset = {
            id: crypto.randomUUID(),
            assetType: 'knowledge',
            title: `Answer: ${query}`,
            content: answer,
            date: Date.now(),
            tags: ['gemini-rag', 'aqa'],
            sources: attributedPassages.map((p) => ({
                name: p.sourceId?.replace(corpusName + '/documents/', '') || 'Unknown',
                content: p.content?.parts?.[0]?.text || ''
            })),
            retrievalDetails: attributedPassages,
            reasoningTrace: [
                `Query: "${query}"`,
                `Corpus: ${corpusName}`,
                `Model: models/aqa`
            ]
        };

        return { asset, updatedProfile: null };

    } catch (error) {
        console.error("Gemini RAG Failed:", error);
        throw error;
    }
}

/**
 * Takes raw content and ingests it into the Gemini Corpus.
 */
export async function processForKnowledgeBase(reportContent: string, contextSource: string): Promise<{ title: string; content: string; entities: string[]; tags: string[]; embeddingId?: string }> {
    // 1. Extract Metadata (Title, Summary) using standard Gemini
    // We still do this to get a nice title/summary for the UI
    const systemPrompt = `Summarize this content and extract a title. Output JSON: { "title": "...", "summary": "..." }`;
    let metadata = { title: contextSource, summary: '' };
    try {
        const response = await AI.generateContent({
            model: AI_MODELS.TEXT.FAST,
            contents: { role: 'user', parts: [{ text: reportContent }] },
            config: { responseMimeType: 'application/json', systemInstruction: systemPrompt }
        });

        const text = response.text();
        if (text) {
            metadata = JSON.parse(text);
        }
    } catch (error) {
        console.warn("Metadata extraction failed, using defaults:", error);
        // Fallback is already set
    }

    // 2. Ingest into Gemini Corpus
    try {
        const corpusName = await GeminiRetrieval.initCorpus();
        const doc = await GeminiRetrieval.createDocument(corpusName, metadata.title, { source: contextSource });
        await GeminiRetrieval.ingestText(doc.name, reportContent);
        console.log("Ingested into Gemini Corpus:", doc.name);
    } catch (e) {
        console.error("Failed to ingest into Gemini Corpus:", e);
    }

    return {
        title: metadata.title,
        content: metadata.summary,
        entities: [],
        tags: ['gemini-corpus'],
        embeddingId: 'managed-by-gemini' // Placeholder
    };
}
