import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { randomUUID } from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import ffprobePath from 'ffprobe-static';
import { logger } from 'firebase-functions/v2';
import { validateAppCheckV2 } from '../../middleware/appCheck';
import { parseStorageUri, assertUserOwnsStoragePath } from '../../lib/storageUri';

if (ffprobePath.path) {
  ffmpeg.setFfprobePath(ffprobePath.path);
}

// Video Editor projects cap at this many bytes for a single asset probe; anything
// larger should already have been rejected earlier in the upload pipeline.
const MAX_PROBE_BYTES = 500 * 1024 * 1024;

const GetMediaDurationSchema = z.object({
  uri: z.string().min(1),
});

function probeDurationSeconds(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      const duration = Number(metadata?.format?.duration);
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error('FFprobe returned no usable duration.'));
        return;
      }
      resolve(duration);
    });
  });
}

/**
 * Resolve the real duration (in seconds) of a video/audio file already stored
 * in this project's Firebase Storage bucket. Used by the Video Editor timeline
 * so imported/dropped media gets its actual length instead of an arbitrary
 * frame-count default.
 */
export const getMediaDuration = onCall(
  { timeoutSeconds: 60, memory: '1GiB', enforceAppCheck: false },
  async (request): Promise<{ durationSeconds: number }> => {
    validateAppCheckV2(request);
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication is required to probe media duration.');
    }

    const parsed = GetMediaDurationSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', 'A valid Storage asset URI is required.');
    }

    const { bucket, path: objectPath } = parseStorageUri(parsed.data.uri);
    const defaultBucket = admin.storage().bucket().name;
    if (bucket !== defaultBucket) {
      throw new HttpsError('permission-denied', 'Storage asset bucket is not part of this project.');
    }
    assertUserOwnsStoragePath(objectPath, request.auth.uid);

    const file = admin.storage().bucket(bucket).file(objectPath);
    const [metadata] = await file.getMetadata().catch((error: unknown) => {
      throw new HttpsError('not-found', 'Storage asset metadata could not be loaded.', error);
    });

    const contentType = metadata.contentType || '';
    if (!contentType.startsWith('video/') && !contentType.startsWith('audio/')) {
      throw new HttpsError('failed-precondition', 'Only video/audio assets support duration probing.');
    }

    const size = Number(metadata.size || 0);
    if (!Number.isFinite(size) || size <= 0) {
      throw new HttpsError('failed-precondition', 'Storage asset is empty or has invalid metadata.');
    }
    if (size > MAX_PROBE_BYTES) {
      throw new HttpsError('resource-exhausted', 'Storage asset is too large to probe.');
    }

    const extension = path.extname(objectPath) || '.tmp';
    const tempPath = path.join(os.tmpdir(), `probe_${randomUUID()}${extension}`);

    try {
      await file.download({ destination: tempPath });
      const durationSeconds = await probeDurationSeconds(tempPath);
      return { durationSeconds };
    } catch (error: unknown) {
      logger.error('[getMediaDuration] Probe failed', { objectPath, error: error instanceof Error ? error.message : String(error) });
      throw new HttpsError('internal', 'Failed to determine media duration.', error);
    } finally {
      await fs.unlink(tempPath).catch(() => undefined);
    }
  },
);
