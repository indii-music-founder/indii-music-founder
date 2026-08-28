/**
 * Client-side mirror of the server's `generateContentStream` payload guard
 * (packages/firebase/src/index.ts — `JSON.stringify(contents).length > 200_000`
 * → HTTP 413 "Content payload is too large.").
 *
 * Why this exists (ERROR_LEDGER 2026-08-27, agent chat 413 → bogus verdict):
 * chat attachments and BaseAgent's auto-injected generated-artifact image cross
 * the boundary as RAW base64 inlineData with no client-side compression. A
 * single generated PNG (0.5–3MB → 0.7–4M base64 chars) blew the 200K-char
 * server guard, the client mapped the 413 to a generic INTERNAL_ERROR, and the
 * conductor's Evolas persona layer formatted that opaque failure text into a
 * misleading "Operational Verdict Report". Two fixes live here:
 *
 *   1. Raster image attachments are compressed (existing certified
 *      CloudStorageService.compressImage) until they fit a target budget.
 *   2. A char-length assertion mirroring the server guard fails LOUDLY with
 *      PAYLOAD_TOO_LARGE before the fetch, and the service maps a real 413 to
 *      the same code — never a generic INTERNAL_ERROR again.
 *
 * Compression is fail-open: if canvas compression throws (blocked canvas,
 * undecodable image), the ORIGINAL attachment is preserved and the budget
 * assertion — not silent data loss — decides the outcome.
 */

import { AppErrorCode, AppException } from '@/shared/types/errors';
import type { Content } from '@/shared/types/ai.dto';
import { CloudStorageService } from '@/services/CloudStorageService';
import { logger } from '@/utils/logger';

/** Must match the server guard in packages/firebase/src/index.ts exactly. */
export const AGENT_STREAM_CHAR_BUDGET = 200_000;

/**
 * Attachments at or under this many base64 chars pass through untouched.
 * ~120K base64 chars ≈ 90KB binary — comfortably inside the server budget
 * even with prompt, history, and config overhead added.
 */
const IMAGE_ATTACHMENT_TARGET_BASE64_CHARS = 120_000;

/**
 * Escalating downscale/re-encode ladder. JPEG re-encode intentionally drops
 * alpha: these images are AI context, not display assets.
 */
const COMPRESSION_LADDER = [
    { maxEdge: 1024, quality: 0.8 },
    { maxEdge: 768, quality: 0.7 },
    { maxEdge: 512, quality: 0.6 },
] as const;

export interface StreamImageAttachment {
    mimeType: string;
    base64: string;
}

/**
 * Mirror of the exact server measurement: `JSON.stringify(contents).length`.
 */
export function estimateContentsCharLength(contents: Content[]): number {
    try {
        return JSON.stringify(contents).length;
    } catch {
        // Unserializable contents can never cross JSON POST anyway.
        return Number.MAX_SAFE_INTEGER;
    }
}

/**
 * Fail loudly BEFORE the network call when the serialized contents would be
 * rejected by the server's 200K-char guard. Callers get a specific,
 * actionable PAYLOAD_TOO_LARGE instead of an opaque backend INTERNAL_ERROR.
 */
export function assertContentsWithinStreamBudget(contents: Content[], label: string): void {
    const lengthChars = estimateContentsCharLength(contents);
    if (lengthChars <= AGENT_STREAM_CHAR_BUDGET) return;

    throw new AppException(
        AppErrorCode.PAYLOAD_TOO_LARGE,
        `AI request payload is too large to send (${Math.round(lengthChars / 1000)}KB serialized against a ~200KB limit). ` +
        'Reduce image attachments or start a fresh conversation.',
        {
            retryable: false,
            context: { label, lengthChars, budgetChars: AGENT_STREAM_CHAR_BUDGET },
        }
    );
}

function parseDataUri(dataUri: string): StreamImageAttachment | null {
    const match = /^data:([^;,]+);base64,([\s\S]+)$/.exec(dataUri);
    if (!match || !match[1] || !match[2]) return null;
    return { mimeType: match[1], base64: match[2] };
}

function toDataUri(att: StreamImageAttachment): string {
    return `data:${att.mimeType};base64,${att.base64}`;
}

async function compressImageAttachment(att: StreamImageAttachment): Promise<StreamImageAttachment> {
    if (att.base64.length <= IMAGE_ATTACHMENT_TARGET_BASE64_CHARS) return att;

    let current = toDataUri(att);
    for (const step of COMPRESSION_LADDER) {
        try {
            const { dataUri } = await CloudStorageService.compressImage(current, {
                maxWidth: step.maxEdge,
                maxHeight: step.maxEdge,
                quality: step.quality,
                format: 'jpeg',
            });
            current = dataUri;
            const parts = parseDataUri(dataUri);
            if (parts && parts.base64.length <= IMAGE_ATTACHMENT_TARGET_BASE64_CHARS) {
                logger.info('[StreamPayloadGuard]', `Image attachment compressed ${att.base64.length} → ${parts.base64.length} base64 chars.`);
                return parts;
            }
        } catch (error) {
            // Fail-open: keep the best encoding so far and let the budget
            // assertion produce the actionable error. Never lose an attachment.
            logger.warn('[StreamPayloadGuard]', `Image compression failed at ${step.maxEdge}px; keeping best effort.`, error);
            break;
        }
    }

    return parseDataUri(current) ?? att;
}

/**
 * Compress oversized raster image attachments for the AI stream boundary.
 * Non-image attachments (audio, video, pdf) pass through untouched — they are
 * not canvas-decodable, and the budget assertion handles them honestly.
 */
export async function compressStreamImageAttachments<
    T extends StreamImageAttachment
>(attachments: readonly T[]): Promise<T[]> {
    if (!attachments || attachments.length === 0) return [];

    return Promise.all(attachments.map(async (att): Promise<T> => {
        if (!att || typeof att.base64 !== 'string' || !att.mimeType?.startsWith('image/')) return att;
        if (att.base64.length <= IMAGE_ATTACHMENT_TARGET_BASE64_CHARS) return att;
        const compressed = await compressImageAttachment(att);
        // Preserve any extra fields the caller's attachment shape carries.
        return { ...att, mimeType: compressed.mimeType, base64: compressed.base64 };
    }));
}
