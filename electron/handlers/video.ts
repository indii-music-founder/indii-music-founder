import { ipcMain, app } from 'electron';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

/**
 * Downloads a file from a URL to a local path.
 */
async function downloadFile(url: string, destinationPath: string) {
    const response = await fetch(url);
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
    ipcMain.handle('video:save-asset', async (_event, url: string, filename: string) => {
        try {
            // Define the shared asset folder
            const documentsPath = app.getPath('documents');
            const assetDir = path.join(documentsPath, 'IndiiOS', 'Assets', 'Video');

            // Ensure directory exists
            await fs.promises.mkdir(assetDir, { recursive: true });

            // Generate safe filename (using the provided one or a timestamp)
            const safeName = filename.replace(/[^a-z0-9.]/gi, '_');
            const destinationPath = path.join(assetDir, safeName);

            // Check if file already exists to avoid overwriting (optional: append index)
            // For now, we overwrite or rely on unique filenames (UUIDs usually)

            console.log(`[VideoHandler] Downloading video to: ${destinationPath}`);
            await downloadFile(url, destinationPath);

            // Return the local file path
            return destinationPath;
        } catch (error) {
            console.error('[VideoHandler] Failed to save asset:', error);
            throw error;
        }
    });

    ipcMain.handle('video:open-folder', async (_event, filePath?: string) => {
        const documentsPath = app.getPath('documents');
        const assetDir = path.join(documentsPath, 'IndiiOS', 'Assets', 'Video');
        const target = filePath ? filePath : assetDir;

        const { shell } = require('electron');
        await shell.showItemInFolder(target);
    });
}
