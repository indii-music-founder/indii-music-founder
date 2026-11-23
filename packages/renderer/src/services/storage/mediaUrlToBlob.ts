/**
 * ISSUE-1708: uploads read the artist's file as a data: URL, then fetch()ed it
 * to get bytes back. The production CSP's connect-src has no data: scheme, so
 * every audio/video upload failed with "Failed to fetch" and the Upload Queue
 * said "Failed to save to cloud library". Data URLs are decoded locally;
 * every other URL is fetched as before.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
    const comma = dataUrl.indexOf(',');
    if (comma < 0) throw new Error('Not a valid data URL.');
    const header = dataUrl.slice(5, comma);
    const payload = dataUrl.slice(comma + 1);
    const isBase64 = /;base64$/i.test(header);
    const mimeType = header.replace(/;base64$/i, '').split(';')[0] || 'application/octet-stream';
    const binary = isBase64 ? atob(payload) : decodeURIComponent(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mimeType });
}

export async function mediaUrlToBlob(url: string): Promise<Blob> {
    if (url.startsWith('data:')) return dataUrlToBlob(url);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not read media (${response.status}).`);
    return response.blob();
}
