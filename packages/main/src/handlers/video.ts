import log from 'electron-log';
import { ipcMain, app, shell } from 'electron';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { validateSender } from '../utils/ipc-security';
import { z } from 'zod';
import { validateSafeUrlAsync } from '../utils/network-security';
import { FetchUrlSchema } from '../utils/validation';
import { accessControlService } from '../security/AccessControlService';

/** Cap for video:save-asset downloads (2 GB) — disk-fill protection. */
const MAX_VIDEO_ASSET_BYTES = 2 * 1024 * 1024 * 1024;

/**
 * Downloads a file from a URL to a local path.
 */
async function downloadFile(url: string, destinationPath: string) {
    // SECURITY: Ensure URL is http or https to prevent LFI via file:// or other protocols
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        throw new Error(`Invalid URL protocol: ${url}`);
    }

    // Security: Disable redirects to prevent Open Redirect SSRF bypass
    const response = await fetch(url, { redirect: 'error' });
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    if (!response.body) throw new Error(`No body in response for ${url}`);

    // SECURITY: the download used to be unbounded — a compromised renderer
    // could fill the disk through this handler. Reject on the declared
    // Content-Length when present, and cap the stream itself (a server can
    // lie about or omit Content-Length).
    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_VIDEO_ASSET_BYTES) {
        throw new Error(
            `Refusing to download ${declaredLength} bytes — exceeds the ${MAX_VIDEO_ASSET_BYTES / (1024 * 1024 * 1024)} GB asset cap.`
        );
    }

    // Create directory if it doesn't exist
    await fs.promises.mkdir(path.dirname(destinationPath), { recursive: true });

    // Use stream pipeline for efficient writing
    const stream = Readable.fromWeb(response.body as unknown as import('stream/web').ReadableStream); // Type cast for Node compatibility
    let received = 0;
    stream.on('data', (chunk: Buffer) => {
        received += chunk.length;
        if (received > MAX_VIDEO_ASSET_BYTES) {
            stream.destroy(new Error(
                `Download exceeded the ${MAX_VIDEO_ASSET_BYTES / (1024 * 1024 * 1024)} GB asset cap.`
            ));
        }
    });
    const fileStream = fs.createWriteStream(destinationPath);
    try {
        await pipeline(stream, fileStream);
    } catch (error) {
        // Remove the partial file so a capped download cannot leave a giant
        // partial asset behind.
        await fs.promises.rm(destinationPath, { force: true }).catch(() => undefined);
        throw error;
    }
}

export function registerVideoHandlers() {
    ipcMain.handle('video:save-asset', async (event, url: string, filename: string) => {
        try {
            validateSender(event);

            // SECURITY: Validate filename against Path Traversal
            // 1. Explicitly reject ".." segments
            if (filename.includes('..')) {
                throw new Error(`Invalid filename: Path traversal detected in "${filename}"`);
            }
            // 2. Reject absolute paths (just in case)
            if (path.isAbsolute(filename)) {
                throw new Error(`Invalid filename: Absolute paths not allowed`);
            }
            // Validate URL (SSRF Protection)
            FetchUrlSchema.parse(url);
            await validateSafeUrlAsync(url);

            // Validate Filename presence
            if (!filename || typeof filename !== 'string') {
                throw new Error("Invalid filename");
            }

            // Define the shared asset folder
            const documentsPath = app.getPath('documents');
            const assetDir = path.join(documentsPath, 'indii', 'Assets', 'Video');

            // Ensure directory exists
            await fs.promises.mkdir(assetDir, { recursive: true });

            // Generate safe filename (using the provided one or a timestamp)
            // SECURITY: Prevent Path Traversal by stripping directory components and sanitizing characters
            const baseName = path.basename(filename);
            const safeName = baseName.replace(/[^a-z0-9.]/gi, '_');
            const destinationPath = path.join(assetDir, safeName);

            // Check if file already exists to avoid overwriting (optional: append index)
            // For now, we overwrite or rely on unique filenames (UUIDs usually)

            log.info(`[VideoHandler] Downloading video to: ${destinationPath}`);
            await downloadFile(url, destinationPath);

            // Grant access to the saved file
            accessControlService.grantAccess(destinationPath);

            // Return the local file path
            return destinationPath;
        } catch (error) {
            log.error('[VideoHandler] Failed to save asset:', error);
            if (error instanceof z.ZodError) {
                throw new Error(`Validation Error: ${error.errors[0].message}`);
            }
            throw error;
        }
    });

    ipcMain.handle('video:get-default-path', async (event, filename?: string) => {
        try {
            validateSender(event);
            const documentsPath = app.getPath('documents');
            const assetDir = path.join(documentsPath, 'indii', 'Assets', 'Video');
            if (filename) {
                const baseName = path.basename(filename);
                const safeName = baseName.replace(/[^a-z0-9.]/gi, '_');
                const targetPath = path.join(assetDir, safeName);
                accessControlService.grantAccess(targetPath);
                return targetPath;
            }
            accessControlService.grantAccess(assetDir);
            return assetDir;
        } catch (error) {
            log.error('[VideoHandler] Failed to get default path:', error);
            throw error;
        }
    });

    ipcMain.handle('video:open-folder', async (event, filePath?: string) => {
        try {
            validateSender(event);
            const documentsPath = app.getPath('documents');
            const assetDir = path.join(documentsPath, 'indii', 'Assets', 'Video');

            // If filePath is provided, ensure it is within assetDir
            let target = assetDir;

            if (filePath) {
                const resolved = path.resolve(filePath);
                const safeRoot = path.resolve(assetDir) + path.sep;
                // Allow opening exactly the assetDir or files inside it
                // Fix: Ensure we don't block opening the dir itself
                const resolvedAssetDir = path.resolve(assetDir);
                if (resolved !== resolvedAssetDir && !resolved.startsWith(safeRoot)) {
                    throw new Error("Security Warning: Unauthorized path access");
                }
                target = resolved;
            }

            await shell.showItemInFolder(target);
        } catch (error) {
            log.error('[VideoHandler] Open folder failed:', error);
            throw error;
        }
    });

    ipcMain.handle('video:render', async (event, config: { compositionId: string; outputLocation: string }) => {
        try {
            validateSender(event);
            const { outputLocation } = config;

            // Security Check 1: Access Control
            const hasAccess = accessControlService.verifyAccess(outputLocation);
            if (!hasAccess) {
                throw new Error("Security Violation: Access Denied to output location");
            }

            // Security Check 2: Path Traversal
            if (outputLocation.includes('..')) {
                throw new Error("Security Violation: Path traversal detected");
            }

            // Security Check 3: Allowed Extensions
            const ext = path.extname(outputLocation).toLowerCase();
            const ALLOWED_EXTENSIONS = ['.mp4', '.mov', '.webm'];
            if (!ALLOWED_EXTENSIONS.includes(ext)) {
                throw new Error(`Security Violation: File type ${ext} is not allowed`);
            }

            // Security Check 4: Path Scope (defense in depth).
            // Checks 1-3 cannot catch a symlinked parent directory: the output file does
            // not exist yet so verifyAccess's realpathSync on it fails, and the Check 2
            // string test only sees literal '..'. A path with no '..' can still resolve
            // outside the allowed scope when a parent component is a symlink, so we
            // canonicalize the parent directory and re-check it. (ISSUE-1282: this block
            // previously computed an unused variable inside a swallowing try/catch and
            // enforced nothing at all.)
            if (!accessControlService.verifyWriteTargetDirectory(outputLocation)) {
                throw new Error("Security Violation: Output directory is outside the allowed scope");
            }

            // Invoke ElectronRenderService dynamically
            const { electronRenderService } = await import('../services/ElectronRenderService');
            return await electronRenderService.render(config);

        } catch (error) {
            log.error('[VideoHandler] Render failed:', error);
            throw error;
        }
    });
}
