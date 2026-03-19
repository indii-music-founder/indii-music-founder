import { wrapTool, toolError, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { logger } from '@/utils/logger';

/**
 * BrowserTools: The "Ghost Hands" (CDP Bridge)
 * Provides browser automation via the Electron IPC bridge (native desktop).
 * Web sessions without the IPC bridge return a clear error — no silent fallback.
 */
export const BrowserTools = {
    /**
     * Navigates to a URL and returns a snapshot of the page.
     */
    browser_navigate: wrapTool('browser_navigate', async (args: { url: string }) => {
        try {
            if (typeof window !== 'undefined' && window.electronAPI?.agent) {
                const result = await window.electronAPI.agent.navigateAndExtract(args.url);
                if (result.success) {
                    return toolSuccess(result, `Successfully navigated to ${args.url}`);
                }
                return toolError(result.error || 'Navigation failed', 'BROWSER_NAV_ERROR');
            }

            return toolError(
                'Browser automation requires the indiiOS desktop app. Web sessions do not support native browser control.',
                'BROWSER_DESKTOP_ONLY'
            );
        } catch (error) {
            logger.error('[BrowserTools] browser_navigate error:', error);
            return toolError(`Failed to invoke browser navigation: ${String(error)}`, 'BROWSER_INVOKE_ERROR');
        }
    }),

    /**
     * Performs an action (click, type, scroll, wait) on a page element.
     */
    browser_action: wrapTool('browser_action', async (args: { action: 'click' | 'type' | 'scroll' | 'wait', selector: string, text?: string }) => {
        try {
            if (typeof window !== 'undefined' && window.electronAPI?.agent) {
                const result = await window.electronAPI.agent.performAction(args.action, args.selector, args.text);
                if (result.success) {
                    return toolSuccess(result, `Successfully performed ${args.action} on ${args.selector}`);
                }
                return toolError(result.error || 'Action failed', 'BROWSER_ACTION_ERROR');
            }

            return toolError(
                'Browser automation requires the indiiOS desktop app.',
                'BROWSER_DESKTOP_ONLY'
            );
        } catch (error) {
            logger.error('[BrowserTools] browser_action error:', error);
            return toolError(`Failed to invoke browser action: ${String(error)}`, 'BROWSER_INVOKE_ERROR');
        }
    }),

    /**
     * Captures the current state of the browser session.
     */
    browser_snapshot: wrapTool('browser_snapshot', async () => {
        try {
            if (typeof window !== 'undefined' && window.electronAPI?.agent) {
                const result = await window.electronAPI.agent.captureState();
                if (result.success) {
                    return toolSuccess(result, 'Snapshot captured successfully.');
                }
                return toolError(result.error || 'Snapshot failed', 'BROWSER_SNAPSHOT_ERROR');
            }

            return toolError(
                'Browser automation requires the indiiOS desktop app.',
                'BROWSER_DESKTOP_ONLY'
            );
        } catch (error) {
            logger.error('[BrowserTools] browser_snapshot error:', error);
            return toolError(`Failed to invoke browser snapshot: ${String(error)}`, 'BROWSER_INVOKE_ERROR');
        }
    })
} satisfies Record<string, AnyToolFunction>;
