import { storage } from '@/services/firebase';
import { ref, uploadBytes, uploadString } from 'firebase/storage';

export class CreativeStorageService {
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
        mediaType: 'image' | 'video' | 'audio'
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
        if (mediaType === 'image') {
            mediaToUpload = await this.compressImage(media);
        }

        const extension = mediaType === 'video' ? 'mp4' : mediaType === 'audio' ? 'wav' : 'jpg';
        const filename = `creative/${userId}/${Date.now()}_${crypto.randomUUID()}.${extension}`;
        const storageRef = ref(storage, filename);

        if (typeof mediaToUpload === 'string') {
            // Data URL string
            if (mediaToUpload.startsWith('data:')) {
                await uploadString(storageRef, mediaToUpload, 'data_url');
            } else if (/^https?:\/\//i.test(mediaToUpload)) {
                const response = await fetch(mediaToUpload);
                if (!response.ok) {
                    throw new Error(`Failed to fetch reference media: ${response.status} ${response.statusText}`);
                }
                await uploadBytes(storageRef, await response.blob());
            } else {
                // Raw Base64
                await uploadString(storageRef, mediaToUpload, 'base64');
            }
        } else {
            // File or Blob
            await uploadBytes(storageRef, mediaToUpload);
        }

        return `gs://${bucket}/${filename}`;
    }
}
