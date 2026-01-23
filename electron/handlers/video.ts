import { ipcMain, app, shell } from 'electron';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { z } from 'zod';
import { validateSender } from '../utils/ipc-security';
import { validateSafeUrlAsync } from '../utils/network-security';
import { FetchUrlSchema } from '../utils/validation';

/**
 * Downloads a file from a URL to a local path.
 */
async function downloadFile(url: string, destinationPath: string) {
    // Security: Disable redirects to prevent Open Redirect SSRF bypass
    const response = await fetch(url, { redirect: 'error' });
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    if (!response.body) throw new Error(`No body in response for ${url}`);

    // Create directory if it doesn't exist
    await fs.promises.mkdir(path.dirname(destinationPath), { recursive: true });

    // Use stream pipeline for efficient writing
    const stream = Readable.fromWeb(response.body as any); // Type cast for Node compatibility
    const fileStream = fs.createWriteStream(destinationPath);
    await pipeline(stream, fileStream);
}

export function registerVideoHandlers() {
    ipcMain.handle('video:save-asset', async (event, url: string, filename: string) => {
        try {
            validateSender(event);

            // Validate URL (SSRF Protection)
            FetchUrlSchema.parse(url);
            await validateSafeUrlAsync(url);

            // Validate Filename presence
            if (!filename || typeof filename !== 'string') {
                throw new Error("Invalid filename");
            }

            // Define the shared asset folder
            const documentsPath = app.getPath('documents');
            const assetDir = path.join(documentsPath, 'IndiiOS', 'Assets', 'Video');

            // Ensure directory exists
            await fs.promises.mkdir(assetDir, { recursive: true });

            // Generate safe filename (using the provided one or a timestamp)
            // SECURITY: Prevent Path Traversal by stripping directory components and sanitizing characters
            const baseName = path.basename(filename);
            const safeName = baseName.replace(/[^a-z0-9.]/gi, '_');
            const destinationPath = path.join(assetDir, safeName);

            // Check if file already exists to avoid overwriting (optional: append index)
            // For now, we overwrite or rely on unique filenames (UUIDs usually)

            console.log(`[VideoHandler] Downloading video to: ${destinationPath}`);
            await downloadFile(url, destinationPath);

            // Return the local file path
            return destinationPath;
        } catch (error) {
            console.error('[VideoHandler] Failed to save asset:', error);
            if (error instanceof z.ZodError) {
                throw new Error(`Validation Error: ${error.errors[0].message}`);
            }
            throw error;
        }
    });

    ipcMain.handle('video:open-folder', async (event, filePath?: string) => {
        try {
            validateSender(event);

            const documentsPath = app.getPath('documents');
            const assetDir = path.join(documentsPath, 'IndiiOS', 'Assets', 'Video');
            let target = assetDir;

            if (filePath) {
                // Security Check: Ensure filePath is within assetDir
                // We resolve both paths to absolute paths to prevent relative path attacks
                const resolvedPath = path.resolve(filePath);
                const resolvedAssetDir = path.resolve(assetDir);

                // Check for traversal or access outside asset dir
                // Note: This string comparison is case-sensitive. On Windows/macOS this might be too strict
                // if the case differs, but it is secure.
                const safePrefix = resolvedAssetDir.endsWith(path.sep) ? resolvedAssetDir : resolvedAssetDir + path.sep;
                if (resolvedPath !== resolvedAssetDir && !resolvedPath.startsWith(safePrefix)) {
                    console.error(`[Security] Blocked access to unauthorized path: ${resolvedPath}`);
                    throw new Error("Security: Access Denied. Cannot open folders outside of Assets/Video.");
                }
                target = resolvedPath;
            }

            await shell.showItemInFolder(target);
        } catch (error) {
            console.error('[VideoHandler] Failed to open folder:', error);
            throw error;
        }
    });
}
