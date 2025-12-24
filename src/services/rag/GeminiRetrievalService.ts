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
     * Uploads a text file to Gemini Files API.
     * Returns the File object including URI.
     */
    async uploadFile(displayName: string, textContent: string): Promise<GeminiFile> {
        const response = await this.fetch('../upload/v1beta/files?uploadType=media', {
            method: 'POST',
            headers: {
                'X-Goog-Upload-Protocol': 'raw',
                'Content-Type': 'text/plain',
                'X-Goog-Upload-Header-Content-Meta-Session-Data': JSON.stringify({ displayName })
            },
            body: textContent
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
     * Query using the file context (Long Context Window).
     * Replaces AQA model usage.
     */
    async query(fileUri: string, userQuery: string, fileContent?: string, model?: string) {
        const parts: any[] = [];
        let canonicalUri = fileUri;

        // Default to model if provided, or fallback to config default (usually FAST/Flash)
        // But for Native RAG with files, we prefer PRO if not specified to avoid 400s on Flash
        const targetModel = model || AI_MODELS.TEXT.FAST;

        // "Native" path: Use fileData if no explicit content fallback is forced OR if we just want to try it.
        // However, our previous logic was: if fileContent exists, use it.
        // New logic: If fileContent is provided, it's a fallback. But we want to prefer fileData if possible.
        // For now, let's trust the caller. If they pass fileContent, they might want inline.
        // BUT, if they pass null/undefined, we MUST use fileData.

        if (fileContent) {
            // Only log this if we are actually using the fallback
            // console.log("Using Inline Text Context fallback");
            parts.push({ text: `Use the following document as context to answer the user's question:\n\n${fileContent}\n\n` });
        } else {
            // Standard: File URI

            // Normalize: Ensure URI matches: https://generativelanguage.googleapis.com/files/<id>
            // The API explicitly rejects 'files/<id>' and '.../v1beta/files/<id>'

            if (fileUri.startsWith('files/')) {
                // Case: "files/123" -> "https://generativelanguage.googleapis.com/files/123"
                canonicalUri = `https://generativelanguage.googleapis.com/${fileUri}`;
            } else if (fileUri.includes('/v1beta/files/')) {
                // Case: "https://.../v1beta/files/123" -> "https://.../files/123"
                canonicalUri = fileUri.replace('/v1beta/files/', '/files/');
            } else {
                // Trust other formats (Youtube, etc) or already correct URIs
                canonicalUri = fileUri;
            }
            // We TRUST the input if it's already a URL (even with v1beta)

            parts.push({
                file_data: {
                    file_uri: canonicalUri,
                    mime_type: 'text/plain'
                }
            });
        }

        parts.push({ text: userQuery });

        const body = {
            contents: [{
                role: 'user',
                parts: parts
            }]
        };
        console.log("DEBUG: Query fileUri:", fileUri);
        console.log("DEBUG: Canonical URI:", canonicalUri);
        // console.log("DEBUG: Query Body:", JSON.stringify(body, null, 2));

        // Use standard generateContent with fileUri
        return this.fetch(`models/${targetModel}:generateContent`, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    }

    /**
     * Lists files uploaded to the Gemini Files API.
     */
    async listFiles(): Promise<{ files: GeminiFile[] }> {
        // Pagination is supported but for now we just get the default page
        return this.fetch('files');
    }

    // --- Legacy Corpus Compatibility Methods (To avoid breaking tests/consumers immediately) ---
    // These will now throw or log deprecation, or try to map if possible.
    // Since the previous implementation 404'd, these are broken anyway.

    async initCorpus(displayName: string): Promise<string> {
        console.warn("Corpus/AQA is deprecated due to API 404s. Please update to `uploadFile`.");
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
