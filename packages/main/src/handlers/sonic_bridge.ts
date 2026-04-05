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
                window.webContents.send('sonic-bridge:new-bounce', {
                    path: filePath,
                    name: path.basename(filePath),
                    timestamp: Date.now()
                });
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
