import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { importWithRetry } from '@/utils/dynamicImport';

/**
 * Universal Tools
 *
 * These are tools that are shared across multiple specialist agents.
 * Browser/credential/repertory/document operations must be backed by a real
 * bridge or service. They fail closed when not configured.
 */
export const UniversalTools = {
    /**
     * Browser Tool bridge for research/search capabilities.
     */
    browser_tool: wrapTool('browser_tool', async (args: { action: string; url?: string; selector?: string; text?: string }) => {
        const bridge = window.electronAPI?.agent;
        if (!bridge) {
            return toolError('Browser bridge is unavailable. No browser action was performed.', 'BROWSER_BRIDGE_UNAVAILABLE');
        }

        let result: unknown;
        if (args.action === 'navigate' || args.action === 'extract') {
            if (!args.url) return toolError('Browser navigation requires a URL.', 'INVALID_INPUT');
            result = await bridge.navigateAndExtract(args.url);
        } else if (args.action === 'capture') {
            result = await bridge.captureState();
        } else if (['click', 'type', 'scroll', 'wait'].includes(args.action)) {
            if (!args.selector) return toolError(`Browser action "${args.action}" requires a selector.`, 'INVALID_INPUT');
            result = await bridge.performAction(args.action as 'click' | 'type' | 'scroll' | 'wait', args.selector, args.text);
        } else {
            return toolError(`Unsupported browser action: ${args.action}`, 'INVALID_INPUT');
        }

        return toolSuccess(result, `Browser action completed: ${args.action}.`);
    }),

    /**
     * Alias for generate_image.
     */
    indii_image_gen: wrapTool('indii_image_gen', async (args: { prompt: string; aspect_ratio?: string }) => {
        const { DirectorTools } = await importWithRetry(() => import('@/services/agent/tools/DirectorTools'));
        if (DirectorTools.generate_image) {
            return DirectorTools.generate_image(args, undefined, undefined);
        }
        return toolError('Image generation tool not found in registry', 'NOT_FOUND');
    }),

    /**
     * Credential vault bridge.
     */
    credential_vault: wrapTool('credential_vault', async (args: { action: string; service: string; credentials?: any; value?: any; data?: any; password?: any; token?: any; key?: any }) => {
        const action = args.action.toLowerCase();
        const service = args.service;

        if (window.electronAPI?.credentials) {
            try {
                if (action === 'get' || action === 'retrieve') {
                    const value = await window.electronAPI.credentials.get(service);
                    return toolSuccess({ credentials: value }, `Retrieved credentials for ${service} from secure vault.`);
                } else if (action === 'save' || action === 'store' || action === 'set') {
                    const val = args.credentials ?? args.value ?? args.data ?? args.password ?? args.token ?? args.key;
                    const { action: _a, service: _s, ...rest } = args;
                    const finalValue = val !== undefined ? val : rest;
                    await window.electronAPI.credentials.save(service, finalValue);
                    return toolSuccess({ success: true }, `Credentials for ${service} stored successfully in secure vault.`);
                } else if (action === 'delete' || action === 'remove') {
                    const success = await window.electronAPI.credentials.delete(service);
                    return toolSuccess({ success }, `Credentials for ${service} deleted from secure vault.`);
                } else {
                    return toolError(`Unsupported credential vault action: ${args.action}`, 'INVALID_INPUT');
                }
            } catch (error: unknown) {
                return toolError(`Credential vault bridge error: ${error instanceof Error ? error.message : String(error)}`, 'CREDENTIAL_BRIDGE_ERROR');
            }
        }

        // Fallback: localStorage for non-Electron / web-only dev environment
        try {
            const storageKey = `indii_vault_${service}`;
            if (action === 'get' || action === 'retrieve') {
                const stored = localStorage.getItem(storageKey);
                const credentials = stored ? JSON.parse(stored) : null;
                return toolSuccess({ credentials, fallback: true }, `Retrieved credentials for ${service} from fallback storage.`);
            } else if (action === 'save' || action === 'store' || action === 'set') {
                const val = args.credentials ?? args.value ?? args.data ?? args.password ?? args.token ?? args.key;
                const { action: _a, service: _s, ...rest } = args;
                const finalValue = val !== undefined ? val : rest;
                localStorage.setItem(storageKey, JSON.stringify(finalValue));
                return toolSuccess({ success: true, fallback: true }, `Credentials for ${service} saved in fallback storage.`);
            } else if (action === 'delete' || action === 'remove') {
                localStorage.removeItem(storageKey);
                return toolSuccess({ success: true, fallback: true }, `Credentials for ${service} deleted from fallback storage.`);
            } else {
                return toolError(`Unsupported credential vault action: ${args.action}`, 'INVALID_INPUT');
            }
        } catch (error: unknown) {
            return toolError(`Credential vault local storage fallback error: ${error instanceof Error ? error.message : String(error)}`, 'CREDENTIAL_FALLBACK_ERROR');
        }
    }),

    /**
     * Stub for payment gate.
     * Can be linked to request_approval.
     */
    payment_gate: wrapTool('payment_gate', async (args: { amount: number; vendor: string; reason: string }) => {
        const { CoreTools } = await importWithRetry(() => import('./CoreTools'));
        const content = `Authorize payment of $${args.amount} to ${args.vendor} for: ${args.reason}`;
        return CoreTools.request_approval!({ content, type: 'payment' }, undefined, undefined);
    }),

    /**
     * PRO/repertory lookup.
     */
    pro_scraper: wrapTool('pro_scraper', async (args: { query: string; society?: string }) => {
        try {
            const society = args.society || 'All Societies';
            let searchContext = '';

            // 1. Try to perform web search using browser bridge if available
            const bridge = window.electronAPI?.agent;
            if (bridge) {
                const queryStr = society !== 'All Societies' 
                    ? `site:${society.toLowerCase()}.com repertoire ${args.query}`
                    : `ASCAP BMI repertoire search ${args.query}`;
                const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(queryStr)}`;
                const result = await bridge.navigateAndExtract(searchUrl);
                if (result && typeof result === 'object' && 'text' in result) {
                    searchContext = (result as { text: string }).text;
                }
            }

            // 2. Query AutonomousIntelligence
            const { AutonomousIntelligence, getResponseText } = await importWithRetry(() => import('@/services/intelligence/AutonomousIntelligence'));
            const { getFineTunedModel } = await importWithRetry(() => import('../fine-tuned-models'));

            const systemPrompt = `You are a PRO registry data analyst. Analyze ONLY the provided search context from ASCAP, BMI, SESAC, PRS, GEMA, or MLC official websites. Return work details ONLY if present in the search context: work title, ISWC, writer names, publisher names, split percentages, society affiliations. If search context is empty or does not contain the requested work, return "not_found". Never use internal knowledge or guesses for registry data - all returned data must be sourced from the provided search context.`;
            const prompt = `Society Requested: ${society}\nSearch Query: ${args.query}\n\nOfficial Search Context:\n${searchContext || 'No live web search context available - cannot perform lookup without official source.'}`;

            const response = await AutonomousIntelligence.generateContent(
                prompt,
                getFineTunedModel('publishing'),
                undefined,
                systemPrompt
            );

            const resultText = getResponseText(response);

            return toolSuccess({
                query: args.query,
                society,
                results: resultText,
                source: searchContext ? 'official_web_search' : 'no_search_context',
                hasOfficialSource: Boolean(searchContext)
            }, searchContext
                ? `Repertoire search completed for "${args.query}" under ${society}. Results from official web search.`
                : `Search failed - no live web context available. PRO registries must be searched directly via official PRO websites (ascap.com, bmi.com, etc.) to verify work registration.`);
        } catch (error: unknown) {
            return toolError(
                `PRO lookup failed: ${error instanceof Error ? error.message : String(error)}`,
                'PRO_LOOKUP_FAILED'
            );
        }
    }),

    /**
     * Document query bridge.
     */
    document_query: wrapTool('document_query', async (args: { query: string; filePath?: string; fileUri?: string; documentId?: string }) => {
        let docContent = '';
        let fileName = args.filePath || args.fileUri || args.documentId || 'document';

        try {
            // 1. Try reading from filesystem if path provided
            const path = args.filePath || args.fileUri;
            const api = (window as any).electronAPI;
            if (path && api?.fs) {
                docContent = await api.fs.readTextFile(path);
            }

            // 2. Fallback to searching user contracts if no content yet
            if (!docContent) {
                const { LegalService } = await importWithRetry(() => import('@/services/legal/LegalService'));
                const contracts = await LegalService.getContracts();

                const match = contracts.find(c =>
                    c.id === args.documentId ||
                    (args.documentId && c.title.toLowerCase().includes(args.documentId.toLowerCase())) ||
                    (path && c.title.toLowerCase().includes(path.toLowerCase()))
                );

                const requestedSpecificDocument = Boolean(args.documentId || path);

                if (match) {
                    docContent = match.content;
                    fileName = match.title;
                } else if (requestedSpecificDocument) {
                    // ISSUE-832: a specific document was requested but not found —
                    // never silently substitute a different contract. That used
                    // to fall back to `contracts[0]`, risking analysis of the
                    // wrong legal agreement.
                    return toolError(
                        `No document found matching "${fileName}". Please provide a valid file path or document ID.`,
                        'DOCUMENT_NOT_FOUND'
                    );
                } else if (contracts.length > 1) {
                    // No specific document was requested and multiple contracts
                    // exist — ask the user to choose rather than guessing.
                    return toolError(
                        `Multiple saved contracts exist and no specific document was requested. Please specify one: ${contracts.map(c => `"${c.title}" (${c.id})`).join(', ')}.`,
                        'DOCUMENT_AMBIGUOUS',
                        { candidates: contracts.map(c => ({ id: c.id, title: c.title })) }
                    );
                } else if (contracts.length === 1) {
                    docContent = contracts[0]!.content;
                    fileName = contracts[0]!.title;
                }
            }

            if (!docContent) {
                return toolError(
                    `No document content found for: ${fileName}. Please provide a valid file path or ensure the document exists.`,
                    'DOCUMENT_NOT_FOUND'
                );
            }

            // 3. Query the content using the legal/licensing agent intelligence
            const { AutonomousIntelligence, getResponseText } = await importWithRetry(() => import('@/services/intelligence/AutonomousIntelligence'));
            const { getFineTunedModel } = await importWithRetry(() => import('../fine-tuned-models'));

            const systemPrompt = `You are the Legal Counsel for indii. Analyze the provided contract/document content. Support your answers with exact quotes and clause citations where applicable. Always include the disclaimer: "I am an AI, not a lawyer. This is for informational purposes only."`;
            const prompt = `Document Title/Source: ${fileName}\n\nDocument Content:\n${docContent}\n\nUser Query: ${args.query}`;

            const response = await AutonomousIntelligence.generateContent(
                prompt,
                getFineTunedModel('legal'),
                undefined,
                systemPrompt
            );

            const analysis = getResponseText(response);

            return toolSuccess({
                fileName,
                query: args.query,
                result: analysis
            }, `Successfully analyzed document "${fileName}" for query: "${args.query}"`);

        } catch (error: unknown) {
            return toolError(
                `Failed to query document: ${error instanceof Error ? error.message : String(error)}`,
                'DOCUMENT_QUERY_FAILED'
            );
        }
    })
} satisfies Record<string, AnyToolFunction>;
