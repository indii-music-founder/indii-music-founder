import log from 'electron-log';
import { app, ipcMain, BrowserWindow, dialog } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { validateSender } from '../utils/ipc-security';
import { accessControlService } from '../security/AccessControlService';

export interface ApprovedAssetMetadata {
    name: string;
    relativePath: string;
    extension: string;
    sizeBytes: number;
    modifiedAt: number;
}

const MAX_APPROVED_ASSET_RESULTS = 500;
const MAX_APPROVED_ASSET_DEPTH = 8;

export function registerSystemHandlers() {
    ipcMain.handle('get-platform', (event) => {
        validateSender(event);
        return process.platform;
    });

    ipcMain.handle('get-app-version', (event) => {
        validateSender(event);
        return app.getVersion();
    });

    ipcMain.handle('privacy:toggle-protection', (event, isEnabled) => {
        validateSender(event);
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) win.setContentProtection(isEnabled);
    });

    ipcMain.handle('system:select-file', async (event, options?: { title?: string, filters?: { name: string, extensions: string[] }[] }) => {
        validateSender(event);
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return null;

        const result = await dialog.showOpenDialog(win, {
            title: options?.title || 'Select File',
            properties: ['openFile'],
            filters: options?.filters
        });

        if (result.canceled) return null;

        if (result.filePaths.length > 0) {
            accessControlService.grantAccess(result.filePaths[0]);
        }

        return result.filePaths[0];
    });

    ipcMain.handle('system:select-directory', async (event, options?: { title?: string }) => {
        validateSender(event);
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return null;

        const result = await dialog.showOpenDialog(win, {
            title: options?.title || 'Select Directory',
            properties: ['openDirectory']
        });

        if (result.canceled) return null;

        if (result.filePaths.length > 0) {
            accessControlService.grantAccess(result.filePaths[0]);
        }

        return result.filePaths[0];
    });

    ipcMain.handle('system:get-directory-contents', async (event, dirPath: string, options?: { recursive?: boolean, extensions?: string[] }) => {
        validateSender(event);

        // Security: Verify Access Authorization
        if (!accessControlService.verifyAccess(dirPath)) {
            throw new Error(`Security Violation: Access to ${dirPath} is denied. Directory was not authorized by user.`);
        }

        const files: string[] = [];
        const scan = async (currentPath: string) => {
            const entries = await fs.readdir(currentPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);
                if (entry.isDirectory() && options?.recursive) {
                    await scan(fullPath);
                } else if (entry.isFile()) {
                    if (options?.extensions && options.extensions.length > 0) {
                        const ext = path.extname(entry.name).toLowerCase().replace('.', '');
                        if (options.extensions.includes(ext)) {
                            files.push(fullPath);
                        }
                    } else {
                        files.push(fullPath);
                    }
                }
            }
        };

        try {
            await scan(dirPath);
            return files;
        } catch (err) {
            log.error(`[System] Error scanning directory: ${err}`);
            throw err;
        }
    });

    /**
     * Enumerates only creator-approved directories for local asset discovery.
     * Paths never leave the main process: callers receive relative metadata,
     * not arbitrary filesystem handles or absolute locations.
     */
    ipcMain.handle('system:search-approved-assets', async (
        event,
        dirPath: string,
        options?: { query?: string; extensions?: string[]; maxResults?: number }
    ): Promise<ApprovedAssetMetadata[]> => {
        validateSender(event);
        if (!accessControlService.verifyAccess(dirPath)) {
            throw new Error('Access denied. Choose this folder in Studio before searching it remotely.');
        }

        const root = await fs.realpath(dirPath);
        const normalizedExtensions = new Set((options?.extensions || []).map(extension =>
            extension.trim().replace(/^\./, '').toLowerCase()
        ).filter(Boolean));
        const searchTerms = (options?.query || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
        const maxResults = Math.min(Math.max(options?.maxResults || 100, 1), MAX_APPROVED_ASSET_RESULTS);
        const assets: ApprovedAssetMetadata[] = [];

        const scan = async (currentPath: string, depth: number): Promise<void> => {
            if (depth > MAX_APPROVED_ASSET_DEPTH || assets.length >= maxResults) return;
            const entries = await fs.readdir(currentPath, { withFileTypes: true });
            for (const entry of entries) {
                if (assets.length >= maxResults || entry.isSymbolicLink()) continue;
                const fullPath = path.join(currentPath, entry.name);
                if (entry.isDirectory()) {
                    await scan(fullPath, depth + 1);
                    continue;
                }
                if (!entry.isFile()) continue;
                const extension = path.extname(entry.name).slice(1).toLowerCase();
                if (normalizedExtensions.size > 0 && !normalizedExtensions.has(extension)) continue;
                const searchable = `${entry.name} ${extension}`.toLowerCase();
                if (!searchTerms.every(term => searchable.includes(term))) continue;
                const stats = await fs.stat(fullPath);
                assets.push({
                    name: entry.name,
                    relativePath: path.relative(root, fullPath),
                    extension,
                    sizeBytes: stats.size,
                    modifiedAt: stats.mtimeMs,
                });
            }
        };

        await scan(root, 0);
        return assets;
    });

    ipcMain.handle('system:get-gpu-info', async (event) => {
        validateSender(event);
        return {
            status: app.getGPUFeatureStatus(),
            info: await app.getGPUInfo('basic')
        };
    });

}
