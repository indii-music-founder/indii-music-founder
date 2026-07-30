/**
 * Sonic Bridge — watches a DAW bounce folder for new audio and forwards it to the app.
 *
 * Flow: renderer calls `sonicBridge.watchFolder()` → native folder picker →
 * chokidar watches that folder (top level only, dotfiles ignored) → each new
 * .wav/.mp3/.aif/.flac fires `sonic-bridge:new-bounce` back to the window.
 *
 * ISSUE-1283: these handlers shipped long ago but `preload.ts` never exposed a
 * `sonicBridge` key, so the feature was unreachable from the renderer for its
 * entire existence. Wired up 2026-07-30 on founder instruction — see
 * `preload.ts` (bridge), `packages/shared/src/ipc/electron-api.types.ts`
 * (contract), and `hooks/useSonicBridge.ts` (renderer half).
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
