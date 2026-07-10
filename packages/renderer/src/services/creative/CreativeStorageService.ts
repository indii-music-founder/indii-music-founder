import { storage } from '@/services/firebase';
import { ref, uploadBytes, uploadString, UploadResult } from 'firebase/storage';

export type CreativeVaultScope = 'assets' | 'objects' | 'characters' | 'style' | 'masks' | 'outputs';

// MIME type to file extension mapping
const MIME_TO_EXTENSION: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'video/x-msvideo': 'avi',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'audio/flac': 'flac',
};

export class CreativeStorageService {
    /**
     * Detect MIME type from file or data URL
     */
    private static detectMimeType(media: File | Blob | string): string {
        if (media instanceof File) {
            return media.type || 'application/octet-stream';
        }
        if (media instanceof Blob) {
            return media.type || 'application/octet-stream';
        }
        if (typeof media === 'string' && media.startsWith('data:')) {
            const match = media.match(/^data:([^;]+)/);
            return match?.[1] || 'application/octet-stream';
        }
        return 'application/octet-stream';
    }

    /**
     * Get extension from MIME type, defaulting by mediaType category if unknown
     */
    private static getExtensionForMime(mimeType: string, mediaTypeCategory: 'image' | 'video' | 'audio'): string {
        const ext = MIME_TO_EXTENSION[mimeType];
        if (ext) return ext;

        // Fallback by category
        if (mimeType.startsWith('image/')) return 'jpg';
        if (mimeType.startsWith('video/')) return 'mp4';
        if (mimeType.startsWith('audio/')) return 'wav';

        // Last resort: use category default
        return mediaTypeCategory === 'video' ? 'mp4' : mediaTypeCategory === 'audio' ? 'wav' : 'jpg';
    }
    /**
     * Helper to downscale and compress reference images using a canvas.
     * Max dimension: 2048px. Quality: 0.8 JPEG.
     */
    static async compressImage(media: File | Blob | string): Promise<Blob | string> {
        if (
            typeof window === 'undefined' || 
            typeof document === 'undefined' || 
            (typeof process !== 'undefined' && (process.env.VITEST || process.env.NODE_ENV === 'test'))
        ) {
            return media; // Node/Non-browser environment fallback or test environment bypass
        }

        try {
            // Convert media to a loadable image source URL
            let src = '';
            let isUrlCreated = false;

            if (typeof media === 'string') {
                if (media.startsWith('data:') || /^https?:\/\//i.test(media)) {
                    src = media;
                } else {
                    // Assume raw base64 string
                    src = `data:image/jpeg;base64,${media}`;
                }
            } else {
                src = URL.createObjectURL(media);
                isUrlCreated = true;
            }

            // Load the image
            const img = new Image();
            img.crossOrigin = 'anonymous';
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = src;
            });

            if (isUrlCreated) {
                URL.revokeObjectURL(src);
            }

            const maxDim = 2048;
            let width = img.naturalWidth || img.width;
            let height = img.naturalHeight || img.height;

            if (!width || !height) {
                return media; // Cannot read dimensions, return original
            }

            // Check if resizing is needed (dimensions exceed 2048px)
            const needResize = width > maxDim || height > maxDim;
            
            // Create canvas
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return media;
            }

            if (needResize) {
                if (width > height) {
                    height = Math.round((height * maxDim) / width);
                    width = maxDim;
                } else {
                    width = Math.round((width * maxDim) / height);
                    height = maxDim;
                }
            }

            canvas.width = width;
            canvas.height = height;

            // Draw image on canvas
            ctx.drawImage(img, 0, 0, width, height);

            // Compress to JPEG with 0.8 quality
            if (typeof media === 'string') {
                return canvas.toDataURL('image/jpeg', 0.8);
            } else {
                return new Promise<Blob>((resolve, reject) => {
                    canvas.toBlob((blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('Canvas toBlob failed'));
                        }
                    }, 'image/jpeg', 0.8);
                });
            }
        } catch (err: unknown) {
            console.warn('[CreativeStorageService] Image auto-compression failed, falling back to original media:', err);
            return media;
        }
    }

    /**
     * Uploads a raw File object or Data URL to Firebase Storage under the 'creative/' path
     * and returns the strict 'gs://' URI required by the Thin Client protocol API Gateway.
     */
    static async uploadReferenceMedia(
        userId: string,
        media: File | Blob | string,
        mediaType: 'image' | 'video' | 'audio',
        options?: {
            scope?: CreativeVaultScope;
            sessionId?: string;
            projectId?: string;
        }
    ): Promise<string> {
        if (!storage) {
            throw new Error('Firebase Storage is not initialized.');
        }

        if (typeof media === 'string' && media.startsWith('gs://')) {
            return media;
        }

        const bucket = storage.app.options.storageBucket;
        if (!bucket) {
            throw new Error('Storage bucket not found in Firebase config.');
        }

        // Apply auto-compression for reference images before upload
        let mediaToUpload = media;
        let detectedMimeType = this.detectMimeType(media);

        if (mediaType === 'image') {
            mediaToUpload = await this.compressImage(media);
            // After compression, assume JPEG unless original was PNG (preserve transparency)
            if (detectedMimeType === 'image/png') {
                detectedMimeType = 'image/png';
            } else {
                detectedMimeType = 'image/jpeg';
            }
        }

        // Get extension based on actual MIME type
        const extension = this.getExtensionForMime(detectedMimeType, mediaType);

        const scope = options?.scope || 'assets';
        const basePath = options?.projectId
            ? mediaType === 'video'
                ? `creative/${userId}/projects/${options.projectId}/video/${scope}`
                : `creative/${userId}/projects/${options.projectId}/${scope}`
            : options?.sessionId
                ? `creative/${userId}/video/tmp/${options.sessionId}/${scope}`
                : scope === 'assets'
                    ? `creative/${userId}`
                    : `users/${userId}/vault/${scope}`;
        const filename = `${basePath}/${Date.now()}_${crypto.randomUUID()}.${extension}`;
        const storageRef = ref(storage, filename);

        if (typeof mediaToUpload === 'string') {
            // Data URL string
            if (mediaToUpload.startsWith('data:')) {
                await uploadString(storageRef, mediaToUpload, 'data_url', {
                    contentType: detectedMimeType,
                });
            } else if (/^https?:\/\//i.test(mediaToUpload)) {
                const response = await fetch(mediaToUpload);
                if (!response.ok) {
                    throw new Error(`Failed to fetch reference media: ${response.status} ${response.statusText}`);
                }
                const blob = await response.blob();
                await uploadBytes(storageRef, blob, {
                    contentType: blob.type || detectedMimeType,
                });
            } else {
                // Raw Base64
                await uploadString(storageRef, mediaToUpload, 'base64', {
                    contentType: detectedMimeType,
                });
            }
        } else {
            // File or Blob
            const mimeType = (mediaToUpload as Blob).type || detectedMimeType;
            await uploadBytes(storageRef, mediaToUpload, {
                contentType: mimeType,
            });
        }

        return `gs://${bucket}/${filename}`;
    }
}
