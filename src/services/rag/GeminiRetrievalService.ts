import { env } from '../../config/env.ts';
import { MembershipService } from '@/services/MembershipService';
import { QuotaExceededError } from '@/shared/types/errors';



// Switch to File API resource types
import { AI_MODELS } from '../../core/config/ai-models.ts';
import { delay } from '@/utils/async';

export interface GeminiFile {
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
                        await delay(waitTime);
                        continue;
                    }
                    const errorText = await response.text();
                    throw new Error(`Gemini API Error (${endpoint}): ${response.status} ${response.statusText} - ${errorText}`);
                }

                if (response.status === 204) return {}; // No content
                return response.json();
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                attempt++;
                if (attempt >= maxRetries) throw error;
                const waitTime = Math.min(1000 * Math.pow(2, attempt), 5000);
                console.warn(`Gemini Network Error (${endpoint}). Retrying in ${waitTime}ms...`, errorMessage);
                await delay(waitTime);
            }
        }
        throw new Error("Gemini API request failed after retries");
    }

    /**
     * Calculate content size in MB for quota checking
     */
    private getContentSizeMB(content: string | Blob | Uint8Array): number {
        let bytes: number;
        if (typeof content === 'string') {
            bytes = new TextEncoder().encode(content).length;
        } else if (content instanceof Blob) {
            bytes = content.size;
        } else if (content instanceof Uint8Array) {
            bytes = content.length;
        } else {
            bytes = 0;
        }
        return bytes / (1024 * 1024); // Convert to MB
    }

    // --- Files API Implementation (Replaces Corpus/Document) ---

    /**
     * Uploads a file to Gemini Files API.
     * Supports text, PDF, and other compatible formats.
     */
    async uploadFile(displayName: string, content: string | Blob | Uint8Array, mimeType?: string): Promise<GeminiFile> {
        // Pre-flight storage quota check (Section 8 compliance)
        const fileSizeMB = this.getContentSizeMB(content);
        const quotaCheck = await MembershipService.checkQuota('storage', fileSizeMB);
        if (!quotaCheck.allowed) {
            const tier = await MembershipService.getCurrentTier();
            throw new QuotaExceededError(
                'storage',
                tier,
                MembershipService.getUpgradeMessage(tier, 'storage'),
                quotaCheck.currentUsage,
                quotaCheck.maxAllowed
            );
        }

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
            body: content as BodyInit
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
            await delay(2000);
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
                console.info("Using existing FileSearchStore:", this.defaultStoreName);
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
            console.info("Created new FileSearchStore:", this.defaultStoreName);
            return this.defaultStoreName!;
        } catch (e: unknown) {
            const err = e as Error;
            console.error("Failed to create FileSearchStore:", err);
            throw new Error(`FileSearchStore Linkage Failed: ${err.message}`);
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

        console.info(`Importing ${resourceName} into ${storeName}...`);

        try {
            const url = `${storeName}:importFile`; // e.g. fileSearchStores/123:importFile
            const res = await this.fetch(url, {
                method: 'POST',
                body: JSON.stringify({
                    fileName: resourceName
                })
            });
            console.info("Import Operation started:", res.name);

            // Wait for operation to complete (simple poll)
            let op = res;
            let attempts = 0;
            while (!op.done && attempts < 10) {
                await delay(1000);
                // Operation name is like "operations/..."
                op = await this.fetch(op.name);
                attempts++;
            }

            if (op.error) {
                // If error says "already exists", we can ignore. 
                // But usually it just works or fails.
                console.warn(`Import finished with potential error (or valid state): ${JSON.stringify(op.error)}`);
            } else {
                console.info("File imported successfully.");
            }

        } catch (e: unknown) {
            console.error("Import to store failed:", e);
            throw e as Error;
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
        let tools: Array<{ fileSearch: { fileSearchStoreNames: string[] } }> | undefined;
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
                console.info(`[RAG] Querying Store: ${storeName} ${fileUri ? `(Ensuring file: ${fileUri})` : '(Store-wide)'}`);
            } catch (e) {
                console.error("[RAG] File Search Setup Failed:", e);
            }
        }

        const body = {
            contents: [{
                role: 'user',
                parts: [
                    ...(fileContent ? [{ text: `CONTEXT:\n${fileContent}\n\n` }] : []),
                    { text: userQuery }
                ]
            }],
            generationConfig: {
                temperature: 0.0
            },
            ...(tools ? { tools } : {})
        };

        return this.fetch(`models/${targetModel}:generateContent`, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    }

    /**
     * Streams query responses using the Gemini API.
     */
    async *streamQuery(fileUri: string | null, userQuery: string, fileContent?: string, model?: string): AsyncGenerator<string> {
        let tools: Array<{ fileSearch: { fileSearchStoreNames: string[] } }> | undefined;
        const targetModel = model || AI_MODELS.TEXT.AGENT;

        if (!fileContent) {
            try {
                const storeName = await this.ensureFileSearchStore();
                if (fileUri) await this.importFileToStore(fileUri, storeName);
                tools = [{ fileSearch: { fileSearchStoreNames: [storeName] } }];
            } catch (e) {
                console.error("[RAG] Stream Query Setup Failed:", e);
            }
        }

        const body = {
            contents: [{
                role: 'user',
                parts: [
                    ...(fileContent ? [{ text: `CONTEXT:\n${fileContent}\n\n` }] : []),
                    { text: userQuery }
                ]
            }],
            generationConfig: { temperature: 0.0 },
            ...(tools ? { tools } : {})
        };

        const response = await fetch(`${this.baseUrl}/models/${targetModel}:streamGenerateContent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Stream Error: ${response.status} - ${error}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("Could not get stream reader");

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // The Gemini stream returns a JSON array of objects [...]
            // We need to parse each item in the array.
            // For simplicity, we search for JSON objects within the stream.
            let firstBracket = buffer.indexOf('{');
            while (firstBracket !== -1) {
                let depth = 0;
                let lastBracket = -1;
                for (let i = firstBracket; i < buffer.length; i++) {
                    if (buffer[i] === '{') depth++;
                    else if (buffer[i] === '}') {
                        depth--;
                        if (depth === 0) {
                            lastBracket = i;
                            break;
                        }
                    }
                }

                if (lastBracket !== -1) {
                    const potentialJson = buffer.substring(firstBracket, lastBracket + 1);
                    try {
                        const chunk = JSON.parse(potentialJson);
                        const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text) yield text;
                        buffer = buffer.substring(lastBracket + 1);
                        firstBracket = buffer.indexOf('{');
                    } catch (e) {
                        // Incomplete JSON or parse error, break and wait for more data
                        break;
                    }
                } else {
                    // No matching closing bracket yet
                    break;
                }
            }
        }
    }

    /**
     * Lists files uploaded to the Gemini Files API.
     */
    async listFiles(): Promise<{ files: GeminiFile[] }> {
        return this.fetch('files');
    }

    // --- Legacy Corpus Compatibility Methods Removed ---
}

export const GeminiRetrieval = new GeminiRetrievalService();
