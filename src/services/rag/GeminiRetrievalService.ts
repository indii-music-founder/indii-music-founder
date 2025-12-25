import { env } from '../../config/env.ts';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

// Switch to File API resource types
import { AI_MODELS } from '../../core/config/ai-models.ts';

interface GeminiFile {
    name: string; // "files/..."
    displayName: string;
    mimeType: string;
    sizeBytes: string;
    createTime: string;
    updateTime: string;
    expirationTime: string;
    sha256Hash: string;
    uri: string;
    state: "STATE_UNSPECIFIED" | "PROCESSING" | "ACTIVE" | "FAILED";
}

export class GeminiRetrievalService {
    private apiKey: string;
    private baseUrl: string;

    constructor(apiKey?: string) {
        this.apiKey = apiKey || env.apiKey || '';
        if (!this.apiKey) {
            console.error("GeminiRetrievalService: Missing API Key");
        }
        // Default to production if not set, or update local default to correct project
        // Note: For "The Gauntlet" E2E tests which run against local frontend but expect live backend
        const functionsUrl = env.VITE_FUNCTIONS_URL || 'https://us-central1-indiios-v-1-1.cloudfunctions.net';
        this.baseUrl = `${functionsUrl}/ragProxy/v1beta`;
    }

    private async fetch(endpoint: string, options: RequestInit = {}) {
        const url = `${this.baseUrl}/${endpoint}`;
        const maxRetries = 3;
        let attempt = 0;

        // Custom handling for raw bodies (no JSON header if body is string/buffer and not forced json)
        // Actually, let's keep it simple. If options.body is string and content-type is manually set, respect it.
        const headers: Record<string, string> = {
            ...options.headers as Record<string, string>
        };

        if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }

        while (attempt < maxRetries) {
            try {
                const response = await fetch(url, {
                    ...options,
                    headers
                });

                if (!response.ok) {
                    if (response.status === 429 || response.status >= 500) {
                        attempt++;
                        if (attempt >= maxRetries) {
                            const errorText = await response.text();
                            throw new Error(`Gemini API Error (${endpoint}): ${response.status} ${response.statusText} - ${errorText}`);
                        }
                        const waitTime = Math.min(1000 * Math.pow(2, attempt), 5000);
                        console.warn(`Gemini API 429/5xx (${endpoint}). Retrying in ${waitTime}ms...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        continue;
                    }
                    const errorText = await response.text();
                    throw new Error(`Gemini API Error (${endpoint}): ${response.status} ${response.statusText} - ${errorText}`);
                }

                if (response.status === 204) return {}; // No content
                return response.json();
            } catch (error: any) {
                attempt++;
                if (attempt >= maxRetries) throw error;
                const waitTime = Math.min(1000 * Math.pow(2, attempt), 5000);
                console.warn(`Gemini Network Error (${endpoint}). Retrying in ${waitTime}ms...`, error);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
        throw new Error("Gemini API request failed after retries");
    }

    // --- Files API Implementation (Replaces Corpus/Document) ---

    /**
     * Uploads a file to Gemini Files API.
     * Supports text, PDF, and other compatible formats.
     */
    async uploadFile(displayName: string, content: string | Blob | Uint8Array, mimeType?: string): Promise<GeminiFile> {
        // Determine MIME type
        let targetMime = mimeType;
        if (!targetMime) {
            if (typeof content === 'string') {
                targetMime = 'text/plain';
            } else if (displayName.toLowerCase().endsWith('.pdf')) {
                targetMime = 'application/pdf';
            } else if (displayName.toLowerCase().endsWith('.md')) {
                targetMime = 'text/markdown';
            } else {
                targetMime = 'application/octet-stream';
            }
        }

        const response = await this.fetch('../upload/v1beta/files?uploadType=media', {
            method: 'POST',
            headers: {
                'X-Goog-Upload-Protocol': 'raw',
                'Content-Type': targetMime,
                'X-Goog-Upload-Header-Content-Meta-Session-Data': JSON.stringify({ displayName })
            },
            body: content
        });

        const file = response.file as GeminiFile;
        await this.waitForActive(file.name);
        return file;
    }

    async waitForActive(fileName: string): Promise<void> {
        let state = "PROCESSING";
        while (state === "PROCESSING") {
            const file = await this.getFile(fileName);
            state = file.state;
            if (state === "FAILED") throw new Error("File processing failed");
            if (state === "ACTIVE") return;
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    async getFile(name: string): Promise<GeminiFile> {
        return this.fetch(name); // name is like "files/123"
    }

    async deleteFile(name: string): Promise<void> {
        return this.fetch(name, { method: 'DELETE' });
    }

    /**
     * File Search API Helpers
     */

    // Cache the default store name to avoid repeated lookups/creation
    private defaultStoreName: string | null = null;

    /**
     * Finds or creates a default FileSearchStore.
     */
    async ensureFileSearchStore(): Promise<string> {
        if (this.defaultStoreName) return this.defaultStoreName;

        // 1. List existing stores to see if we have one
        try {
            const listRes = await this.fetch('fileSearchStores');
            if (listRes.fileSearchStores && listRes.fileSearchStores.length > 0) {
                // Use the first one found
                this.defaultStoreName = listRes.fileSearchStores[0].name;
                console.log("Using existing FileSearchStore:", this.defaultStoreName);
                return this.defaultStoreName!;
            }
        } catch (e) {
            console.warn("Failed to list FileSearchStores, trying create...", e);
        }

        // 2. Create a new store if none found
        try {
            const createRes = await this.fetch('fileSearchStores', {
                method: 'POST',
                body: JSON.stringify({ displayName: "IndiiOS Default Store" })
            });
            this.defaultStoreName = createRes.name;
            console.log("Created new FileSearchStore:", this.defaultStoreName);
            return this.defaultStoreName!;
        } catch (e: any) {
            console.error("Failed to create FileSearchStore:", e);
            throw new Error(`FileSearchStore Linkage Failed: ${e.message}`);
        }
    }

    /**
     * Imports an existing file (uploaded via files API) into the File Search Store.
     * @param fileUri The resource name of the file (e.g. "files/123...")
     */
    async importFileToStore(fileUri: string, storeName: string): Promise<void> {
        // Ensure format is just "files/ID" for import
        let resourceName = fileUri;
        if (resourceName.startsWith('https://')) {
            resourceName = resourceName.split('/v1beta/').pop() || resourceName;
            resourceName = resourceName.split('/files/').pop() ? `files/${resourceName.split('/files/').pop()}` : resourceName;
        }

        // Ensure pure resource name
        if (!resourceName.startsWith('files/')) {
            // If it's just an ID
            resourceName = `files/${resourceName}`;
        }

        console.log(`Importing ${resourceName} into ${storeName}...`);

        try {
            const url = `${storeName}:importFile`; // e.g. fileSearchStores/123:importFile
            const res = await this.fetch(url, {
                method: 'POST',
                body: JSON.stringify({
                    fileName: resourceName
                })
            });
            console.log("Import Operation started:", res.name);

            // Wait for operation to complete (simple poll)
            let op = res;
            let attempts = 0;
            while (!op.done && attempts < 10) {
                await new Promise(r => setTimeout(r, 1000));
                // Operation name is like "operations/..."
                op = await this.fetch(op.name);
                attempts++;
            }

            if (op.error) {
                // If error says "already exists", we can ignore. 
                // But usually it just works or fails.
                console.warn(`Import finished with potential error (or valid state): ${JSON.stringify(op.error)}`);
            } else {
                console.log("File imported successfully.");
            }

        } catch (e: any) {
            console.error("Import to store failed:", e);
            // Verify if it failed because it's already there? 
            // For now throw to be safe
            throw e;
        }
    }

    /**
     * Query using the file context (Long Context Window).
     * Replaces AQA model usage.
     */
    /**
     * Query using the managed File Search system.
     * If fileUri is provided, it ensures that file is present in the store.
     * If fileUri is null/empty, it searches the entire store.
     */
    async query(fileUri: string | null, userQuery: string, fileContent?: string, model?: string) {
        let tools: any[] | undefined;
        const targetModel = model || AI_MODELS.TEXT.AGENT;

        if (!fileContent) {
            try {
                const storeName = await this.ensureFileSearchStore();

                if (fileUri) {
                    await this.importFileToStore(fileUri, storeName);
                }

                tools = [{
                    fileSearch: {
                        fileSearchStoreNames: [storeName]
                    }
                }];
                console.log(`[RAG] Querying Store: ${storeName} ${fileUri ? `(Ensuring file: ${fileUri})` : '(Store-wide)'}`);
            } catch (e) {
                console.error("[RAG] File Search Setup Failed:", e);
            }
        }

        const body: any = {
            contents: [{
                role: 'user',
                parts: [
                    ...(fileContent ? [{ text: `CONTEXT:\n${fileContent}\n\n` }] : []),
                    { text: userQuery }
                ]
            }],
            generationConfig: {
                temperature: 0.0
            }
        };

        if (tools) body.tools = tools;

        return this.fetch(`models/${targetModel}:generateContent`, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    }

    /**
     * Lists files uploaded to the Gemini Files API.
     */
    async listFiles(): Promise<{ files: GeminiFile[] }> {
        return this.fetch('files');
    }

    // --- Legacy Corpus Compatibility Methods ---
    async initCorpus(displayName: string): Promise<string> {
        console.warn("Corpus/AQA is deprecated. Please update to `uploadFile`.");
        return "deprecated-corpus";
    }

    async createCorpus() { throw new Error("Deprecated"); }
    async listCorpora() { throw new Error("Deprecated"); }
    async createDocument() { throw new Error("Deprecated"); }
    async ingestText() { throw new Error("Deprecated"); }
    async deleteCorpus() { return; }
    async deleteDocument() { return; }
    async listDocuments() { return { documents: [] }; }
}

export const GeminiRetrieval = new GeminiRetrievalService();
