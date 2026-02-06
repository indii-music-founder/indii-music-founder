import { wrapTool, toolError, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';

/**
 * BrowserTools: The "Ghost Hands" (CDP Bridge)
 * Provides browser automation capabilities to the indii agent system.
 */
export const BrowserTools: Record<string, AnyToolFunction> = {
    /**
     * Navigates to a URL and returns a snapshot of the page.
     */
    browser_navigate: wrapTool('browser_navigate', async (args: { url: string }) => {
        try {
            // 1. Electron Desktop (Native IPC)
            // @ts-expect-error - electronAPI injected by Electron preload
            if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.agent) {
                // @ts-expect-error - electronAPI injected by Electron preload
                const result = await window.electronAPI.agent.navigateAndExtract(args.url);
                if (result.success) {
                    return toolSuccess(result, `Successfully navigated to ${args.url}`);
                } else {
                    return toolError(result.error || 'Navigation failed', 'BROWSER_NAV_ERROR');
                }
            }

            // 2. Web / Fallback (Agent Zero Container)
            console.warn('[BrowserTools] Native bridge missing. Delegating to Agent Zero Container...');
            const { agentZeroService } = await import('../AgentZeroService');

            // We ask Agent Zero to browse. It will use python/tools/browser.py
            const response = await agentZeroService.sendMessage(`Action: Navigate to ${args.url} and summarize the content.`);

            return toolSuccess({
                title: 'Agent Zero Browse Result',
                url: args.url,
                text: response.message,
                screenshotBase64: null
            }, response.message);

        } catch (error) {
            return toolError(`Failed to invoke browser navigation: ${String(error)}`, 'BROWSER_INVOKE_ERROR');
        }
    }),

    /**
     * Performs an action (click, type, hover) on a page element.
     */
    browser_action: wrapTool('browser_action', async (args: { action: 'click' | 'type' | 'hover', selector: string, text?: string }) => {
        try {
            // 1. Electron Desktop (Native IPC)
            // @ts-expect-error - electronAPI injected by Electron preload
            if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.agent) {
                // @ts-expect-error - electronAPI injected by Electron preload
                const result = await window.electronAPI.agent.performAction(args.action, args.selector, args.text);
                if (result.success) {
                    return toolSuccess(result, `Successfully performed ${args.action} on ${args.selector}`);
                } else {
                    return toolError(result.error || 'Action failed', 'BROWSER_ACTION_ERROR');
                }
            }

            // 2. Web Fallback
            // Actions on web via Agent Zero are tricky because they are stateless requests.
            // We'll try to describe the intent.
            const { agentZeroService } = await import('../AgentZeroService');
            const actionDesc = `${args.action} on '${args.selector}'${args.text ? ` with text '${args.text}'` : ''}`;
            const response = await agentZeroService.sendMessage(`Action: Perform ${actionDesc} in the browser.`);

            return toolSuccess({ success: true }, response.message);

        } catch (error) {
            return toolError(`Failed to invoke browser action: ${String(error)}`, 'BROWSER_INVOKE_ERROR');
        }
    }),

    /**
     * Captures the current state of the browser session.
     */
    browser_snapshot: wrapTool('browser_snapshot', async () => {
        try {
            // 1. Electron Desktop (Native IPC)
            // @ts-expect-error - electronAPI injected by Electron preload
            if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.agent) {
                // @ts-expect-error - electronAPI injected by Electron preload
                const result = await window.electronAPI.agent.captureState();
                if (result.success) {
                    return toolSuccess(result, "Snapshot captured successfully.");
                } else {
                    return toolError(result.error || 'Snapshot failed', 'BROWSER_SNAPSHOT_ERROR');
                }
            }

            // 2. Web Fallback
            const { agentZeroService } = await import('../AgentZeroService');
            const response = await agentZeroService.sendMessage(`Action: What is currently visible in the browser?`);

            return toolSuccess({
                title: 'Agent Zero Snapshot',
                url: 'unknown',
                text: response.message,
                screenshotBase64: null
            }, response.message);

        } catch (error) {
            return toolError(`Failed to invoke browser snapshot: ${String(error)}`, 'BROWSER_INVOKE_ERROR');
        }
    })
};
