type AttachmentPayload = { base64?: string; mimeType?: string };

const attachmentDataUriCache = new WeakMap<object, string>();

/** Reuses the browser data URI while an immutable attachment object is stable. */
export function buildAttachmentDataUri(attachment: AttachmentPayload): string {
    const cached = attachmentDataUriCache.get(attachment);
    if (cached !== undefined) return cached;

    const { base64, mimeType = '' } = attachment;
    if (!base64) return '';

    const dataUri = base64.startsWith('data:')
        ? base64
        : `data:${mimeType || 'application/octet-stream'};base64,${base64}`;
    attachmentDataUriCache.set(attachment, dataUri);
    return dataUri;
}
