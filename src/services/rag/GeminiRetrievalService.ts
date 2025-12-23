

import { smartChunk } from '@/utils/textChunker';
import { env } from '@/config/env';

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
        this.apiKey = apiKey || env.apiKey || '';
        if (!this.apiKey) {
            console.error("GeminiRetrievalService: Missing API Key");
        }
    }

    private async fetch(endpoint: string, options: RequestInit = {}) {
        // Always use the backend proxy
        // The proxy expects the path to be relative to /v1beta/
        // Our endpoint argument is like 'corpora' or 'corpora/123/documents'
        // The backend function is at /ragProxy
        // We need to pass the endpoint as the path to the proxy function?
        // No, the proxy function `ragProxy` handles the path.
        // If we deploy `ragProxy` to `https://.../ragProxy`, we can append the path.
        // But Firebase Functions usually work as `https://.../ragProxy`.
        // If we want to use it as a proxy, we might need to send the target endpoint in the body or query,
        // OR use a rewrite in firebase.json.
        // Given the current setup in `functions/src/rag/retrieval.ts`:
        // `const path = req.path;`
        // `const endpoint = path.replace(/^\/v1beta\//, '').replace(/^\//, '');`
        // So if we call `https://.../ragProxy/v1beta/corpora`, it will extract `corpora`.

        const functionUrl = `${env.VITE_FUNCTIONS_URL}/ragProxy`;
        const url = `${functionUrl}/v1beta/${endpoint}`;

        const maxRetries = 3;
        let attempt = 0;

        while (attempt < maxRetries) {
            try {
                const response = await fetch(url, {
                    ...options,
                    headers: {
                        'Content-Type': 'application/json',
                        ...options.headers
                    }
                });

                if (!response.ok) {
                    if (response.status === 429 || response.status >= 500) {
                        attempt++;
                        if (attempt >= maxRetries) {
                            const errorText = await response.text();
                            throw new Error(`Gemini API Error (${endpoint}): ${response.status} ${response.statusText} - ${errorText}`);
                        }

                        // Exponential backoff
                        const waitTime = Math.min(1000 * Math.pow(2, attempt), 5000);
                        console.warn(`Gemini API 429/5xx (${endpoint}). Retrying in ${waitTime}ms...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        continue;
                    }

                    const errorText = await response.text();
                    throw new Error(`Gemini API Error (${endpoint}): ${response.status} ${response.statusText} - ${errorText}`);
                }


                return response.json();
            } catch (error: any) {
                // If network error (fetch throws), retry
                attempt++;
                if (attempt >= maxRetries) throw error;

                const waitTime = Math.min(1000 * Math.pow(2, attempt), 5000);
                console.warn(`Gemini Network Error (${endpoint}). Retrying in ${waitTime}ms...`, error);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
        throw new Error("Gemini API request failed after retries");
    }

    // Helper for reliable waiting on resource propagation
    private async waitForResource(checkFn: () => Promise<boolean>, maxRetries = 5, initialDelay = 2000): Promise<void> {
        let retries = 0;
        while (retries < maxRetries) {
            if (await checkFn()) return;

            console.log(`GeminiRetrievalService: Waiting for resource propagation (Attempt ${retries + 1}/${maxRetries})...`);
            const waitTime = Math.min(initialDelay * Math.pow(2, retries), 10000); // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, waitTime));
            retries++;
        }
        throw new Error("Resource failed to propagate within time limit.");
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
                contents: [{ role: 'user', parts: [{ text: userQuery }] }],
                semanticRetrievalSource: {
                    source: corpusName,
                    query: { text: userQuery }
                }
            })
        });
    }
}

export const GeminiRetrieval = new GeminiRetrievalService();
