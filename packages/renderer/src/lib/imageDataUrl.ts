/** Decode a canvas PNG locally; fetching data: URLs is blocked by the production CSP. */
export function imageDataUrlToBlob(dataUrl: string): Blob {
    const match = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl);
    if (!match) throw new Error('Canvas export did not contain a valid image.');
    const binary = atob(match[2]!);
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    return new Blob([bytes], { type: match[1]! });
}
