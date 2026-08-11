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
const TRASH_ID_PATTERN = /^trash_[A-Za-z0-9_-]{1,120}$/;

function isWithinRoot(root: string, candidate: string): boolean {
    return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}

function assertValidTrashId(trashId: unknown): asserts trashId is string {
    if (typeof trashId !== 'string' || !TRASH_ID_PATTERN.test(trashId)) {
        throw new Error('Security Violation: Invalid trash identifier.');
    }
}

function assertSafeRelativePath(relativePath: unknown, label: string): asserts relativePath is string {
    if (
        typeof relativePath !== 'string' ||
        relativePath.length === 0 ||
        relativePath.includes('\0') ||
        path.isAbsolute(relativePath)
    ) {
        throw new Error(`Security Violation: Invalid ${label}.`);
    }
    const segments = relativePath.split(/[\\/]+/);
    if (segments.includes('.indii-trash')) {
        throw new Error(`Security Violation: ${label} cannot address the Trash vault.`);
    }
}

async function resolveApprovedRoot(dirPath: string): Promise<string> {
    if (!accessControlService.verifyAccess(dirPath)) {
        throw new Error('Access denied. Folder is not an authorized approved folder.');
    }
    return fs.realpath(dirPath);
}

async function resolveTrashVault(root: string, trashId: string, mustExist: boolean): Promise<string> {
    assertValidTrashId(trashId);
    const expectedTrashRoot = path.resolve(root, '.indii-trash');
    const expectedVault = path.resolve(expectedTrashRoot, trashId);
    if (!isWithinRoot(expectedTrashRoot, expectedVault) || expectedVault === expectedTrashRoot) {
        throw new Error('Security Violation: Invalid trash vault path.');
    }

    if (mustExist) {
        const realVault = await fs.realpath(expectedVault);
        if (realVault !== expectedVault || !isWithinRoot(expectedTrashRoot, realVault)) {
            throw new Error('Security Violation: Trash vault resolved outside its approved location.');
        }
    }
    return expectedVault;
}

async function ensureSafeParent(root: string, targetPath: string): Promise<void> {
    const parent = path.dirname(targetPath);
    const relativeParent = path.relative(root, parent);
    let current = root;
    for (const segment of relativeParent.split(path.sep).filter(Boolean)) {
        current = path.join(current, segment);
        try {
            const stats = await fs.lstat(current);
            if (stats.isSymbolicLink()) {
                throw new Error('Security Violation: Restore path contains a symbolic link.');
            }
        } catch (error: unknown) {
            const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
            if (code === 'ENOENT') break;
            throw error;
        }
    }
    await fs.mkdir(parent, { recursive: true });
    const realParent = await fs.realpath(parent);
    if (!isWithinRoot(root, realParent)) {
        throw new Error('Security Violation: Restore parent resolved outside approved folder.');
    }
}

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
                if (assets.length >= maxResults || entry.isSymbolicLink() || entry.name === '.indii-trash' || entry.name.startsWith('.indii-trash')) continue;
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

    ipcMain.handle('trash:move', async (event, req: { approvedFolderId: string; dirPath: string; relativePath: string; trashId: string }) => {
        validateSender(event);
        assertSafeRelativePath(req.relativePath, 'trash source path');
        const root = await resolveApprovedRoot(req.dirPath);
        const requestedPath = path.resolve(root, req.relativePath);

        // Security check: path traversal and boundary check
        if (!isWithinRoot(root, requestedPath) || requestedPath === root) {
            throw new Error('Security Violation: Path traversal or unauthorized target path.');
        }

        const lstat = await fs.lstat(requestedPath);
        if (lstat.isSymbolicLink()) {
            throw new Error('Security Violation: Symbolic links cannot be moved to trash.');
        }
        const fullPath = await fs.realpath(requestedPath);
        if (!isWithinRoot(root, fullPath) || fullPath === root) {
            throw new Error('Security Violation: Trash source resolved outside approved folder.');
        }

        const trashVault = await resolveTrashVault(root, req.trashId, false);
        await fs.mkdir(trashVault, { recursive: true });
        const realTrashVault = await fs.realpath(trashVault);
        if (realTrashVault !== trashVault) {
            throw new Error('Security Violation: Trash vault contains a symbolic link.');
        }

        const filename = path.basename(fullPath);
        const destPath = path.join(trashVault, filename);

        try {
            await fs.lstat(destPath);
            throw new Error('Trash conflict: An item with this trash identifier already exists.');
        } catch (error: unknown) {
            const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
            if (code !== 'ENOENT') throw error;
        }

        // Atomic rename into vault inside approved root (same volume)
        await fs.rename(fullPath, destPath);

        return {
            success: true,
            trashId: req.trashId,
            relativePath: req.relativePath,
            name: filename,
            sizeBytes: lstat.size,
            isDirectory: lstat.isDirectory()
        };
    });

    ipcMain.handle('trash:restore', async (event, req: { dirPath: string; trashId: string; relativePath: string; targetRelativePath?: string }) => {
        validateSender(event);
        assertSafeRelativePath(req.relativePath, 'original relative path');
        const targetRel = req.targetRelativePath || req.relativePath;
        assertSafeRelativePath(targetRel, 'restore target path');
        const root = await resolveApprovedRoot(req.dirPath);
        const targetPath = path.resolve(root, targetRel);

        if (!isWithinRoot(root, targetPath) || targetPath === root) {
            throw new Error('Security Violation: Restore target path is outside approved folder.');
        }

        const trashVault = await resolveTrashVault(root, req.trashId, true);
        const filename = path.basename(req.relativePath);
        const srcPath = path.join(trashVault, filename);
        const realSource = await fs.realpath(srcPath);
        if (!isWithinRoot(trashVault, realSource)) {
            throw new Error('Security Violation: Restore source resolved outside Trash vault.');
        }

        // Check if destination file/folder already exists
        try {
            await fs.access(targetPath);
            return {
                success: false,
                conflict: true,
                error: `Restore conflict: Destination '${targetRel}' already exists.`
            };
        } catch (error: unknown) {
            const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
            if (code !== 'ENOENT') throw error;
        }

        // Ensure parent directory of target exists
        await ensureSafeParent(root, targetPath);

        // Atomic rename from vault to target path
        await fs.rename(srcPath, targetPath);

        // Clean up empty trash vault folder if empty
        await fs.rm(trashVault, { recursive: true, force: true }).catch(() => {});

        return { success: true, restoredPath: targetRel };
    });

    ipcMain.handle('trash:purge', async (event, req: { dirPath: string; trashId: string }) => {
        validateSender(event);
        const root = await resolveApprovedRoot(req.dirPath);
        const trashVault = await resolveTrashVault(root, req.trashId, false);
        try {
            const realVault = await fs.realpath(trashVault);
            if (realVault !== trashVault) {
                throw new Error('Security Violation: Trash vault resolved outside its approved location.');
            }
        } catch (error: unknown) {
            const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
            if (code !== 'ENOENT') throw error;
            // A prior confirmed purge may have removed the payload before its
            // cloud manifest was acknowledged. Re-confirming safely completes it.
        }

        // Mandatory native dialog confirmation in main process — CANNOT be bypassed by IPC
        const win = BrowserWindow.fromWebContents(event.sender);
        const options = {
            type: 'warning' as const,
            buttons: ['Cancel', 'Delete Permanently'],
            defaultId: 0,
            cancelId: 0,
            title: 'Confirm Permanent Deletion',
            message: 'Are you sure you want to permanently delete this local trashed item?',
            detail: 'This action is irreversible and will permanently remove the file from your storage.',
        };
        const choice = win ? await dialog.showMessageBox(win, options) : await dialog.showMessageBox(options);

        if (choice.response !== 1) {
            return { success: false, cancelled: true, message: 'Purge cancelled by user in native confirmation dialog.' };
        }

        await fs.rm(trashVault, { recursive: true, force: true });
        return { success: true, purgedTrashId: req.trashId };
    });

    ipcMain.handle('system:get-gpu-info', async (event) => {
        validateSender(event);
        return {
            status: app.getGPUFeatureStatus(),
            info: await app.getGPUInfo('basic')
        };
    });

}
