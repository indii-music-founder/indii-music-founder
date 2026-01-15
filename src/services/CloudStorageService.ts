/**
 * CloudStorageService - Handles image compression and cloud upload
 *
 * Solves the "placeholder:dev-data-uri-too-large" issue by:
 * 1. Compressing images before upload
 * 2. Generating thumbnails for gallery display
 * 3. Uploading to Firebase Storage (no 1MB Firestore limit)
 * 4. Returning cloud URLs instead of data URIs
 */

import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

export interface ImageCompressionOptions {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    format?: 'jpeg' | 'png' | 'webp';
}

export interface UploadResult {
    url: string;
    thumbnailUrl: string;
    size: number;
    thumbnailSize: number;
}

export class CloudStorageService {
    /**
     * Compress image using HTML5 Canvas
     * No external dependencies required
     */
    static async compressImage(
        dataUri: string,
        options: ImageCompressionOptions = {}
    ): Promise<{ blob: Blob; dataUri: string }> {
        const {
            maxWidth = 2048,
            maxHeight = 2048,
            quality = 0.8,
            format = 'jpeg'
        } = options;

        return new Promise((resolve, reject) => {
            const img = new Image();

            img.onload = () => {
                // Calculate new dimensions while maintaining aspect ratio
                let { width, height } = img;
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width *= ratio;
                    height *= ratio;
                }

                // Create canvas
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                // Draw and compress
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Failed to get canvas context'));
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);

                // Convert to blob
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('Failed to create blob'));
                            return;
                        }

                        // Convert blob to data URI for immediate display
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            resolve({
                                blob,
                                dataUri: reader.result as string
                            });
                        };
                        reader.readAsDataURL(blob);
                    },
                    format === 'png' ? 'image/png' : `image/${format}`,
                    quality
                );
            };

            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = dataUri;
        });
    }

    /**
     * Generate thumbnail (300x300) for gallery display
     */
    static async generateThumbnail(dataUri: string): Promise<{ blob: Blob; dataUri: string }> {
        return this.compressImage(dataUri, {
            maxWidth: 300,
            maxHeight: 300,
            quality: 0.7,
            format: 'jpeg'
        });
    }

    /**
     * Convert data URI to Blob
     */
    static async dataURItoBlob(dataURI: string): Promise<Blob> {
        const response = await fetch(dataURI);
        return response.blob();
    }

    /**
     * Upload image to Firebase Storage with automatic compression
     * Returns both full image URL and thumbnail URL
     */
    static async uploadImage(
        dataUri: string,
        id: string,
        userId: string
    ): Promise<UploadResult> {
        try {
            // Compress main image
            const compressed = await this.compressImage(dataUri);
            console.log(`Image compressed: ${dataUri.length} → ${compressed.blob.size} bytes`);

            // Generate thumbnail
            const thumbnail = await this.generateThumbnail(dataUri);
            console.log(`Thumbnail generated: ${thumbnail.blob.size} bytes`);

            // Upload main image
            const imageRef = ref(storage, `users/${userId}/assets/${id}.jpg`);
            await uploadBytes(imageRef, compressed.blob);
            const imageUrl = await getDownloadURL(imageRef);

            // Upload thumbnail
            const thumbRef = ref(storage, `users/${userId}/thumbnails/${id}.jpg`);
            await uploadBytes(thumbRef, thumbnail.blob);
            const thumbnailUrl = await getDownloadURL(thumbRef);

            return {
                url: imageUrl,
                thumbnailUrl,
                size: compressed.blob.size,
                thumbnailSize: thumbnail.blob.size
            };
        } catch (error) {
            console.error('Cloud upload failed:', error);
            throw error;
        }
    }

    /**
     * Delete image and thumbnail from Firebase Storage
     */
    static async deleteImage(id: string, userId: string): Promise<void> {
        try {
            const imageRef = ref(storage, `users/${userId}/assets/${id}.jpg`);
            const thumbRef = ref(storage, `users/${userId}/thumbnails/${id}.jpg`);

            await Promise.all([
                deleteObject(imageRef).catch(() => console.warn('Image not found')),
                deleteObject(thumbRef).catch(() => console.warn('Thumbnail not found'))
            ]);
        } catch (error) {
            console.error('Delete failed:', error);
        }
    }

    /**
     * Check if image should be uploaded to cloud
     * Large data URIs (> 500KB) should always be uploaded
     */
    static shouldUploadToCloud(dataUri: string): boolean {
        // Approximate size (base64 is ~1.37x actual size)
        const sizeInBytes = (dataUri.length * 3) / 4;
        const sizeInKB = sizeInBytes / 1024;

        return sizeInKB > 500; // 500KB threshold
    }

    /**
     * Smart save: upload to cloud if large, otherwise keep as data URI
     */
    static async smartSave(
        dataUri: string,
        id: string,
        userId: string
    ): Promise<{ url: string; thumbnailUrl?: string; strategy: 'cloud' | 'local' }> {
        if (this.shouldUploadToCloud(dataUri)) {
            const result = await this.uploadImage(dataUri, id, userId);
            return {
                url: result.url,
                thumbnailUrl: result.thumbnailUrl,
                strategy: 'cloud'
            };
        } else {
            // Small images can stay as data URIs
            const thumbnail = await this.generateThumbnail(dataUri);
            return {
                url: dataUri,
                thumbnailUrl: thumbnail.dataUri,
                strategy: 'local'
            };
        }
    }
}
