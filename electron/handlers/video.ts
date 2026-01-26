import { ipcMain, app, shell } from 'electron';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { validateSender } from '../utils/ipc-security';
import { z } from 'zod';
import { validateSender } from '../utils/ipc-security';
import { validateSafeUrlAsync } from '../utils/network-security';
import { FetchUrlSchema } from '../utils/validation';
import { accessControlService } from '../security/AccessControlService';
import { validateSafeDistributionSource } from '../utils/security-checks';

/**
 * Downloads a file from a URL to a local path.
 */
async function downloadFile(url: string, destinationPath: string) {
    // SECURITY: Ensure URL is http or https to prevent LFI via file:// or other protocols
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        throw new Error(`Invalid URL protocol: ${url}`);
    }

    const response = await fetch(url);
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

            // SECURITY: Validate filename against Path Traversal
            // 1. Explicitly reject ".." segments
            if (filename.includes('..')) {
                throw new Error(`Invalid filename: Path traversal detected in "${filename}"`);
            }
            // 2. Reject absolute paths (just in case)
            if (path.isAbsolute(filename)) {
                throw new Error(`Invalid filename: Absolute paths not allowed`);
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

            // Grant access to the saved file
            accessControlService.grantAccess(destinationPath);

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

            // If filePath is provided, ensure it is within assetDir
            const target = filePath ? filePath : assetDir;

            if (filePath) {
                 const resolved = path.resolve(filePath);
                 const safeRoot = path.resolve(assetDir) + path.sep;
                 // Allow opening exactly the assetDir or files inside it
                 if (resolved !== path.resolve(assetDir) && !resolved.startsWith(safeRoot)) {
                     // If it's not the dir itself and not inside it, check if it's the dir itself without sep
                     // Actually path.resolve(assetDir) is the dir.
                     throw new Error("Security Warning: Unauthorized path access");
                 }
            }

            const { shell } = require('electron');
            await shell.showItemInFolder(target);
        } catch (error) {
            console.error('[VideoHandler] Open folder failed:', error);

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

            // SECURITY: Validate Output Location (Arbitrary File Write Protection)
            if (config.outputLocation) {
                // 1. Check against System Roots and Forbidden Extensions
                validateSafeDistributionSource(config.outputLocation);

                // 2. Verify Access Authorization (Must be in user data, temp, or explicitly granted)
                if (!accessControlService.verifyAccess(config.outputLocation)) {
                    throw new Error(`Security Violation: Access to ${config.outputLocation} is denied.`);
                }
            }

            return await electronRenderService.render(config);
            await shell.showItemInFolder(target);
        } catch (error) {
            console.error('[VideoHandler] Failed to open folder:', error);
            throw error;
        }
    });
}
