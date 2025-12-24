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
            onUpdate(`Searching ${files.length} document(s)...`);
            // Sort by newest first (if createTime is available, otherwise trust API order)
            // The API usually returns list, let's just pick the first one for now as 'Recent Context'
            const targetFile = files[0];
            const fileUri = targetFile.name; // This is the 'files/...' URI

            reasoning.push(`Context: ${targetFile.displayName} (${fileUri})`);

            // 2. Query with File Context
            const result = await GeminiRetrieval.query(fileUri, query);
            const data = await result.json();

            // Parse Standard Gemini Response
            const candidate = data.candidates?.[0];
            responseText = candidate?.content?.parts?.[0]?.text || "No relevant info found in documents.";

            // Attempt to capture citations/grounding if available
            // Note: Grounding typically comes in 'groundingAttributions' or 'citationMetadata' depending on the model/feature used.
            // For standard generateContent with files, it's just the model answering.
            // We'll treat the file itself as the source.
            if (responseText) {
                sources.push({
                    sourceId: targetFile.displayName,
                    content: { parts: [{ text: "Context from file" }] }
                });
            }

        } else {
            // 3. Fallback: Pure LLM (No documents or Retrieval Failed)
            onUpdate("Using general knowledge...");
            if (sources.length === 0) reasoning.push("No files or Retrieval failed. Fallback to General LLM.");

            const response = await AI.generateContent({
                model: AI_MODELS.TEXT.FAST,
                contents: { role: 'user', parts: [{ text: query }] },
                config: { temperature: 0.7 } // Creative fallback
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
 * Takes raw content and ingests it into the Gemini Corpus.
 */
export async function processForKnowledgeBase(
    reportContent: string,
    contextSource: string,
    extraMetadata: { size?: string; type?: string; originalDate?: string } = {}
): Promise<{ title: string; content: string; entities: string[]; tags: string[]; embeddingId?: string }> {
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

    // 2. Ingest into Gemini Files
    try {
        // Direct upload to Files API
        const file = await GeminiRetrieval.uploadFile(metadata.title, reportContent);
        console.log("Uploaded to Gemini Files:", file.name);

        // Return mostly compatible structure
        return {
            title: metadata.title,
            content: metadata.summary,
            entities: [],
            tags: ['gemini-file'],
            embeddingId: file.name
        };
    } catch (e) {
        console.error("Failed to upload to Gemini Files:", e);
        // Throw or return partial?
        return {
            title: metadata.title,
            content: "Failed to process",
            entities: [],
            tags: ['error'],
            embeddingId: ''
        }
    }
}
