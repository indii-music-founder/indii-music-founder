

import { smartChunk } from '@/utils/textChunker';

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
    customMetadata?: Record<string, unknown>;
}

interface Chunk {
    data: { stringValue: string };
    customMetadata?: Record<string, unknown>;
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
        const proxyUrl = import.meta.env?.VITE_RAG_PROXY_URL;
        let url: string;

        if (proxyUrl) {
            // Use Proxy: http://localhost:3001/v1beta/...
            // Endpoint is like 'corpora' or 'corpora/123/documents'
            // Proxy expects /v1beta/...
            url = `${proxyUrl}/v1beta/${endpoint}`;
        } else {
            // Direct: https://generativelanguage.googleapis.com/v1beta/...
            url = `${BASE_URL}/${endpoint}?key=${this.apiKey}`;
        }

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
    async initCorpus(corpusDisplayName: string = "indiiOS Knowledge Base"): Promise<string> {
        console.log(`GeminiRetrievalService: Initializing Corpus '${corpusDisplayName}'...`);
        try {
            const list = await this.listCorpora();
            const existing = list.corpora?.find(c => c.displayName === corpusDisplayName);

            if (existing) {
                console.log("GeminiRetrievalService: Found existing corpus:", existing.name);
                return existing.name; // e.g., "corpora/12345"
            }

            console.log("GeminiRetrievalService: Creating new corpus...");
            const newCorpus = await this.createCorpus(corpusDisplayName);
            console.log("GeminiRetrievalService: Created new corpus:", newCorpus.name);
            return newCorpus.name;
        } catch (error) {
            console.error("GeminiRetrievalService: Failed to init corpus:", error);
            throw error;
        }
    }

    /**
     * Creates a Document within a Corpus.
     */
    async createDocument(corpusName: string, displayName: string, metadata?: Record<string, unknown>): Promise<Document> {
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
    async ingestText(documentName: string, text: string, chunkSize: number = 1000) {
        // Use smart chunking
        const textChunks = smartChunk(text, chunkSize);

        const chunks: Chunk[] = textChunks.map(str => ({
            data: { stringValue: str }
        }));

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
     * Lists documents in a corpus.
     */
    async listDocuments(corpusName: string): Promise<{ documents: Document[] }> {
        return this.fetch(`${corpusName}/documents`);
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
