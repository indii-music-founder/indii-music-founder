export interface ImageFileMetadata {
    width?: number;
    height?: number;
    dpiX?: number;
    dpiY?: number;
    format?: string;
}

/** Read stored density, never the browser's default 96 DPI. */
export function inspectImageMetadata(bytes: Uint8Array): ImageFileMetadata {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const result: ImageFileMetadata = {};
    const fits = (offset: number, size: number) => offset >= 0 && offset + size <= bytes.length;
    if (bytes.length >= 24 && [137,80,78,71,13,10,26,10].every((value, index) => bytes[index] === value)) {
        result.format = 'PNG';
        result.width = view.getUint32(16); result.height = view.getUint32(20);
        for (let offset = 8; fits(offset, 12);) {
            const length = view.getUint32(offset);
            if (!fits(offset, length + 12)) break;
            const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
            if (type === 'pHYs' && length === 9 && bytes[offset + 16] === 1) {
                result.dpiX = view.getUint32(offset + 8) * 0.0254;
                result.dpiY = view.getUint32(offset + 12) * 0.0254;
            }
            offset += length + 12;
        }
    } else if (bytes[0] === 255 && bytes[1] === 216) {
        result.format = 'JPEG';
        for (let offset = 2; fits(offset, 4);) {
            if (bytes[offset] !== 255) break;
            const marker = bytes[offset + 1];
            if (marker === 218 || marker === 217) break;
            const length = view.getUint16(offset + 2);
            if (length < 2 || !fits(offset + 2, length)) break;
            const data = offset + 4;
            if (marker === 224 && length >= 16 && String.fromCharCode(...bytes.subarray(data, data + 5)) === 'JFIF\0') {
                const unit = bytes[data + 7];
                const factor = unit === 1 ? 1 : unit === 2 ? 2.54 : 0;
                if (factor) { result.dpiX = view.getUint16(data + 8) * factor; result.dpiY = view.getUint16(data + 10) * factor; }
            }
            if (marker === 225 && length >= 16 && String.fromCharCode(...bytes.subarray(data, data + 6)) === 'Exif\0\0') {
                const tiff = data + 6;
                const little = bytes[tiff] === 73 && bytes[tiff + 1] === 73;
                const validOrder = little || (bytes[tiff] === 77 && bytes[tiff + 1] === 77);
                const end = offset + 2 + length;
                const inside = (position: number, size: number) => position >= tiff && position + size <= end;
                if (validOrder && inside(tiff, 8) && view.getUint16(tiff + 2, little) === 42) {
                    const directory = tiff + view.getUint32(tiff + 4, little);
                    let x: number | undefined, y: number | undefined, unit: number | undefined;
                    if (inside(directory, 2)) for (let index = 0, count = view.getUint16(directory, little); index < count; index++) {
                        const entry = directory + 2 + index * 12;
                        if (!inside(entry, 12)) break;
                        const tag = view.getUint16(entry, little), type = view.getUint16(entry + 2, little);
                        if (view.getUint32(entry + 4, little) !== 1) continue;
                        if (tag === 296 && type === 3) unit = view.getUint16(entry + 8, little);
                        if ((tag === 282 || tag === 283) && type === 5) {
                            const position = tiff + view.getUint32(entry + 8, little);
                            if (inside(position, 8)) {
                                const denominator = view.getUint32(position + 4, little);
                                const value = denominator ? view.getUint32(position, little) / denominator : undefined;
                                if (tag === 282) x = value; else y = value;
                            }
                        }
                    }
                    const factor = unit === 2 ? 1 : unit === 3 ? 2.54 : 0;
                    if (factor && x && y) { result.dpiX = x * factor; result.dpiY = y * factor; }
                }
            }
            if (marker !== undefined && [192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker) && length >= 8) {
                result.height = view.getUint16(data + 1); result.width = view.getUint16(data + 3);
            }
            offset += length + 2;
        }
    }
    if (!result.dpiX || !result.dpiY) { delete result.dpiX; delete result.dpiY; }
    return result;
}

export function physicalImageSize(metadata: ImageFileMetadata): string | undefined {
    if (!metadata.width || !metadata.height || !metadata.dpiX || !metadata.dpiY) return undefined;
    const width = metadata.width / metadata.dpiX, height = metadata.height / metadata.dpiY;
    return `${+width.toFixed(2)} × ${+height.toFixed(2)} in (${+(width * 2.54).toFixed(2)} × ${+(height * 2.54).toFixed(2)} cm)`;
}
