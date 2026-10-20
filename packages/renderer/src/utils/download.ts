import { logger } from '@/utils/logger';
import { imageDownloadFilename } from './downloadFilename';

async function filenameForBlob(filename: string, blob: Blob): Promise<string> {
    const prefix = blob.slice(0, 12);
    const header = typeof prefix.arrayBuffer === 'function'
        ? new Uint8Array(await prefix.arrayBuffer())
        : undefined;
    return imageDownloadFilename(filename, blob.type, header);
}

/** Download an already encoded browser asset without round-tripping through a data URL. */
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
    const safeFilename = await filenameForBlob(filename, blob);
    const blobUrl = URL.createObjectURL(blob);
    try {
        const anchor = document.createElement('a');
        anchor.href = blobUrl;
        anchor.download = safeFilename;
        document.body.appendChild(anchor);
        try { anchor.click(); }
        finally { anchor.remove(); }
    } catch (failure) {
        URL.revokeObjectURL(blobUrl);
        throw failure;
    }
    // The browser's download manager can still be reading the object URL after click.
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

export async function downloadAsset(url: string, defaultFilename: string = 'download') {
    try {
        if (typeof window !== 'undefined' && window.electronAPI?.video?.saveAsset) {
            await window.electronAPI.video.saveAsset(url, defaultFilename);
            return true;
        }

        // Fallback for Web/Browser environment
        const a = document.createElement('a');
        const scheduleRevoke = (blobUrl: string) => {
            // Keep object URL alive for 60 seconds so browser download manager finishes reading stream
            if (typeof setTimeout === 'function') {
                setTimeout(() => {
                    try { URL.revokeObjectURL(blobUrl); } catch { /* ignore */ }
                }, 60_000);
            } else {
                try { URL.revokeObjectURL(blobUrl); } catch { /* ignore */ }
            }
        };

        if (url.startsWith('data:')) {
            // Convert data URL to Blob to prevent browser navigation/size drops on large (3000x3000px) canvases
            const response = await fetch(url);
            const blob = await response.blob();
            const filename = await filenameForBlob(defaultFilename, blob);
            const blobUrl = URL.createObjectURL(blob);
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            scheduleRevoke(blobUrl);
        } else {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Download failed with ${response.status} ${response.statusText}`);
            }

            const blob = await response.blob();
            const filename = await filenameForBlob(defaultFilename, blob);
            const blobUrl = URL.createObjectURL(blob);
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            scheduleRevoke(blobUrl);
        }
        return true;
    } catch (error: unknown) {
        logger.error('Failed to download asset:', error);
        return false;
    }
}
