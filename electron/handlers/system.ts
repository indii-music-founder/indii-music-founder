import { app, ipcMain, BrowserWindow, dialog } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { validateSender } from '../utils/ipc-security';
import { accessControlService } from '../security/AccessControlService';

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
            console.error(`[System] Error scanning directory: ${err}`);
            throw err;
        }
    });

    ipcMain.handle('system:get-gpu-info', async (event) => {
        validateSender(event);
        return {
            status: app.getGPUFeatureStatus(),
            info: await app.getGPUInfo('basic')
        };
    });

    ipcMain.handle('system:restart-ai', async (event) => {
        validateSender(event);
        const { DockerService } = await import('../services/DockerService');
        return await DockerService.restartSystem();
    });
}

