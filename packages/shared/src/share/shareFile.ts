/**
 * Hands a rendered image to the OS share sheet when the platform can share
 * files (iOS/Android, some desktops), otherwise downloads it.
 */
export type ShareFileOutcome = 'shared' | 'downloaded' | 'cancelled';

export function canShareFiles(file: File): boolean {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
    if (typeof navigator.canShare !== 'function') return false;
    try {
        return navigator.canShare({ files: [file] });
    } catch {
        return false;
    }
}

export function downloadBlob(blob: Blob, fileName: string): void {
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Give the browser a tick to start the download before revoking.
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export async function shareOrDownloadImage(
    blob: Blob,
    fileName: string,
    meta: { title: string; text?: string },
): Promise<ShareFileOutcome> {
    const file = new File([blob], fileName, { type: blob.type || 'image/png' });
    if (canShareFiles(file)) {
        try {
            await navigator.share({ files: [file], title: meta.title, text: meta.text });
            return 'shared';
        } catch (error) {
            if ((error as DOMException)?.name === 'AbortError') return 'cancelled';
            // NotAllowedError etc. — fall through to a download so the artist still gets the file.
        }
    }
    downloadBlob(blob, fileName);
    return 'downloaded';
}
