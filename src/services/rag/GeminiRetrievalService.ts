import { AI_CONFIG } from '@/core/config/ai-models';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

interface Corpus {
    name: string;
    displayName: string;
    createTime: string;
    updateTime: string;
}

interface Document {
    name: string;
    displayName: string;
    customMetadata?: Record<string, any>;
}

interface Chunk {
    data: { stringValue: string };
    customMetadata?: Record<string, any>;
}

export class GeminiRetrievalService {
    private apiKey: string;

    constructor(apiKey?: string) {
        const env = import.meta.env || {};
        this.apiKey = apiKey || env.VITE_API_KEY || '';
        if (!this.apiKey) {
            console.error("GeminiRetrievalService: Missing API Key");
        }
    }

    private async fetch(endpoint: string, options: RequestInit = {}) {
        const url = `${BASE_URL}/${endpoint}?key=${this.apiKey}`;
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API Error (${endpoint}): ${response.status} ${response.statusText} - ${errorText}`);
        }

        return response.json();
    }

    /**
     * Creates a new Corpus (Knowledge Base).
     */
    async createCorpus(displayName: string = "indiiOS Knowledge Base"): Promise<Corpus> {
        return this.fetch('corpora', {
            method: 'POST',
            body: JSON.stringify({ displayName })
        });
    }

    /**
     * Lists existing corpora.
     */
    async listCorpora(): Promise<{ corpora: Corpus[] }> {
        return this.fetch('corpora');
    }

    /**
     * Gets or creates the default corpus for the app.
     */
    async initCorpus(): Promise<string> {
        const list = await this.listCorpora();
        const existing = list.corpora?.find(c => c.displayName === "indiiOS Knowledge Base");

        if (existing) {
            return existing.name; // e.g., "corpora/12345"
        }

        const newCorpus = await this.createCorpus();
        return newCorpus.name;
    }

    /**
     * Creates a Document within a Corpus.
     */
    async createDocument(corpusName: string, displayName: string, metadata?: Record<string, any>): Promise<Document> {
        return this.fetch(`${corpusName}/documents`, {
            method: 'POST',
            body: JSON.stringify({
                displayName,
                customMetadata: metadata ? Object.entries(metadata).map(([key, value]) => ({ key, stringValue: String(value) })) : []
            })
        });
    }

    /**
     * Ingests text into a Document by creating chunks.
     * Note: Gemini API handles embedding automatically.
     */
    async ingestText(documentName: string, text: string, chunkSize: number = 500) {
        // Simple chunking strategy (can be improved)
        const chunks: Chunk[] = [];
        for (let i = 0; i < text.length; i += chunkSize) {
            chunks.push({
                data: { stringValue: text.substring(i, i + chunkSize) }
            });
        }

        // Batch create chunks
        // API limit is usually 100 chunks per batch
        const BATCH_SIZE = 100;
        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
            const batch = chunks.slice(i, i + BATCH_SIZE);
            await this.fetch(`${documentName}/chunks:batchCreate`, {
                method: 'POST',
                body: JSON.stringify({ requests: batch.map(c => ({ chunk: c })) })
            });
        }
    }

    /**
     * Deletes a corpus.
     */
    async deleteCorpus(corpusName: string) {
        return this.fetch(corpusName, { method: 'DELETE' });
    }

    /**
     * Deletes a document.
     */
    async deleteDocument(documentName: string) {
        return this.fetch(documentName, { method: 'DELETE' });
    }

    /**
     * Answers a question using the AQA (Attributed Question Answering) model.
     */
    async query(corpusName: string, userQuery: string) {
        // Use the 'aqa' model which is specialized for RAG
        return this.fetch('models/aqa:generateAnswer', {
            method: 'POST',
            body: JSON.stringify({
                content: { parts: [{ text: userQuery }] },
                semanticRetrievalSource: {
                    source: corpusName,
                    query: { text: userQuery } // Optional: can be different from user query
                }
            })
        });
    }
}

export const GeminiRetrieval = new GeminiRetrievalService();
