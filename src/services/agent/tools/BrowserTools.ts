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
            // Use the Electron IPC handler to perform the navigation
            // @ts-ignore - window.electron exists in the browser context
            const result = await window.electron.invoke('agent:navigate-and-extract', args.url);
            
            if (result.success) {
                return toolSuccess(result, `Successfully navigated to ${args.url}`);
            } else {
                return toolError(result.error || 'Navigation failed', 'BROWSER_NAV_ERROR');
            }
        } catch (error) {
            return toolError(`Failed to invoke browser navigation: ${String(error)}`, 'IPC_INVOKE_ERROR');
        }
    }),

    /**
     * Performs an action (click, type, hover) on a page element.
     */
    browser_action: wrapTool('browser_action', async (args: { action: 'click' | 'type' | 'hover', selector: string, text?: string }) => {
        try {
            // @ts-ignore
            const result = await window.electron.invoke('agent:perform-action', args.action, args.selector, args.text);
            
            if (result.success) {
                return toolSuccess(result, `Successfully performed ${args.action} on ${args.selector}`);
            } else {
                return toolError(result.error || 'Action failed', 'BROWSER_ACTION_ERROR');
            }
        } catch (error) {
            return toolError(`Failed to invoke browser action: ${String(error)}`, 'IPC_INVOKE_ERROR');
        }
    }),

    /**
     * Captures the current state of the browser session.
     */
    browser_snapshot: wrapTool('browser_snapshot', async () => {
        try {
            // @ts-ignore
            const result = await window.electron.invoke('agent:capture-state');
            
            if (result.success) {
                return toolSuccess(result, "Snapshot captured successfully.");
            } else {
                return toolError(result.error || 'Snapshot failed', 'BROWSER_SNAPSHOT_ERROR');
            }
        } catch (error) {
            return toolError(`Failed to invoke browser snapshot: ${String(error)}`, 'IPC_INVOKE_ERROR');
        }
    })
};
