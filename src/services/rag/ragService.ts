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
    _updateDocStatus: (docId: string, status: KnowledgeDocumentIndexingStatus) => void,
    fileContent?: string
): Promise<{ asset: KnowledgeAsset; updatedProfile: UserProfile | null }> {

    onUpdate("Initializing Gemini Knowledge Base...");

    let responseText = "No answer found.";
    let sources: Attribution[] = [];
    let reasoning = ["Query started"];
    let files: any[] = [];

    // 1. Retrieval Phase (Safe Failover)
    try {
        const fileList = await GeminiRetrieval.listFiles();
        files = fileList.files || [];
    } catch (err) {
        console.warn("RAG Retrieval Failed (proceeding with Pure LLM):", err);
        reasoning.push(`Retrieval Error: ${err}`);
        // Fallback to empty files list -> triggers Pure LLM
        files = [];
    }

    try {
        if (files.length > 0) {
            onUpdate(`Searching across ${files.length} document(s)...`);

            // Pass null for fileUri to trigger Store-wide search across all indexed files
            const result = await GeminiRetrieval.query(
                null,
                query,
                fileContent,
                AI_MODELS.TEXT.AGENT
            );
            const data = result;

            const candidate = data.candidates?.[0];
            responseText = candidate?.content?.parts?.[0]?.text || "No relevant info found in documents.";

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

            const response = await AI.generateContent({
                model: AI_MODELS.TEXT.FAST,
                contents: { role: 'user', parts: [{ text: query }] },
                config: { temperature: 0.0 } // Set to 0.0 as per GEMINI.md for maximum factuality
            });

            responseText = response.text() || "I couldn't generate a response.";
        }

    } catch (error) {
        console.error("Agent Logic Failed:", error);
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
        retrievalDetails: sources,
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
    extraMetadata: { size?: string; type?: string; originalDate?: string } = {}
): Promise<{ title: string; content: string; entities: string[]; tags: string[]; embeddingId?: string }> {
    // 1. Extract Metadata (Title, Summary) using standard Gemini
    // We only do this if content is a string or we can read it easily for metadata extraction
    let displayTitle = fileName;
    let reportContent = typeof content === 'string' ? content : "Binary Content (PDF/Other)";

    if (typeof content === 'string') {
        const systemPrompt = `Summarize this content and extract a title. Output JSON: { "title": "...", "summary": "..." }`;
        try {
            const response = await AI.generateContent({
                model: AI_MODELS.TEXT.FAST,
                contents: { role: 'user', parts: [{ text: content }] },
                config: { responseMimeType: 'application/json', systemInstruction: systemPrompt }
            });

            const text = response.text();
            if (text) {
                const metadata = JSON.parse(text);
                displayTitle = metadata.title || fileName;
            }
        } catch (error) {
            console.warn("Metadata extraction failed, using defaults:", error);
        }
    }

    // 2. Ingest into Gemini Files (Native Support)
    try {
        // Direct upload to Files API - handles PDF/MD/TXT natively now
        const file = await GeminiRetrieval.uploadFile(displayTitle, content);
        console.log(`[RAG] Ingested native file: ${file.name} (${file.mimeType})`);

        return {
            title: displayTitle,
            content: typeof content === 'string' ? content : `Native ${file.mimeType} file stored in Gemini.`,
            entities: [],
            tags: ['gemini-file', file.mimeType.split('/').pop() || 'raw'],
            embeddingId: file.name
        };
    } catch (e) {
        console.error("[RAG] Ingestion failed:", e);
        return {
            title: displayTitle,
            content: "Failed to process",
            entities: [],
            tags: ['error'],
            embeddingId: ''
        };
    }
}
