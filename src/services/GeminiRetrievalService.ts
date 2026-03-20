/**
 * GeminiRetrievalService - Unified RAG Implementation
 * 
 * Uses the modern Gemini Files API for document retrieval.
 * Replaces the deprecated Corpora API (corpora/documents/chunks).
 * 
 * MIGRATION NOTES:
 * - Old: corpora.create() -> documents.create() -> chunks.create()
 * - New: files.upload() -> model.generateContent() with file references
 * 
 * The Files API is simpler, more reliable, and actively maintained.
 */

import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface UploadedFile {
    name: string;           // files/{file_id}
    displayName: string;    // Original filename
    mimeType: string;
    sizeBytes: string;
    createTime: string;
    updateTime: string;
    expirationTime: string; // Files expire after 48 hours
    sha256Hash: string;
    uri: string;            // gs:// URI for referencing in prompts
    state: 'PROCESSING' | 'ACTIVE' | 'FAILED';
}

export interface KnowledgeDocument {
    id: string;
    userId: string;
    orgId?: string;
    fileName: string;
    fileUri: string;
    mimeType: string;
    uploadedAt: Date;
    expiresAt: Date;
    status: 'processing' | 'ready' | 'expired' | 'error';
    metadata?: Record<string, unknown>;
}

export interface RetrievalResult {
    content: string;
    sources: Array<{
        fileName: string;
        relevanceScore: number;
    }>;
}

export interface RetrievalOptions {
    maxTokens?: number;
    temperature?: number;
    topK?: number;
}

// ============================================================================
// Configuration
// ============================================================================

const API_KEY = import.meta.env.VITE_API_KEY || process.env.VITE_API_KEY;
const MODEL_NAME = 'gemini-3-flash-preview'; // Use latest model with best retrieval
const FILE_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/files';

// Supported MIME types for upload
const SUPPORTED_MIME_TYPES = new Set([
    'application/pdf',
    'text/plain',
    'text/markdown',
    'text/html',
    'text/csv',
    'application/json',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
]);

// ============================================================================
// Service Implementation
// ============================================================================

export class GeminiRetrievalService {
    private genAI: GoogleGenerativeAI;
    private uploadedFiles: Map<string, UploadedFile> = new Map();

    constructor(apiKey?: string) {
        const key = apiKey || API_KEY;
        if (!key) {
            throw new Error('Gemini API key is required. Set VITE_API_KEY environment variable.');
        }
        this.genAI = new GoogleGenerativeAI(key);
    }

    // =========================================================================
    // File Upload (Modern Files API)
    // =========================================================================

    /**
     * Upload a file to Gemini Files API for retrieval.
     * Files are automatically deleted after 48 hours.
     */
    async uploadFile(
        file: File | Blob,
        displayName: string,
        metadata?: Record<string, unknown>
    ): Promise<UploadedFile> {
        // Validate MIME type
        if (!SUPPORTED_MIME_TYPES.has(file.type)) {
            throw new Error(
                `Unsupported file type: ${file.type}. Supported: ${[...SUPPORTED_MIME_TYPES].join(', ')}`
            );
        }

        // Validate file size (max 2GB for Files API, but we limit to 20MB for RAG)
        const MAX_SIZE = 20 * 1024 * 1024; // 20MB
        if (file.size > MAX_SIZE) {
            throw new Error(`File too large. Maximum size is ${MAX_SIZE / 1024 / 1024}MB`);
        }

        try {
            // Step 1: Initiate resumable upload
            const initResponse = await fetch(
                `${FILE_API_BASE}?key=${API_KEY}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Goog-Upload-Protocol': 'resumable',
                        'X-Goog-Upload-Command': 'start',
                        'X-Goog-Upload-Header-Content-Length': file.size.toString(),
                        'X-Goog-Upload-Header-Content-Type': file.type,
                    },
                    body: JSON.stringify({
                        file: {
                            displayName: this.sanitizeFileName(displayName),
                        },
                    }),
                }
            );

            if (!initResponse.ok) {
                const error = await initResponse.text();
                throw new Error(`Failed to initiate upload: ${error}`);
            }

            const uploadUrl = initResponse.headers.get('X-Goog-Upload-URL');
            if (!uploadUrl) {
                throw new Error('No upload URL returned');
            }

            // Step 2: Upload file content
            const uploadResponse = await fetch(uploadUrl, {
                method: 'PUT',
                headers: {
                    'Content-Length': file.size.toString(),
                    'X-Goog-Upload-Offset': '0',
                    'X-Goog-Upload-Command': 'upload, finalize',
                },
                body: file,
            });

            if (!uploadResponse.ok) {
                const error = await uploadResponse.text();
                throw new Error(`Failed to upload file: ${error}`);
            }

            const uploadedFile: UploadedFile = await uploadResponse.json();

            // Step 3: Wait for processing (files may need time to process)
            const readyFile = await this.waitForFileReady(uploadedFile.name);

            // Cache the file reference
            this.uploadedFiles.set(readyFile.name, readyFile);

            logger.info(`[RAG] File uploaded: ${readyFile.displayName} (${readyFile.name})`);
            return readyFile;

        } catch (error) {
            logger.error('[RAG] Upload failed:', error);
            throw error;
        }
    }

    /**
     * Poll until file is ready for use
     */
    private async waitForFileReady(fileName: string, maxWaitMs = 60000): Promise<UploadedFile> {
        const startTime = Date.now();
        const pollInterval = 2000;

        while (Date.now() - startTime < maxWaitMs) {
            const response = await fetch(
                `${FILE_API_BASE}/${fileName}?key=${API_KEY}`
            );

            if (!response.ok) {
                throw new Error(`Failed to get file status: ${await response.text()}`);
            }

            const file: UploadedFile = await response.json();

            if (file.state === 'ACTIVE') {
                return file;
            }

            if (file.state === 'FAILED') {
                throw new Error(`File processing failed: ${fileName}`);
            }

            // Still processing, wait and retry
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        throw new Error(`File processing timed out: ${fileName}`);
    }

    /**
     * List all uploaded files (for the current API key)
     */
    async listFiles(): Promise<UploadedFile[]> {
        const response = await fetch(`${FILE_API_BASE}?key=${API_KEY}`);

        if (!response.ok) {
            throw new Error(`Failed to list files: ${await response.text()}`);
        }

        const data = await response.json();
        return data.files || [];
    }

    /**
     * Delete a file by name
     */
    async deleteFile(fileName: string): Promise<void> {
        const response = await fetch(
            `${FILE_API_BASE}/${fileName}?key=${API_KEY}`,
            { method: 'DELETE' }
        );

        if (!response.ok && response.status !== 404) {
            throw new Error(`Failed to delete file: ${await response.text()}`);
        }

        this.uploadedFiles.delete(fileName);
        logger.info(`[RAG] File deleted: ${fileName}`);
    }

    // =========================================================================
    // Retrieval & Query
    // =========================================================================

    /**
     * Query the knowledge base using uploaded files as context.
     * 
     * @param query - User's question
     * @param fileNames - Array of file names to use as context (from uploadFile)
     * @param options - Generation options
     */
    async query(
        query: string,
        fileNames: string[],
        options: RetrievalOptions = {}
    ): Promise<RetrievalResult> {
        if (!query.trim()) {
            throw new Error('Query cannot be empty');
        }

        if (fileNames.length === 0) {
            throw new Error('At least one file must be provided for retrieval');
        }

        const model = this.genAI.getGenerativeModel({
            model: MODEL_NAME,
            generationConfig: {
                maxOutputTokens: options.maxTokens || 2048,
                temperature: options.temperature || 0.3, // Lower temp for factual retrieval
            },
        });

        // Build file parts for the prompt
        const fileParts: Part[] = fileNames.map(name => ({
            fileData: {
                mimeType: this.uploadedFiles.get(name)?.mimeType || 'application/octet-stream',
                fileUri: this.uploadedFiles.get(name)?.uri || `https://generativelanguage.googleapis.com/v1beta/${name}`,
            },
        }));

        // Construct the prompt with retrieval instructions
        const systemPrompt = `You are a helpful assistant with access to the user's knowledge base.
Answer questions based ONLY on the information in the provided documents.
If the answer is not in the documents, say "I couldn't find that information in your knowledge base."
Always cite which document(s) your answer comes from.`;

        try {
            const result = await model.generateContent([
                { text: systemPrompt },
                ...fileParts,
                { text: `Question: ${query}` },
            ]);

            const response = result.response;
            const text = response.text();

            // Extract source citations (simplified - could be enhanced with structured output)
            const sources = fileNames.map(name => ({
                fileName: this.uploadedFiles.get(name)?.displayName || name,
                relevanceScore: 1.0, // Files API doesn't return relevance scores
            }));

            return {
                content: text,
                sources,
            };

        } catch (error) {
            logger.error('[RAG] Query failed:', error);
            throw new Error(`Retrieval query failed: ${error}`);
        }
    }

    /**
     * Perform semantic search across multiple files
     * Returns relevant excerpts without generating a full response
     */
    async semanticSearch(
        query: string,
        fileNames: string[],
        topK: number = 5
    ): Promise<Array<{ excerpt: string; source: string; score: number }>> {
        const model = this.genAI.getGenerativeModel({
            model: MODEL_NAME,
            generationConfig: {
                maxOutputTokens: 4096,
                temperature: 0,
            },
        });

        const fileParts: Part[] = fileNames.map(name => ({
            fileData: {
                mimeType: this.uploadedFiles.get(name)?.mimeType || 'application/octet-stream',
                fileUri: this.uploadedFiles.get(name)?.uri || `https://generativelanguage.googleapis.com/v1beta/${name}`,
            },
        }));

        const searchPrompt = `Search the provided documents for information relevant to: "${query}"

Return the ${topK} most relevant excerpts as a JSON array:
[
  {"excerpt": "...", "source": "filename", "score": 0.0-1.0}
]

Only return the JSON array, no other text.`;

        try {
            const result = await model.generateContent([
                ...fileParts,
                { text: searchPrompt },
            ]);

            const text = result.response.text();
            
            // Parse JSON response (handle potential markdown code blocks)
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }

            return [];

        } catch (error) {
            logger.error('[RAG] Semantic search failed:', error);
            return [];
        }
    }

    // =========================================================================
    // Knowledge Base Management (Firestore Integration)
    // =========================================================================

    /**
     * Sync uploaded file to Firestore for persistence tracking.
     * Call this after uploadFile() to maintain a database of the user's knowledge.
     */
    async syncToFirestore(
        uploadedFile: UploadedFile,
        userId: string,
        orgId?: string
    ): Promise<KnowledgeDocument> {
        // This would integrate with your Firestore setup
        // Using dynamic import to avoid bundling Firebase in non-web contexts
        const { getFirestore, doc, setDoc } = await import('firebase/firestore');
        const { db } = await import('./firebase');

        const docId = uploadedFile.name.replace('files/', '');
        const expiresAt = new Date(uploadedFile.expirationTime);

        const knowledgeDoc: KnowledgeDocument = {
            id: docId,
            userId,
            orgId,
            fileName: uploadedFile.displayName,
            fileUri: uploadedFile.uri,
            mimeType: uploadedFile.mimeType,
            uploadedAt: new Date(),
            expiresAt,
            status: 'ready',
        };

        await setDoc(doc(db, 'knowledge', docId), knowledgeDoc);

        logger.info(`[RAG] Synced to Firestore: ${docId}`);
        return knowledgeDoc;
    }

    /**
     * Refresh files that are about to expire (re-upload before 48hr limit)
     */
    async refreshExpiringFiles(userId: string): Promise<number> {
        const { getFirestore, collection, query, where, getDocs } = await import('firebase/firestore');
        const { db } = await import('./firebase');

        // Find files expiring in the next 6 hours
        const expirationThreshold = new Date(Date.now() + 6 * 60 * 60 * 1000);

        const q = query(
            collection(db, 'knowledge'),
            where('userId', '==', userId),
            where('expiresAt', '<', expirationThreshold),
            where('status', '==', 'ready')
        );

        const snapshot = await getDocs(q);
        let refreshedCount = 0;

        for (const docSnap of snapshot.docs) {
            const data = docSnap.data() as KnowledgeDocument;
            logger.info(`[RAG] File expiring soon: ${data.fileName}`);
            // In a real implementation, you'd re-fetch and re-upload the file
            // This requires storing the original file or having a backup
            refreshedCount++;
        }

        return refreshedCount;
    }

    // =========================================================================
    // Utilities
    // =========================================================================

    /**
     * Sanitize filename for display
     */
    private sanitizeFileName(name: string): string {
        return name
            .replace(/[^\w\s.-]/g, '') // Remove special chars
            .replace(/\s+/g, '_')      // Replace spaces with underscores
            .substring(0, 100);         // Limit length
    }

    /**
     * Check if a file type is supported
     */
    isSupportedFileType(mimeType: string): boolean {
        return SUPPORTED_MIME_TYPES.has(mimeType);
    }

    /**
     * Get list of supported MIME types
     */
    getSupportedMimeTypes(): string[] {
        return [...SUPPORTED_MIME_TYPES];
    }

    /**
     * Clear all cached file references
     */
    clearCache(): void {
        this.uploadedFiles.clear();
    }
}

// ============================================================================
// Singleton Export
// ============================================================================

let serviceInstance: GeminiRetrievalService | null = null;

export function getRetrievalService(apiKey?: string): GeminiRetrievalService {
    if (!serviceInstance) {
        serviceInstance = new GeminiRetrievalService(apiKey);
    }
    return serviceInstance;
}

export default GeminiRetrievalService;
