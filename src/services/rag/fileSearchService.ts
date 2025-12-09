import { AI } from '../ai/AIService';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';
import { getAssetFromStorage } from '../storage/repository';
import type { KnowledgeDocument, KnowledgeAsset, KnowledgeDocumentIndexingStatus } from '../../modules/workflow/types';

// Simple stop words list to improve retrieval quality
const STOP_WORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'is', 'are', 'was', 'were',
    'it', 'that', 'this', 'my', 'your', 'their', 'be', 'have', 'has', 'do', 'does', 'can', 'could', 'will', 'would'
]);

/**
 * Tokenizes text into a set of normalized keywords.
 */
function tokenize(text: string): string[] {
    return text.toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .split(/\s+/)
        .filter(word => word.length > 2 && !STOP_WORDS.has(word));
}

/**
 * Calculates the cosine similarity between two vectors.
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Generates an embedding for the given text using the Gemini API.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    try {
        const result = await AI.embedContent({
            model: 'text-embedding-004',
            content: { parts: [{ text }] }
        });

        // Handle both potential response formats (v1 vs v1beta/alpha differences)
        const embedding = (result as any).embedding || (result as any).embeddings?.[0];
        return embedding.values;
    } catch (error) {
        console.error("Failed to generate embedding:", error);
        throw error;
    }
}

/**
 * Fetches the embedding vector from storage given its ID (URI).
 */
async function fetchEmbeddingVector(embeddingId: string): Promise<number[] | null> {
    try {
        // getAssetFromStorage returns a Blob URL (e.g. blob:http://...)
        const blobUrl = await getAssetFromStorage(embeddingId);
        const response = await fetch(blobUrl);
        const json = await response.json();
        return json as number[];
    } catch (error) {
        console.warn(`Failed to fetch embedding ${embeddingId}:`, error);
        return null;
    }
}

/**
 * Calculates a relevance score based on token overlap and Metadata Boost (GraphRAG Lite).
 */
function calculateKeywordRelevance(queryTokens: string[], doc: KnowledgeDocument): number {
    let score = 0;
    const docTokens = tokenize(doc.content);
    const docTokenSet = new Set(docTokens);

    // 1. Content Match (Lexical)
    for (const qt of queryTokens) {
        if (docTokenSet.has(qt)) {
            score += 1;
        }
    }

    // 2. Entity Boost (Graph Node Match)
    if (doc.entities && doc.entities.length > 0) {
        for (const entity of doc.entities) {
            const entityTokens = tokenize(entity);
            if (entityTokens.length > 0 && entityTokens.every(t => queryTokens.includes(t))) {
                score += 3;
            }
        }
    }

    // 3. Tag Boost (Semantic/Categorical Match)
    if (doc.tags && doc.tags.length > 0) {
        for (const tag of doc.tags) {
            const tagTokens = tokenize(tag);
            if (tagTokens.some(t => queryTokens.includes(t))) {
                score += 2;
            }
        }
    }

    return score;
}

/**
 * Expands a single user query into multiple semantic variations using the LLM.
 */
async function expandQuery(originalQuery: string): Promise<string[]> {
    if (originalQuery.split(' ').length < 3) return [originalQuery];

    try {
        const response = await AI.generateContent({
            model: AI_MODELS.TEXT.FAST,
            contents: {
                role: 'user', parts: [{
                    text: `You are an expert search query optimizer. 
            Generate 3 alternative search queries for the following user input. 
            Focus on synonyms, related concepts, and specific keywords that might appear in a Knowledge Base.
            
            User Input: "${originalQuery}"
            
            Output strictly a JSON array of strings. Example: ["query 1", "query 2", "query 3"]` }]
            },
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: 'ARRAY',
                    items: { type: 'STRING' }
                },
                ...AI_CONFIG.THINKING.LOW
            }
        });

        const text = response.text();
        const variations = JSON.parse(text || "[]");
        return [originalQuery, ...variations];
    } catch (e) {
        console.warn("Query expansion failed, using original query only.", e);
        return [originalQuery];
    }
}

/**
 * Performs a local search on the provided documents and synthesizes an answer using Gemini.
 * Implements Hybrid Search: Vector Semantic Search + Keyword Search.
 */
export async function localQueryStore(
    documents: KnowledgeDocument[],
    query: string,
    updateDocStatus?: (docId: string, status: KnowledgeDocumentIndexingStatus) => void
): Promise<KnowledgeAsset> {

    // 1. Query Expansion Phase
    const expandedQueries = await expandQuery(query);

    // 2. Retrieval Phase (Hybrid)
    const availableDocs = documents.filter(doc => doc.indexingStatus !== 'error');
    const docMap = new Map<string, { doc: KnowledgeDocument, score: number, vectorScore?: number, keywordScore?: number }>();

    // Generate embedding for the ORIGINAL query (most important for vector search)
    let queryEmbedding: number[] | null = null;
    try {
        queryEmbedding = await generateEmbedding(query);
    } catch (e) {
        console.warn("Failed to generate query embedding, falling back to keyword only.");
    }

    // Pre-fetch embeddings for all docs that have them
    // Optimization: In a real app, we'd cache these in memory or use a vector store.
    // Here we fetch them on demand (potentially slow for many docs, but fine for MVP).
    const docEmbeddings = new Map<string, number[]>();
    if (queryEmbedding) {
        const docsWithEmbeddings = availableDocs.filter(d => d.embeddingId);
        await Promise.all(docsWithEmbeddings.map(async (doc) => {
            if (doc.embeddingId) {
                const vec = await fetchEmbeddingVector(doc.embeddingId);
                if (vec) docEmbeddings.set(doc.id, vec);
            }
        }));
    }

    // Run retrieval
    for (const doc of availableDocs) {
        let keywordScore = 0;
        let vectorScore = 0;

        // Keyword Score (Sum over expanded queries)
        for (const q of expandedQueries) {
            const tokens = tokenize(q);
            keywordScore += calculateKeywordRelevance(tokens, doc);
        }

        // Vector Score (Cosine Similarity)
        if (queryEmbedding && docEmbeddings.has(doc.id)) {
            const docVec = docEmbeddings.get(doc.id)!;
            vectorScore = cosineSimilarity(queryEmbedding, docVec);
            // Normalize vector score (usually -1 to 1, but embeddings are usually normalized so 0 to 1)
            // Scale it up to match keyword score magnitude (roughly 0-10 range)
            vectorScore = vectorScore * 10;
        }

        // Hybrid Score Combination
        // We give vector score a base weight, but keyword matches are strong signals for specific entities.
        const finalScore = (keywordScore * 0.4) + (vectorScore * 0.6);

        if (finalScore > 0.5) { // Threshold
            docMap.set(doc.id, { doc, score: finalScore, vectorScore, keywordScore });
        }
    }

    const rankedDocs = Array.from(docMap.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 5); // Top 5 most relevant

    // 3. Context Construction
    let context = "";
    if (rankedDocs.length > 0) {
        context = rankedDocs.map(item => `[Source: ${item.doc.name} (Relevance: ${item.score.toFixed(2)})]\n${item.doc.content}`).join('\n\n');
    } else {
        context = "No specific documents matched the query. Answer based on general knowledge or the query itself.";
    }

    // 4. Synthesis Phase (LLM)
    const systemInstruction = `You are "indii," an intelligent Knowledge Base assistant for a creative artist.
    
    YOUR TASK:
    Answer the user's query using ONLY the provided [Context] below.
    
    RULES:
    - If the answer is found in the context, answer clearly and cite the source name in parentheses, e.g., "According to (Artist Bio)...".
    - If the context does NOT contain the answer, state: "I couldn't find that specific information in your Knowledge Base." Do not hallucinate.
    - Be concise and professional.
    - Format with Markdown.
    `;

    const prompt = `User Query: "${query}"\n\n[Context]:\n${context}`;

    try {
        const response = await AI.generateContent({
            model: AI_MODELS.TEXT.AGENT,
            contents: { role: 'user', parts: [{ text: prompt }] },
            config: {
                systemInstruction: systemInstruction,
                ...AI_CONFIG.THINKING.HIGH
            }
        });

        const answer = response.text() || "No answer generated.";

        // 5. Construct Asset
        const sources = rankedDocs.map(r => ({
            name: r.doc.name,
            content: r.doc.content.substring(0, 200) + "..."
        }));

        const retrievalDetails = rankedDocs.map(r => ({
            doc: r.doc,
            score: r.score
        }));

        return {
            assetType: 'knowledge',
            title: `Answer: ${query}`,
            content: answer,
            sources: sources,
            retrievalDetails: retrievalDetails,
            reasoningTrace: [
                `Original Query: "${query}"`,
                `Expanded Queries: ${JSON.stringify(expandedQueries)}`,
                `Retrieved ${rankedDocs.length} unique documents via Hybrid Search (Vector + Keyword).`
            ]
        };

    } catch (error) {
        console.error("Error during RAG synthesis:", error);
        throw new Error(`Knowledge retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
