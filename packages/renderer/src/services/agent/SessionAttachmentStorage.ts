import { deleteObject, getBytes, ref, uploadString } from 'firebase/storage';
import { storage } from '@/services/firebase';

export interface StoredSessionAttachment {
    mimeType: string;
    storagePath: string;
    filename?: string;
}

function segment(value: string): string {
    if (!value || value.length > 200) throw new Error('Invalid attachment owner or identifier.');
    return encodeURIComponent(value).replace(/\./g, '%2E');
}

async function attachmentDigest(mimeType: string, data: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${mimeType.toLowerCase()}\0${data}`));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

/** Content identity prevents different bytes from sharing a retry path. */
export function sessionAttachmentPath(userId: string, sessionId: string, messageId: string, index: number, digest: string): string {
    if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error('Invalid attachment digest.');
    if (!Number.isSafeInteger(index) || index < 0) throw new Error('Invalid attachment index.');
    return `users/${segment(userId)}/assets/chat-attachments/${segment(sessionId)}/${segment(messageId)}/${index}-${digest}`;
}

export async function uploadSessionAttachment(
    userId: string, sessionId: string, messageId: string, index: number,
    attachment: { mimeType: string; base64: string; filename?: string },
): Promise<StoredSessionAttachment> {
    const dataUri = /^data:([^;,]+);base64,([\s\S]*)$/i.exec(attachment.base64);
    if (attachment.base64.startsWith('data:') && (!dataUri || dataUri[1]?.toLowerCase() !== attachment.mimeType.toLowerCase())) {
        throw new Error('Attachment data does not match its declared content type.');
    }
    const input = dataUri ? dataUri[2]! : attachment.base64;
    if (!input) throw new Error('Attachment is empty.');
    const data = btoa(atob(input));
    if (!data) throw new Error('Attachment is empty.');
    const digest = await attachmentDigest(attachment.mimeType, data);
    const storagePath = sessionAttachmentPath(userId, sessionId, messageId, index, digest);
    await uploadString(ref(storage, storagePath), data, 'base64', { contentType: attachment.mimeType });
    return { mimeType: attachment.mimeType, storagePath, ...(attachment.filename ? { filename: attachment.filename } : {}) };
}

/** Only resolve or delete objects belonging to this exact message and user. */
function checkedRef(userId: string, sessionId: string, messageId: string, index: number, path: string) {
    const digest = path.match(/-([a-f0-9]{64})$/)?.[1];
    if (!digest || path !== sessionAttachmentPath(userId, sessionId, messageId, index, digest)) {
        throw new Error('Attachment reference does not match its owner and message.');
    }
    return ref(storage, path);
}

export async function loadSessionAttachment(
    userId: string, sessionId: string, messageId: string, index: number, attachment: StoredSessionAttachment,
): Promise<{ mimeType: string; base64: string; filename?: string }> {
    const bytes = new Uint8Array(await getBytes(checkedRef(userId, sessionId, messageId, index, attachment.storagePath)));
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 8192) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    }
    const base64 = btoa(binary);
    const digest = await attachmentDigest(attachment.mimeType, base64);
    if (attachment.storagePath !== sessionAttachmentPath(userId, sessionId, messageId, index, digest)) {
        throw new Error('Stored attachment content does not match its reference.');
    }
    return { mimeType: attachment.mimeType, base64, ...(attachment.filename ? { filename: attachment.filename } : {}) };
}

export async function deleteSessionAttachment(
    userId: string, sessionId: string, messageId: string, index: number, attachment: StoredSessionAttachment,
): Promise<void> {
    await deleteObject(checkedRef(userId, sessionId, messageId, index, attachment.storagePath));
}

/** Encode new message attachments without mutating the local optimistic message. */
export async function storeSessionAttachments(
    userId: string, sessionId: string, messageId: string,
    attachments: ReadonlyArray<{ mimeType: string; base64: string; filename?: string }>,
): Promise<StoredSessionAttachment[]> {
    const result: StoredSessionAttachment[] = [];
    // Sequential writes bound memory and make a retry deterministic. Do not
    // delete already uploaded paths here: a previous Firestore attempt may
    // have committed despite a lost acknowledgement.
    for (const [index, attachment] of attachments.entries()) {
        result.push(await uploadSessionAttachment(userId, sessionId, messageId, index, attachment));
    }
    return result;
}

/** Accept legacy inline attachments as well as new owner-bound references. */
export async function restoreSessionAttachments(
    userId: string, sessionId: string, messageId: string,
    attachments: ReadonlyArray<StoredSessionAttachment | { mimeType: string; base64: string }>,
): Promise<Array<{ mimeType: string; base64: string }>> {
    return Promise.all(attachments.map((attachment, index) =>
        'storagePath' in attachment
            ? loadSessionAttachment(userId, sessionId, messageId, index, attachment)
            : Promise.resolve(attachment),
    ));
}
