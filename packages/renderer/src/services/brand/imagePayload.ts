/**
 * imagePayload — converts an asset URL (data: URI or remote URL) into the
 * inline base64 payload shape consumed by AutonomousIntelligence vision calls.
 * Shared by the brand compliance vision probe and aesthetic engine (Workstream D).
 */

export interface InlineImagePayload {
    mimeType: string;
    data: string;
}

export async function toInlineBase64(assetUrl: string): Promise<InlineImagePayload> {
    if (assetUrl.startsWith('data:')) {
        const mimeMatch = assetUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,/i);
        const commaIndex = assetUrl.indexOf(',');
        return {
            mimeType: mimeMatch?.[1] ?? 'image/png',
            data: commaIndex >= 0 ? assetUrl.slice(commaIndex + 1) : assetUrl,
        };
    }

    const response = await fetch(assetUrl);
    if (!response.ok) {
        throw new Error(`Could not fetch asset for vision analysis (HTTP ${response.status}).`);
    }
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]!);
    }
    return { mimeType: response.headers.get('content-type') || 'image/png', data: btoa(binary) };
}
