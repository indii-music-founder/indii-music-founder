
import {
    ref,
    uploadBytesResumable,
    getDownloadURL,
    UploadTaskSnapshot,
    StorageError
} from 'firebase/storage';
import { storage } from '../firebase'; // Adjust path to shared firebase instance
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
}

export class VideoUploadService {
    /**
     * Uploads a video file using resumable uploads and optimized metadata.
     * Enforces video/mp4 content type if not detected.
     */
    static async uploadVideo(
        file: File | Blob,
        destinationPath: string,
        options: VideoUploadOptions = {}
    ): Promise<VideoUploadResult> {
        const { onProgress, metadata } = options;

        // 1. Prepare Metadata (Best Practice: Cache-Control & Content-Type)
        const uploadMetadata = {
            contentType: file.type || 'video/mp4',
            cacheControl: 'public, max-age=31536000',
            customMetadata: metadata
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
                    Logger.error('VideoUploadService', 'Upload failed:', error);
                    reject(error);
                },
                async () => {
                    // Upload completed successfully
                    try {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        Logger.info('VideoUploadService', 'Upload complete:', downloadURL);

                        resolve({
                            url: downloadURL,
                            path: destinationPath,
                            size: file.size,
                            contentType: uploadMetadata.contentType
                        });
                    } catch (e) {
                        Logger.error('VideoUploadService', 'Failed to get download URL:', e);
                        reject(e);
                    }
                }
            );
        });
    }

    /**
     * Validates video file size and type before upload.
     */
    static validateVideo(file: File): string | null {
        if (!file.type.startsWith('video/')) {
            return 'File is not a valid video.';
        }
        // Example limit: 500MB
        const MAX_SIZE = 500 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            return `File too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Max size is 500MB.`;
        }
        return null;
    }
}
