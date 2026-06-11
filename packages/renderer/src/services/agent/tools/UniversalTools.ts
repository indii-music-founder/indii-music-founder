import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';

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
        const { DirectorTools } = await import('@/services/agent/tools/DirectorTools');
        if (DirectorTools.generate_image) {
            return DirectorTools.generate_image(args, undefined, undefined);
        }
        return toolError('Image generation tool not found in registry', 'NOT_FOUND');
    }),

    /**
     * Credential vault bridge.
     */
    credential_vault: wrapTool('credential_vault', async (args: { action: string; service: string }) => {
        return toolError(
            `Credential vault action "${args.action}" for "${args.service}" requires the secure credential bridge.`,
            'CREDENTIAL_BRIDGE_UNAVAILABLE'
        );
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
     * PRO/repertory lookup.
     */
    pro_scraper: wrapTool('pro_scraper', async (args: { query: string; society?: string }) => {
        return toolError(
            `PRO/repertory lookup is not configured for ${args.society || 'the requested society'}. No registry search was performed for "${args.query}".`,
            'PRO_LOOKUP_UNAVAILABLE'
        );
    }),

    /**
     * Document query bridge.
     */
    document_query: wrapTool('document_query', async (args: { query: string }) => {
        return toolError(
            `Document query backend is not configured. No documents were searched for: ${args.query}.`,
            'DOCUMENT_QUERY_UNAVAILABLE'
        );
    })
} satisfies Record<string, AnyToolFunction>;
