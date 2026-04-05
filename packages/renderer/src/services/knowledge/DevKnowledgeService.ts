/**
 * Google Developer Knowledge API Service
 *
 * Provides access to Google's public developer documentation via the
 * Developer Knowledge API (v1alpha). Supports searching documentation
 * and retrieving full page content as Markdown.
 *
 * API Reference: https://developers.google.com/knowledge/api
 * Quickstart: https://developers.google.com/knowledge/quickstart
 *
 * Requires: VITE_GOOGLE_DEVKNOWLEDGE_API_KEY env var
 * (or falls back to VITE_API_KEY if available)
 */

import { env } from '@/config/env';
import { Logger } from '@/core/logger/Logger';

const BASE_URL = 'https://developerknowledge.googleapis.com/v1alpha';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DocumentChunk {
    /** Snippet of matching content */
    content: string;
    /** Parent document reference (e.g., "documents/developers.google.com/...") */
    parent: string;
    /** Page URI */
    uri?: string;
    /** Relevance score if provided */
    score?: number;
}

export interface SearchResult {
    chunks: DocumentChunk[];
    query: string;
    timestamp: number;
}

export interface DocumentContent {
    /** Full Markdown content of the document */
    markdown: string;
    /** Document name/path */
    name: string;
    /** Source URI */
    uri?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class DevKnowledgeService {
    private apiKey: string | undefined;
    private cache = new Map<string, { data: unknown; expires: number }>();
    private readonly CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

    constructor() {
        // Use dedicated key if available, otherwise fall back to general API key
        this.apiKey = (import.meta.env.VITE_GOOGLE_DEVKNOWLEDGE_API_KEY as string)
            || env.VITE_API_KEY;
    }

    /**
     * Check if the service is configured and ready to use.
     */
    isAvailable(): boolean {
        return !!this.apiKey;
    }

    /**
     * Search Google developer documentation for relevant content.
     *
     * @param query - Search query (e.g., "Firebase App Check setup")
     * @returns Search results with document chunks and snippets
     */
    async search(query: string): Promise<SearchResult> {
        if (!this.apiKey) {
            throw new Error('Developer Knowledge API key not configured');
        }

        const cacheKey = `search:${query}`;
        const cached = this.getFromCache<SearchResult>(cacheKey);
        if (cached) return cached;

        const url = `${BASE_URL}/documents:searchDocumentChunks?query=${encodeURIComponent(query)}&key=${this.apiKey}`;

        Logger.debug('DevKnowledge', `Searching: "${query}"`);

        const response = await fetch(url);
        if (!response.ok) {
            const errText = await response.text();
            Logger.error('DevKnowledge', `Search failed: ${response.status} ${errText}`);
            throw new Error(`Developer Knowledge API search failed: ${response.status}`);
        }

        const data = await response.json();

        const result: SearchResult = {
            query,
            timestamp: Date.now(),
            chunks: (data.documentChunks || []).map((chunk: Record<string, unknown>) => ({
                content: chunk.content || chunk.chunkContent || '',
                parent: chunk.parent || chunk.document || '',
                uri: chunk.uri || '',
                score: chunk.relevanceScore || chunk.score,
            })),
        };

        this.setCache(cacheKey, result);
        Logger.debug('DevKnowledge', `Found ${result.chunks.length} results for "${query}"`);
        return result;
    }

    /**
     * Retrieve the full Markdown content of a document.
     *
     * @param documentName - Document reference from search results (parent field)
     * @returns Full document content as Markdown
     */
    async getDocument(documentName: string): Promise<DocumentContent> {
        if (!this.apiKey) {
            throw new Error('Developer Knowledge API key not configured');
        }

        const cacheKey = `doc:${documentName}`;
        const cached = this.getFromCache<DocumentContent>(cacheKey);
        if (cached) return cached;

        const url = `${BASE_URL}/${documentName}?key=${this.apiKey}`;

        Logger.debug('DevKnowledge', `Fetching document: ${documentName}`);

        const response = await fetch(url);
        if (!response.ok) {
            const errText = await response.text();
            Logger.error('DevKnowledge', `GetDocument failed: ${response.status} ${errText}`);
            throw new Error(`Developer Knowledge API getDocument failed: ${response.status}`);
        }

        const data = await response.json();

        const result: DocumentContent = {
            markdown: data.content || data.markdown || '',
            name: data.name || documentName,
            uri: data.uri || '',
        };

        this.setCache(cacheKey, result);
        return result;
    }

    /**
     * Search and return full documents in one call.
     * Convenience method that searches then fetches the top N results.
     *
     * @param query - Search query
     * @param maxResults - Maximum documents to fetch (default 3)
     * @returns Array of full document contents
     */
    async searchAndFetch(query: string, maxResults = 3): Promise<DocumentContent[]> {
        const searchResults = await this.search(query);
        const topChunks = searchResults.chunks.slice(0, maxResults);

        // Deduplicate by parent document
        const uniqueParents = [...new Set(topChunks.map(c => c.parent).filter(Boolean))];

        const documents = await Promise.allSettled(
            uniqueParents.map(parent => this.getDocument(parent))
        );

        return documents
            .filter((r): r is PromiseFulfilledResult<DocumentContent> => r.status === 'fulfilled')
            .map(r => r.value);
    }

    // -- Cache helpers -------------------------------------------------------

    private getFromCache<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (entry && entry.expires > Date.now()) {
            return entry.data as T;
        }
        if (entry) this.cache.delete(key);
        return null;
    }

    private setCache(key: string, data: unknown): void {
        this.cache.set(key, { data, expires: Date.now() + this.CACHE_TTL_MS });

        // Evict old entries if cache grows too large
        if (this.cache.size > 100) {
            const now = Date.now();
            for (const [k, v] of this.cache) {
                if (v.expires < now) this.cache.delete(k);
            }
        }
    }
}

export const devKnowledgeService = new DevKnowledgeService();
