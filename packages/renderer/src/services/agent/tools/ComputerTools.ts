import { wrapTool, toolError, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { logger } from '@/utils/logger';

/**
 * ComputerTools: OS-level "Hands & Eyes" — CE-1 (ISSUE-1110), read path only.
 * Provides screen capture and app inventory via the Electron IPC bridge (native desktop).
 * Web sessions without the IPC bridge return a clear error — no silent fallback,
 * same fail-closed contract as BrowserTools.ts (BROWSER_DESKTOP_ONLY → COMPUTER_DESKTOP_ONLY).
 *
 * Input control (click/type/key/scroll) and the autonomous drive loop are CE-2/CE-3
 * (ISSUE-1111/1112) — not implemented here. See docs/COMPUTER_EXECUTION_EXTENSION.md.
 */
export const ComputerTools = {
    /**
     * Preflights macOS TCC permissions (Screen Recording, Accessibility) before any capture.
     */
    computer_check_permissions: wrapTool('computer_check_permissions', async () => {
        try {
            if (typeof window !== 'undefined' && window.electronAPI?.computer) {
                const result = await window.electronAPI.computer.checkPermissions();
                if (result.success) {
                    return toolSuccess(result.data, 'Permission status retrieved.');
                }
                return toolError(result.error || 'Permission check failed', 'COMPUTER_PERMISSIONS_ERROR');
            }

            return toolError(
                'Computer control requires the indii desktop app. Web sessions do not support native computer control.',
                'COMPUTER_DESKTOP_ONLY'
            );
        } catch (error: unknown) {
            logger.error('[ComputerTools] computer_check_permissions error:', error);
            return toolError(`Failed to invoke permission check: ${String(error)}`, 'COMPUTER_INVOKE_ERROR');
        }
    }),

    /**
     * Captures a screenshot of the desktop (or a specific display).
     */
    computer_screenshot: wrapTool('computer_screenshot', async (args: { displayId?: number }) => {
        try {
            if (typeof window !== 'undefined' && window.electronAPI?.computer) {
                const result = await window.electronAPI.computer.screenshot(args);
                if (result.success) {
                    return toolSuccess(result.data, 'Screenshot captured successfully.');
                }
                return toolError(result.error || 'Screenshot failed', 'COMPUTER_SCREENSHOT_ERROR');
            }

            return toolError(
                'Computer control requires the indii desktop app.',
                'COMPUTER_DESKTOP_ONLY'
            );
        } catch (error: unknown) {
            logger.error('[ComputerTools] computer_screenshot error:', error);
            return toolError(`Failed to invoke screenshot: ${String(error)}`, 'COMPUTER_INVOKE_ERROR');
        }
    }),

    /**
     * Lists currently running, user-facing applications.
     */
    computer_list_apps: wrapTool('computer_list_apps', async () => {
        try {
            if (typeof window !== 'undefined' && window.electronAPI?.computer) {
                const result = await window.electronAPI.computer.listApps();
                if (result.success) {
                    return toolSuccess(result.data, 'Application list retrieved.');
                }
                return toolError(result.error || 'List apps failed', 'COMPUTER_LIST_APPS_ERROR');
            }

            return toolError(
                'Computer control requires the indii desktop app.',
                'COMPUTER_DESKTOP_ONLY'
            );
        } catch (error: unknown) {
            logger.error('[ComputerTools] computer_list_apps error:', error);
            return toolError(`Failed to invoke list apps: ${String(error)}`, 'COMPUTER_INVOKE_ERROR');
        }
    }),

    /**
     * Launches an application by bundle id or display name. Allowlist/policy enforcement
     * lives in the main process (packages/main/src/services/ComputerExecutionService.ts).
     */
    computer_open_app: wrapTool('computer_open_app', async (args: { app: string }) => {
        try {
            if (typeof window !== 'undefined' && window.electronAPI?.computer) {
                const result = await window.electronAPI.computer.openApp(args.app);
                if (result.success) {
                    return toolSuccess(result.data, `Successfully opened ${args.app}`);
                }
                return toolError(result.error || 'Open app failed', 'COMPUTER_OPEN_APP_ERROR');
            }

            return toolError(
                'Computer control requires the indii desktop app.',
                'COMPUTER_DESKTOP_ONLY'
            );
        } catch (error: unknown) {
            logger.error('[ComputerTools] computer_open_app error:', error);
            return toolError(`Failed to invoke open app: ${String(error)}`, 'COMPUTER_INVOKE_ERROR');
        }
    })
} satisfies Record<string, AnyToolFunction>;
