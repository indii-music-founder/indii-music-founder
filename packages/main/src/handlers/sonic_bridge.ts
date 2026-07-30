/**
 * Sonic Bridge — watches a DAW bounce folder for new audio and forwards it to the app.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ISSUE-1283 — UNREACHABLE FROM THE RENDERER. DO NOT ASSUME THIS IS LIVE.
 *
 * `registerSonicBridgeHandlers()` is called from main.ts and registers
 * `sonic-bridge:watch-folder` and `sonic-bridge:stop-watching`, but
 * `handlers/preload.ts` exposes no `sonicBridge` key on `window.electronAPI`, so
 * the renderer has no way to invoke either channel. Verified 2026-07-29 by
 * diffing every registered `ipcMain.handle` channel against every
 * `ipcRenderer.invoke` in preload.ts; a repo-wide grep also finds zero renderer
 * references to `sonicBridge`/`sonic-bridge`.
 *
 * Unlike the Web3/Pinata handlers next door — whose unfinished state is a
 * deliberate, documented deferral — it is NOT established whether this was meant
 * to ship. Left in place rather than deleted per the Asset Deletion Fail-Safe
 * (CLAUDE.md §7); needs a human decision to either wire up the preload exposure
 * or remove it.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { ipcMain, dialog, BrowserWindow } from 'electron';
import chokidar from 'chokidar';
import path from 'path';
import log from 'electron-log';
import { validateSender } from '../utils/ipc-security';

let watcher: ReturnType<typeof chokidar.watch> | null = null;

export function registerSonicBridgeHandlers() {
    /**
     * Start watching a folder for new audio bounces.
     */
    ipcMain.handle('sonic-bridge:watch-folder', async (event) => {
        validateSender(event);
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window) return { success: false, error: 'No window found' };

        const result = await dialog.showOpenDialog(window, {
            properties: ['openDirectory', 'createDirectory'],
            title: 'Select your DAW Bounce Folder'
        });

        if (result.canceled || result.filePaths.length === 0) {
            return { success: false, error: 'Cancelled' };
        }

        const watchPath = result.filePaths[0];
        
        if (watcher) {
            await watcher.close();
        }

        log.info(`[SonicBridge] Starting watch on: ${watchPath}`);
        
        watcher = chokidar.watch(watchPath, {
            ignored: /(^|[/\\])\../, // ignore dotfiles
            persistent: true,
            ignoreInitial: true,
            depth: 0 // only top level for bounces usually
        });

        watcher.on('add', (filePath: string) => {
            const ext = path.extname(filePath).toLowerCase();
            if (['.wav', '.mp3', '.aif', '.flac'].includes(ext)) {
                log.info(`[SonicBridge] New bounce detected: ${filePath}`);
                if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
                    try {
                        window.webContents.send('sonic-bridge:new-bounce', {
                            path: filePath,
                            name: path.basename(filePath),
                            timestamp: Date.now()
                        });
                    } catch (err) {
                        log.warn(`[SonicBridge] Failed to send new bounce event: ${err}`);
                    }
                }
            }
        });

        return { success: true, path: watchPath };
    });

    /**
     * Stop watching.
     */
    ipcMain.handle('sonic-bridge:stop-watching', async (event) => {
        validateSender(event);
        if (watcher) {
            await watcher.close();
            watcher = null;
            log.info('[SonicBridge] Watcher stopped.');
        }
        return { success: true };
    });
}
