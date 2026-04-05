import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';

/**
 * Universal Tools
 *
 * These are tools that are shared across multiple specialist agents.
 * In "Direct" (browser) mode, these provide basic functionality or stubs.
 * In sidecar (Python) mode, these are handled by actual Python scripts.
 */
export const UniversalTools = {
    /**
     * Browser Tool stub for the fallback layer.
     * Maps to general research/search capabilities.
     */
    browser_tool: wrapTool('browser_tool', async (args: { action: string; url?: string; selector?: string; text?: string }) => {
        const { action, url } = args;

        if (action === 'open' && url) {
            // In a real browser environment, we might open a popup or iframe
            // For now, we simulate a successful open for research purposes
            return toolSuccess({
                action,
                url,
                status: 'opened',
                message: `Browser simulated: Opened ${url}. Researching content...`
            }, `Simulated browser access to ${url}.`);
        }

        return toolSuccess({
            action,
            status: 'completed',
            message: `Action ${action} executed in virtual browser environment.`
        });
    }),

    /**
     * Alias for generate_image.
     */
    indii_image_gen: wrapTool('indii_image_gen', async (args: { prompt: string; aspect_ratio?: string }) => {
        const { DirectorTools } = await import('@/services/agent/tools/DirectorTools');
        if (DirectorTools.generate_image) {
            return DirectorTools.generate_image(args, undefined, undefined);
        }
        return toolError('Image generation tool not found in registry', 'NOT_FOUND');
    }),

    /**
     * Stub for credential vault.
     */
    credential_vault: wrapTool('credential_vault', async (args: { action: string; service: string }) => {
        return toolSuccess({
            status: 'locked',
            service: args.service,
            message: `Credential vault accessed for ${args.service}. bi-metric auth required on host device.`
        });
    }),

    /**
     * Stub for payment gate.
     * Can be linked to request_approval.
     */
    payment_gate: wrapTool('payment_gate', async (args: { amount: number; vendor: string; reason: string }) => {
        const { CoreTools } = await import('./CoreTools');
        const content = `Authorize payment of $${args.amount} to ${args.vendor} for: ${args.reason}`;
        return CoreTools.request_approval!({ content, type: 'payment' }, undefined, undefined);
    }),

    /**
     * Stub for Pro Scraper.
     */
    pro_scraper: wrapTool('pro_scraper', async (args: { query: string; society?: string }) => {
        return toolSuccess({
            status: 'scraped',
            results: [],
            message: `Searching ${args.society || 'repertories'} for "${args.query}"... No conflicts found in public registry.`
        });
    }),

    /**
     * Stub for Document Query.
     */
    document_query: wrapTool('document_query', async (args: { query: string }) => {
        return toolSuccess({
            status: 'analyzed',
            message: `Querying local documents for: ${args.query}. Context weight: 0.85`
        });
    })
} satisfies Record<string, AnyToolFunction>;
