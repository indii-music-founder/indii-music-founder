import log from 'electron-log';
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { validateSender } from '../utils/ipc-security';
import { accessControlService } from '../security/AccessControlService';

function resolveFsPath(rawPath: string): string {
    if (!rawPath || typeof rawPath !== 'string') {
        throw new Error('Path must be a non-empty string');
    }
    if (rawPath.includes('\0')) {
        throw new Error('Path contains invalid null byte characters');
    }
    let trimmed = rawPath.trim();
    if (trimmed.startsWith('~/') || trimmed === '~') {
        const homeDir = os.homedir();
        trimmed = path.join(homeDir, trimmed.slice(1));
    }
    return path.resolve(trimmed);
}

export function registerFsHandlers(): void {
    ipcMain.handle('fs:list-files', async (event: IpcMainInvokeEvent, dirPath: string) => {
        validateSender(event);
        const resolvedDir = resolveFsPath(dirPath);

        if (!accessControlService.verifyAccess(resolvedDir)) {
            throw new Error(`Security Violation: Access to ${resolvedDir} is denied.`);
        }

        const stat = await fs.promises.stat(resolvedDir);
        if (!stat.isDirectory()) {
            throw new Error(`Path is not a directory: ${resolvedDir}`);
        }

        const entries = await fs.promises.readdir(resolvedDir, { withFileTypes: true });
        const files: Array<{ name: string; path: string; extension: string; sizeBytes: number }> = [];

        for (const entry of entries) {
            if (entry.isFile()) {
                const fullPath = path.join(resolvedDir, entry.name);
                try {
                    const s = await fs.promises.stat(fullPath);
                    files.push({
                        name: entry.name,
                        path: fullPath,
                        extension: path.extname(entry.name).toLowerCase(),
                        sizeBytes: s.size,
                    });
                } catch (err) {
                    log.warn(`[FsHandler] Failed to stat file ${fullPath}:`, err);
                }
            }
        }

        return files;
    });

    ipcMain.handle('fs:read-text-file', async (event: IpcMainInvokeEvent, filePath: string) => {
        validateSender(event);
        const resolvedPath = resolveFsPath(filePath);

        if (!accessControlService.verifyAccess(resolvedPath)) {
            throw new Error(`Security Violation: Access to ${resolvedPath} is denied.`);
        }

        return await fs.promises.readFile(resolvedPath, 'utf-8');
    });

    ipcMain.handle('fs:read-binary-file', async (event: IpcMainInvokeEvent, filePath: string) => {
        validateSender(event);
        const resolvedPath = resolveFsPath(filePath);

        if (!accessControlService.verifyAccess(resolvedPath)) {
            throw new Error(`Security Violation: Access to ${resolvedPath} is denied.`);
        }

        const buffer = await fs.promises.readFile(resolvedPath);
        return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    });

    ipcMain.handle('fs:mkdir', async (event: IpcMainInvokeEvent, dirPath: string) => {
        validateSender(event);
        const resolvedDir = resolveFsPath(dirPath);

        const isAllowed = accessControlService.isWithinAllowedRoots(resolvedDir)
            || accessControlService.verifyWriteTargetDirectory(resolvedDir);

        if (!isAllowed) {
            throw new Error(`Security Violation: Access to create directory ${resolvedDir} is denied.`);
        }

        await fs.promises.mkdir(resolvedDir, { recursive: true });
    });
}
