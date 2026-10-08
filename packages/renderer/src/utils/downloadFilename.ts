/** Match image filenames to their actual encoding; never relabel image bytes. */
export function imageDownloadFilename(filename: string, mimeType: string, header?: Uint8Array): string {
    let extension: string | undefined;
    if (header && header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
        extension = 'jpg';
    } else if (header && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => header[index] === byte)) {
        extension = 'png';
    } else if (header && header.length >= 12 &&
        [82, 73, 70, 70].every((byte, index) => header[index] === byte) &&
        [87, 69, 66, 80].every((byte, index) => header[index + 8] === byte)) {
        extension = 'webp';
    } else if (header && header.length >= 6 &&
        [71, 73, 70, 56].every((byte, index) => header[index] === byte) &&
        (header[4] === 55 || header[4] === 57) && header[5] === 97) {
        extension = 'gif';
    }
    extension ??= ({
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
        'image/avif': 'avif',
        'image/svg+xml': 'svg',
    } as Record<string, string>)[mimeType.split(';')[0]!.trim().toLowerCase()];
    if (!extension) return filename;
    // Keep a correct .jpeg suffix, and preserve the rest of the user's name.
    if (extension === 'jpg' && /\.jpe?g$/i.test(filename)) return filename;
    if (filename.toLowerCase().endsWith(`.${extension}`)) return filename;
    return `${filename.replace(/\.[^.]+$/, '')}.${extension}`;
}
