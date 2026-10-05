/** Pack model-output RGB values into canvas bytes without GPU fence polling. */
export function enhancedTilePixels(values: ArrayLike<number>, width: number, height: number): Uint8ClampedArray<ArrayBuffer> {
    // The largest supported tile is (128 + 2 * 12) pixels enlarged 4x.
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
        width > 608 || height > 608 || values.length !== width * height * 3) {
        throw new Error('The enhancement returned invalid tile dimensions or RGB data.');
    }
    const bytes = new Uint8ClampedArray(width * height * 4);
    for (let pixel = 0; pixel < width * height; pixel++) {
        for (let channel = 0; channel < 3; channel++) {
            const value = values[pixel * 3 + channel]!;
            if (!Number.isFinite(value) || value < 0 || value > 255) {
                throw new Error('The enhancement returned invalid color values.');
            }
            bytes[pixel * 4 + channel] = Math.round(value);
        }
        bytes[pixel * 4 + 3] = 255;
    }
    return bytes;
}
