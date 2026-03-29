import { logger } from '@/utils/logger';

export async function downloadAsset(url: string, defaultFilename: string = 'download') {
    try {
        if (typeof window !== 'undefined' && window.electronAPI?.video?.saveAsset) {
            await window.electronAPI.video.saveAsset(url, defaultFilename);
            return true;
        }

        // Fallback for Web/Browser environment
        const a = document.createElement('a');
        if (url.startsWith('data:')) {
            a.href = url;
            a.download = defaultFilename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            a.href = blobUrl;
            a.download = defaultFilename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
        }
        return true;
    } catch (error: unknown) {
        logger.error('Failed to download asset:', error);
        return false;
    }
}

