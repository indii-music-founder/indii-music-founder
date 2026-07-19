/**
 * Google Developer Knowledge API Service
 *
 * Provides access to Google developer documentation when a secured backend
 * gateway exists.
 *
 * API Reference: https://developers.google.com/knowledge/api
 * Quickstart: https://developers.google.com/knowledge/quickstart
 *
 * Browser-side Developer Knowledge API key usage is disabled. Do not add
 * VITE_GOOGLE_DEVKNOWLEDGE_API_KEY back to the renderer.
 */

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
    /**
     * Check if the service is configured and ready to use.
     */
    isAvailable(): boolean {
        return false;
    }

    /**
     * Search Google developer documentation for relevant content.
     *
     * @param query - Search query (e.g., "Firebase App Check setup")
     * @returns Search results with document chunks and snippets
     */
    async search(query: string): Promise<SearchResult> {
        void query;
        throw new Error('Developer Knowledge API is backend-only. Configure a secured Firebase gateway before using this tool.');
    }

    /**
     * Retrieve the full Markdown content of a document.
     *
     * @param documentName - Document reference from search results (parent field)
     * @returns Full document content as Markdown
     */
    async getDocument(documentName: string): Promise<DocumentContent> {
        void documentName;
        throw new Error('Developer Knowledge API is backend-only. Configure a secured Firebase gateway before using this tool.');
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
}

export const devKnowledgeService = new DevKnowledgeService();
