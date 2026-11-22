/**
 * Canvas render Inngest consumer (P6, ISSUE-1100).
 *
 * Consumes `mcp/render.requested` events dispatched by the
 * queue_release_canvas_render MCP tool. Composes a looping canvas MP4 from the
 * release's own cover art synced to a clip of the artist's own uploaded
 * audio via fluent-ffmpeg. NO music generation — audio is strictly the
 * artist's own upload ([[no-music-generation-ever]]).
 */
import { Inngest } from 'inngest';
import * as admin from 'firebase-admin';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStaticPath from 'ffmpeg-static';

import { parseStorageUri } from './storageUri.js';
import { resolveOwnedRelease, type OwnershipFirestore } from '../mcp/helpers.js';

if (ffmpegStaticPath) {
    ffmpeg.setFfmpegPath(ffmpegStaticPath);
}

const CANVAS_ASPECTS: Record<string, { width: number; height: number }> = {
    Spotify: { width: 1080, height: 1080 }, // 1:1
    TikTok: { width: 1080, height: 1920 }, // 9:16
    Instagram: { width: 1080, height: 1920 }, // 9:16
};

const MIN_DURATION_SECONDS = 3;
const MAX_DURATION_SECONDS = 8;
const DEFAULT_DURATION_SECONDS = 6;

interface CanvasRenderPayload {
    jobId: string;
    uid: string;
    releaseId: string;
    canvasType: string;
    animationSpec?: { durationSeconds?: number };
}

/** Resolves a release doc's cover art object path from known field conventions. Never throws — returns undefined if absent. */
export function resolveCoverArtStoragePath(data: Record<string, unknown>): string | undefined {
    const assets = (data.assets && typeof data.assets === 'object' ? data.assets : {}) as Record<string, unknown>;
    const coverArt = (assets.coverArt && typeof assets.coverArt === 'object' ? assets.coverArt : {}) as Record<string, unknown>;
    const candidates = [
        data.coverArtStoragePath,
        coverArt.storagePath,
        coverArt.path,
        assets.coverArtStoragePath,
    ];
    for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    }
    return undefined;
}

/** Resolves a release/track doc's artist-uploaded audio into a Storage object path. Never throws — returns undefined if absent or unparseable. */
export function resolveAudioStoragePath(data: Record<string, unknown>): string | undefined {
    const audioUrl = data.audioUrl;
    if (typeof audioUrl === 'string' && audioUrl.trim()) {
        try {
            return parseStorageUri(audioUrl).path;
        } catch {
            // Not a Storage URI; fall through to the canonical master path.
        }
    }
    // Distribution/Publishing release records (ISSUE-1692) keep the artist's
    // canonical master path under `assets.audioStoragePath`.
    const assets = (data.assets && typeof data.assets === 'object' ? data.assets : {}) as Record<string, unknown>;
    const storagePath = assets.audioStoragePath;
    if (typeof storagePath === 'string' && storagePath.trim()) return storagePath.trim();
    return undefined;
}

/**
 * The render job downloads with admin credentials, so a client-written release
 * record must not be able to point it at another user's files. Only objects
 * under the caller's own prefixes are accepted.
 */
export function isOwnerScopedStoragePath(objectPath: string, uid: string): boolean {
    if (!uid || objectPath.includes('..') || objectPath.startsWith('/')) return false;
    return ['users', 'masters', 'covers', 'artwork', 'cover-art', 'releases']
        .some(prefix => objectPath.startsWith(`${prefix}/${uid}/`));
}

export function resolveCanvasDurationSeconds(animationSpec: CanvasRenderPayload['animationSpec']): number {
    const requested = animationSpec?.durationSeconds;
    if (typeof requested !== 'number' || !Number.isFinite(requested)) return DEFAULT_DURATION_SECONDS;
    return Math.min(Math.max(requested, MIN_DURATION_SECONDS), MAX_DURATION_SECONDS);
}

async function composeCanvasVideo(
    coverLocalPath: string,
    audioLocalPath: string,
    outputLocalPath: string,
    durationSeconds: number,
    width: number,
    height: number,
): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        ffmpeg()
            .input(coverLocalPath)
            .inputOptions(['-loop 1'])
            .input(audioLocalPath)
            .outputOptions([
                '-c:v libx264',
                '-tune stillimage',
                '-c:a aac',
                '-b:a 192k',
                '-pix_fmt yuv420p',
                `-vf scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`,
                '-shortest',
            ])
            .duration(durationSeconds)
            .save(outputLocalPath)
            .on('end', () => resolve())
            .on('error', (err: Error) => reject(err));
    });
}

export const canvasRenderFn = (inngestClient: Inngest) => inngestClient.createFunction(
    {
        id: 'canvas-render-compose',
        retries: 1,
        onFailure: async ({ event, error, step }) => {
            const originalData = (event.data?.event?.data || {}) as Partial<CanvasRenderPayload>;
            const jobId = originalData.jobId;
            if (!jobId) return;
            const db = admin.firestore();
            const jobRef = db.collection('mcpRenderJobs').doc(jobId);
            const message = error instanceof Error ? error.message : String(error);
            await step.run('mark-failed', async () => {
                await jobRef.update({
                    status: 'failed',
                    error: message,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            });
        },
    },
    { event: 'mcp/render.requested' },
    async ({ event, step }) => {
        const { jobId, uid, releaseId, canvasType, animationSpec } = event.data as CanvasRenderPayload;
        const db = admin.firestore();
        const jobRef = db.collection('mcpRenderJobs').doc(jobId);

        await step.run('mark-rendering', async () => {
            await jobRef.update({ status: 'rendering', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        });

        const assetPaths = await step.run('resolve-assets', async () => {
            // Same owned-release lookup the queue tool verified (ISSUE-1692).
            const { data } = await resolveOwnedRelease(db as unknown as OwnershipFirestore, uid, releaseId);
            const coverArtStoragePath = resolveCoverArtStoragePath(data);
            const audioStoragePath = resolveAudioStoragePath(data);
            if (!coverArtStoragePath) {
                throw new Error('Release has no cover art storage path — cannot compose canvas.');
            }
            if (!audioStoragePath) {
                throw new Error("Release has no artist-uploaded audio (audioUrl or assets.audioStoragePath) — cannot compose canvas without the artist's own audio.");
            }
            if (!isOwnerScopedStoragePath(coverArtStoragePath, uid) || !isOwnerScopedStoragePath(audioStoragePath, uid)) {
                throw new Error('Release cover art or audio is not stored under the requesting artist — refusing to read it.');
            }
            return { coverArtStoragePath, audioStoragePath };
        });

        const outputStoragePath = await step.run('compose-and-upload', async () => {
            const bucket = admin.storage().bucket();
            const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'canvas-'));
            const coverLocal = path.join(tmpDir, 'cover.img');
            const audioLocal = path.join(tmpDir, 'audio.src');
            const outputLocal = path.join(tmpDir, `${randomUUID()}.mp4`);

            try {
                await bucket.file(assetPaths.coverArtStoragePath).download({ destination: coverLocal });
                await bucket.file(assetPaths.audioStoragePath).download({ destination: audioLocal });

                const { width, height } = CANVAS_ASPECTS[canvasType] || CANVAS_ASPECTS.Spotify;
                const durationSeconds = resolveCanvasDurationSeconds(animationSpec);

                await composeCanvasVideo(coverLocal, audioLocal, outputLocal, durationSeconds, width, height);

                const destPath = `users/${uid}/canvas/${jobId}.mp4`;
                await bucket.upload(outputLocal, {
                    destination: destPath,
                    metadata: { contentType: 'video/mp4' },
                });
                return destPath;
            } finally {
                await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
            }
        });

        await step.run('mark-complete', async () => {
            await jobRef.update({
                status: 'complete',
                outputStoragePath,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        });

        return { jobId, status: 'complete', outputStoragePath };
    },
);
