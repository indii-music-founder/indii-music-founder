import { logger } from '@/utils/logger';
import { runAgenticWorkflow } from '@/services/rag/ragService';
import { db, auth } from '@/services/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

import { wrapTool, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { devKnowledgeService } from '@/services/knowledge/DevKnowledgeService';

export const KnowledgeTools = {
    search_knowledge: wrapTool('search_knowledge', async (args: { query: string }) => {
        const { useStore } = await import('@/core/store');
        const store = useStore.getState();
        const userProfile = store.userProfile;

        if (!userProfile) {
            return toolError("User profile not loaded. Please log in.", "AUTH_REQUIRED");
        }

        // We pass a simple logger for updates
        // Note: activeTrack is null for now as it's not strictly required for general knowledge queries
        const { asset } = await runAgenticWorkflow(
            args.query,
            userProfile,
            null,
            (update) => logger.info(`[KnowledgeTools] ${update}`),
            () => { } // Update Doc Status dummy
        );

        // Return structured data for the agent to consume
        const result = {
            answer: asset.content,
            sources: asset.sources.map(s => ({
                title: s.name
            })),
            message: "Knowledge search completed successfully."
        };

        // Item 415: Persist knowledge search to Firestore for session history/audit
        if (auth.currentUser) {
            const historyCol = collection(db, 'knowledge_history');
            addDoc(historyCol, {
                userId: auth.currentUser.uid,
                query: args.query,
                answer: result.answer,
                sourceCount: result.sources.length,
                timestamp: serverTimestamp()
            }).catch(err => logger.warn('[KnowledgeTools] Failed to persist search history:', err));
        }

        return result;
    }),

    /**
     * Search Google's official developer documentation via the Developer Knowledge API.
     * Covers Firebase, Android, Cloud, Google AI, Chrome, and more.
     * Returns relevant snippets and full page content.
     */
    search_google_docs: wrapTool('search_google_docs', async (args: { query: string; maxResults?: number }) => {
        if (!devKnowledgeService.isAvailable()) {
            return toolError(
                "Developer Knowledge API not configured. Set VITE_GOOGLE_DEVKNOWLEDGE_API_KEY.",
                "CONFIG_MISSING"
            );
        }

        const searchResults = await devKnowledgeService.search(args.query);

        if (searchResults.chunks.length === 0) {
            return {
                answer: `No Google developer documentation found for "${args.query}".`,
                results: [],
                message: "No results found."
            };
        }

        // Return snippets for quick answers
        const topChunks = searchResults.chunks.slice(0, args.maxResults || 5);

        const result = {
            answer: topChunks.map(c => c.content).join('\n\n---\n\n'),
            results: topChunks.map(c => ({
                snippet: c.content.slice(0, 300),
                parent: c.parent,
                uri: c.uri,
                score: c.score,
            })),
            message: `Found ${searchResults.chunks.length} results from Google developer docs.`
        };

        // Item 415: Persist Google search to Firestore
        if (auth.currentUser) {
            const historyCol = collection(db, 'google_search_history');
            addDoc(historyCol, {
                userId: auth.currentUser.uid,
                query: args.query,
                resultCount: searchResults.chunks.length,
                timestamp: serverTimestamp()
            }).catch(err => logger.warn('[KnowledgeTools] Failed to persist Google search history:', err));
        }

        return result;
    }),

    /**
     * Fetch the full content of a Google developer documentation page.
     * Use the 'parent' field from search_google_docs results.
     */
    get_google_doc: wrapTool('get_google_doc', async (args: { documentName: string }) => {
        if (!devKnowledgeService.isAvailable()) {
            return toolError(
                "Developer Knowledge API not configured. Set VITE_GOOGLE_DEVKNOWLEDGE_API_KEY.",
                "CONFIG_MISSING"
            );
        }

        const doc = await devKnowledgeService.getDocument(args.documentName);

        return {
            content: doc.markdown,
            name: doc.name,
            uri: doc.uri,
            message: "Document retrieved successfully."
        };
    }),
} satisfies Record<string, AnyToolFunction>;
