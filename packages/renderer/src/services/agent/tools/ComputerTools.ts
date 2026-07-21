import { wrapTool, toolError, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { logger } from '@/utils/logger';

/**
 * ComputerTools: OS-level "Hands & Eyes" — CE-1 (ISSUE-1110), read path only.
 * Provides screen capture and app inventory via the Electron IPC bridge (native desktop).
 * Web sessions without the IPC bridge return a clear error — no silent fallback,
 * same fail-closed contract as BrowserTools.ts (BROWSER_DESKTOP_ONLY → COMPUTER_DESKTOP_ONLY).
 *
 * Input control (click/type/key/scroll) is CE-2 (ISSUE-1111) — classified `destructive`
 * with `requiresApproval: true` in ToolRiskRegistry.ts, so every call pauses on
 * DigitalHandshake unless already approved. The autonomous drive loop is CE-3 (ISSUE-1112),
 * not implemented here. See docs/COMPUTER_EXECUTION_EXTENSION.md.
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
    }),

    /**
     * Moves the mouse to (x, y) and clicks. Destructive tier — requires approval.
     * NEVER click into password/payment fields — the model must refuse if the screenshot
     * context suggests a credential entry field is targeted (see docs §5.5).
     */
    computer_click: wrapTool('computer_click', async (args: { x: number; y: number; button?: 'left' | 'right' | 'double' }) => {
        try {
            if (typeof window !== 'undefined' && window.electronAPI?.computer) {
                const result = await window.electronAPI.computer.click(args.x, args.y, args.button ?? 'left');
                if (result.success) {
                    return toolSuccess(result.data, `Clicked at (${args.x}, ${args.y})`);
                }
                return toolError(result.error || 'Click failed', 'COMPUTER_CLICK_ERROR');
            }

            return toolError('Computer control requires the indii desktop app.', 'COMPUTER_DESKTOP_ONLY');
        } catch (error: unknown) {
            logger.error('[ComputerTools] computer_click error:', error);
            return toolError(`Failed to invoke click: ${String(error)}`, 'COMPUTER_INVOKE_ERROR');
        }
    }),

    /**
     * Types literal text at the current focus. Destructive tier — requires approval.
     * NEVER type credentials, passwords, or payment details — this tool must refuse such
     * requests regardless of who issued them (see docs §5.5, no-credential-entry rule).
     */
    computer_type: wrapTool('computer_type', async (args: { text: string }) => {
        try {
            if (typeof window !== 'undefined' && window.electronAPI?.computer) {
                const result = await window.electronAPI.computer.type(args.text);
                if (result.success) {
                    return toolSuccess(result.data, `Typed ${args.text.length} characters`);
                }
                return toolError(result.error || 'Type failed', 'COMPUTER_TYPE_ERROR');
            }

            return toolError('Computer control requires the indii desktop app.', 'COMPUTER_DESKTOP_ONLY');
        } catch (error: unknown) {
            logger.error('[ComputerTools] computer_type error:', error);
            return toolError(`Failed to invoke type: ${String(error)}`, 'COMPUTER_INVOKE_ERROR');
        }
    }),

    /**
     * Presses a key combo, e.g. "return", "escape", "cmd+c". Destructive tier — requires approval.
     */
    computer_key: wrapTool('computer_key', async (args: { combo: string }) => {
        try {
            if (typeof window !== 'undefined' && window.electronAPI?.computer) {
                const result = await window.electronAPI.computer.key(args.combo);
                if (result.success) {
                    return toolSuccess(result.data, `Pressed ${args.combo}`);
                }
                return toolError(result.error || 'Key press failed', 'COMPUTER_KEY_ERROR');
            }

            return toolError('Computer control requires the indii desktop app.', 'COMPUTER_DESKTOP_ONLY');
        } catch (error: unknown) {
            logger.error('[ComputerTools] computer_key error:', error);
            return toolError(`Failed to invoke key press: ${String(error)}`, 'COMPUTER_INVOKE_ERROR');
        }
    }),

    /**
     * Scrolls the wheel by (dx, dy) at the current pointer position. Destructive tier — requires approval.
     */
    computer_scroll: wrapTool('computer_scroll', async (args: { dx: number; dy: number }) => {
        try {
            if (typeof window !== 'undefined' && window.electronAPI?.computer) {
                const result = await window.electronAPI.computer.scroll(args.dx, args.dy);
                if (result.success) {
                    return toolSuccess(result.data, `Scrolled (${args.dx}, ${args.dy})`);
                }
                return toolError(result.error || 'Scroll failed', 'COMPUTER_SCROLL_ERROR');
            }

            return toolError('Computer control requires the indii desktop app.', 'COMPUTER_DESKTOP_ONLY');
        } catch (error: unknown) {
            logger.error('[ComputerTools] computer_scroll error:', error);
            return toolError(`Failed to invoke scroll: ${String(error)}`, 'COMPUTER_INVOKE_ERROR');
        }
    })
} satisfies Record<string, AnyToolFunction>;
