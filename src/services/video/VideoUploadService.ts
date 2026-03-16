
import {
    ref,
    uploadBytesResumable,
    uploadBytes,
    getDownloadURL,
    UploadTaskSnapshot,
    StorageError
} from 'firebase/storage';
import { storage } from '../firebase';
import { Logger } from '@/core/logger/Logger';

export interface VideoUploadOptions {
    onProgress?: (progress: number) => void;
    metadata?: {
        [key: string]: string;
    };
}

export interface VideoUploadResult {
    url: string;
    path: string;
    size: number;
    contentType: string;
    thumbnailUrl?: string;
}

const TAG = 'VideoUploadService';

export class VideoUploadService {
    /**
     * Uploads a video file using resumable uploads and optimized metadata.
     * Enforces video/mp4 content type if not detected.
     *
     * Includes:
     * - Long-term cache headers (1 year, immutable) for CDN optimization
     * - Automatic poster frame (thumbnail) generation from the first frame
     * - Custom metadata for tracking generation source and timestamps
     */
    static async uploadVideo(
        file: File | Blob,
        destinationPath: string,
        options: VideoUploadOptions = {}
    ): Promise<VideoUploadResult> {
        const { onProgress, metadata } = options;

        // 0. Pre-upload quota check (non-blocking — fails open for new users)
        try {
            const { StorageQuotaService } = await import('@/services/StorageQuotaService');
            const quotaCheck = await StorageQuotaService.canUpload(file.size);
            if (!quotaCheck.allowed) {
                Logger.warn(TAG, `Upload blocked by quota: ${quotaCheck.reason}`);
                throw new Error(quotaCheck.reason || 'Storage quota exceeded');
            }
        } catch (quotaErr) {
            // Only re-throw if it's our quota error (has a reason message)
            if (quotaErr instanceof Error && quotaErr.message.includes('quota') || quotaErr instanceof Error && quotaErr.message.includes('exceed')) {
                throw quotaErr;
            }
            // Otherwise, quota service is unavailable — allow the upload
            Logger.info(TAG, 'Quota check unavailable, proceeding with upload');
        }

        // 1. Prepare Metadata
        // Videos are immutable once generated — use aggressive long-term caching.
        // Firebase Storage download URLs include a token that changes on regeneration,
        // so max-age=31536000 (1 year) + immutable is safe.
        const uploadMetadata = {
            contentType: file.type || 'video/mp4',
            cacheControl: 'public, max-age=31536000, immutable',
            customMetadata: {
                ...metadata,
                generatedAt: new Date().toISOString(),
                source: 'veo-pipeline',
            }
        };

        const storageRef = ref(storage, destinationPath);
        const uploadTask = uploadBytesResumable(storageRef, file, uploadMetadata);

        return new Promise((resolve, reject) => {
            uploadTask.on(
                'state_changed',
                (snapshot: UploadTaskSnapshot) => {
                    if (onProgress) {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        onProgress(progress);
                    }
                },
                (error: StorageError) => {
                    Logger.error(TAG, 'Upload failed:', error);
                    reject(error);
                },
                async () => {
                    // Upload completed successfully
                    try {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        Logger.info(TAG, 'Upload complete:', downloadURL);

                        // Fire-and-forget thumbnail generation
                        let thumbnailUrl: string | undefined;
                        try {
                            thumbnailUrl = await VideoUploadService.generateAndUploadThumbnail(
                                file,
                                destinationPath,
                                uploadTask.snapshot.ref.parent?.fullPath
                            );
                        } catch (thumbErr) {
                            Logger.warn(TAG, 'Thumbnail generation failed (non-blocking):', thumbErr);
                        }

                        resolve({
                            url: downloadURL,
                            path: destinationPath,
                            size: file.size,
                            contentType: uploadMetadata.contentType,
                            thumbnailUrl,
                        });
                    } catch (e) {
                        Logger.error(TAG, 'Failed to get download URL:', e);
                        reject(e);
                    }
                }
            );
        });
    }

    /**
     * Generate a poster-frame thumbnail from the first frame of a video.
     * Uses a <video> element to seek to 0.5s and draws to a canvas.
     *
     * Returns the download URL of the uploaded thumbnail, or undefined on failure.
     */
    static async generateAndUploadThumbnail(
        videoFile: File | Blob,
        videoPath: string,
        _parentPath?: string
    ): Promise<string | undefined> {
        // Only works in browser with <video> and <canvas> support
        if (typeof document === 'undefined') return undefined;

        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.muted = true;
            video.playsInline = true;

            const blobUrl = URL.createObjectURL(videoFile);
            video.src = blobUrl;

            const cleanup = () => {
                URL.revokeObjectURL(blobUrl);
                video.remove();
            };

            // Timeout after 10s — some videos may not load
            const timeout = setTimeout(() => {
                cleanup();
                resolve(undefined);
            }, 10000);

            video.addEventListener('loadeddata', async () => {
                try {
                    // Seek to 0.5s for a representative frame
                    video.currentTime = 0.5;
                } catch {
                    clearTimeout(timeout);
                    cleanup();
                    resolve(undefined);
                }
            });

            video.addEventListener('seeked', async () => {
                try {
                    clearTimeout(timeout);

                    const canvas = document.createElement('canvas');
                    // Thumbnail at 480p width, maintain aspect ratio
                    const scale = Math.min(480 / video.videoWidth, 1);
                    canvas.width = video.videoWidth * scale;
                    canvas.height = video.videoHeight * scale;

                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        cleanup();
                        resolve(undefined);
                        return;
                    }

                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                    canvas.toBlob(async (blob) => {
                        cleanup();
                        if (!blob) {
                            resolve(undefined);
                            return;
                        }

                        try {
                            // Derive thumbnail path from video path:
                            // videos/{userId}/{jobId}.mp4 → video-thumbnails/{userId}/{jobId}.jpg
                            const thumbPath = videoPath
                                .replace(/^videos\//, 'video-thumbnails/')
                                .replace(/\.mp4$/, '.jpg');

                            const thumbRef = ref(storage, thumbPath);
                            await uploadBytes(thumbRef, blob, {
                                contentType: 'image/jpeg',
                                cacheControl: 'public, max-age=31536000, immutable',
                            });
                            const thumbUrl = await getDownloadURL(thumbRef);
                            Logger.info(TAG, `Thumbnail uploaded: ${thumbUrl}`);
                            resolve(thumbUrl);
                        } catch (uploadErr) {
                            Logger.warn(TAG, 'Thumbnail upload failed:', uploadErr);
                            resolve(undefined);
                        }
                    }, 'image/jpeg', 0.75);
                } catch {
                    clearTimeout(timeout);
                    cleanup();
                    resolve(undefined);
                }
            });

            video.addEventListener('error', () => {
                clearTimeout(timeout);
                cleanup();
                resolve(undefined);
            });

            // Trigger load
            video.load();
        });
    }

    /**
     * Validates video file size and type before upload.
     */
    static validateVideo(file: File): string | null {
        if (!file.type.startsWith('video/')) {
            return 'File is not a valid video.';
        }
        // Limit: 500MB (matches storage.rules)
        const MAX_SIZE = 500 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            return `File too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Max size is 500MB.`;
        }
        return null;
    }
}
