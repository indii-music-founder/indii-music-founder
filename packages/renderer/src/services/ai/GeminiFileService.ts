import { AppErrorCode, AppException } from '@/shared/types/errors';
import { logger } from '@/utils/logger';

export interface GeminiFile {
    name: string;
    uri: string;
    mimeType: string;
    sizeBytes: string;
    displayName?: string;
    createTime: string;
    updateTime: string;
    expirationTime: string;
    state: 'PROCESSING' | 'ACTIVE' | 'FAILED';
    error?: {
        code: number;
        message: string;
    };
}

export class GeminiFileService {
    private static instance: GeminiFileService;

    private constructor() {}

    public static getInstance(): GeminiFileService {
        if (!GeminiFileService.instance) {
            GeminiFileService.instance = new GeminiFileService();
        }
        return GeminiFileService.instance;
    }

    private getApiKey(): string {
        const key = import.meta.env.VITE_API_KEY;
        if (!key) {
            throw new AppException(
                AppErrorCode.INTERNAL_ERROR,
                'VITE_API_KEY is not defined. Required for Gemini File API.'
            );
        }
        return key;
    }

    /**
     * Uploads a file to the Gemini File API using the resumable upload protocol.
     * This avoids Node.js `fs` module restrictions and works seamlessly in the Electron Renderer.
     * Generative files are ephemeral and automatically expire after 48 hours.
     * @param file The standard File/Blob object from user drops or fetch operations.
     * @param displayName An optional display name for the file.
     * @param onProgress Callback to report upload progress.
     */
    public async uploadFile(
        file: File | Blob,
        displayName: string = 'Upload',
        onProgress?: (progress: number) => void
    ): Promise<GeminiFile> {
        try {
            const apiKey = this.getApiKey();
            const mimeType = file.type || 'application/octet-stream';
            const size = file.size;

            logger.info(`[GeminiFileService] Starting resumable upload for ${displayName} (${size} bytes)`);

            // Step 1: Initialize Resumable Session
            const startResponse = await fetch(
                `https://generativelanguage.googleapis.com/upload/v1beta/files?uploadType=resumable&key=${apiKey}`,
                {
                    method: 'POST',
                    headers: {
                        'X-Goog-Upload-Protocol': 'resumable',
                        'X-Goog-Upload-Command': 'start',
                        'X-Goog-Upload-Header-Content-Length': size.toString(),
                        'X-Goog-Upload-Header-Content-Type': mimeType,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        file: {
                            display_name: displayName,
                        },
                    }),
                }
            );

            if (!startResponse.ok) {
                const errorText = await startResponse.text();
                throw new Error(`Failed to initialize upload: ${startResponse.status} ${errorText}`);
            }

            const uploadUrl = startResponse.headers.get('x-goog-upload-url');
            if (!uploadUrl) {
                throw new Error('Upload initialization response missing X-Goog-Upload-URL header');
            }

            // Step 2: Upload the actual data
            // To provide robust progress tracking, we could chunk it, but standard
            // XMLHttpRequest / fetch with stream progress is better.
            // For now, doing a direct PUT/POST with the Blob:

            // Send the final payload chunked automatically by fetch
            logger.info(`[GeminiFileService] Sending file data to session URL`);
            if (onProgress) onProgress(0);

            const uploadResponse = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                    'X-Goog-Upload-Protocol': 'resumable',
                    'X-Goog-Upload-Command': 'upload, finalize',
                    'X-Goog-Upload-Offset': '0',
                    'Content-Length': size.toString(),
                },
                body: file,
            });

            if (!uploadResponse.ok) {
                const errorText = await uploadResponse.text();
                throw new Error(`Upload failed: ${uploadResponse.status} ${errorText}`);
            }

            const data = await uploadResponse.json();

            if (!data.file || !data.file.uri) {
                throw new Error('API returned successfully but missing file/uri payload.');
            }

            if (onProgress) onProgress(100);

            logger.info(`[GeminiFileService] Upload complete! URI: ${data.file.uri}`);
            return data.file as GeminiFile;

        } catch (error: unknown) {
            if (error instanceof AppException) throw error;
            const msg = error instanceof Error ? error.message : String(error);
            logger.error(`[GeminiFileService] uploadFile failed: ${msg}`);
            throw new AppException(AppErrorCode.NETWORK_ERROR, `Failed to upload file to Gemini AI: ${msg}`);
        }
    }

    /**
     * Gets a single file's metadata by its name identifier (e.g. "files/xyz123").
     */
    public async getFile(name: string): Promise<GeminiFile> {
        try {
            const apiKey = this.getApiKey();
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/${name}?key=${apiKey}`,
                { method: 'GET' }
            );

            if (!response.ok) {
                throw new Error(`Failed to GET file: ${response.status}`);
            }

            return await response.json();
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            throw new AppException(AppErrorCode.NETWORK_ERROR, `Failed to get Gemini File metadata: ${msg}`);
        }
    }

    /**
     * Polls the file until its state is ACTIVE.
     * Useful for large media like video that require backend processing.
     */
    public async waitForActive(name: string, pollIntervalMs = 5000, timeoutMs = 600000): Promise<GeminiFile> {
        logger.info(`[GeminiFileService] Polling ${name} for ACTIVE state...`);
        const startTime = Date.now();

        while (Date.now() - startTime < timeoutMs) {
            const fileMeta = await this.getFile(name);
            if (fileMeta.state === 'ACTIVE') {
                 logger.info(`[GeminiFileService] ${name} is ACTIVE.`);
                 return fileMeta;
            }
            if (fileMeta.state === 'FAILED') {
                throw new Error(`File processing failed: ${fileMeta.error?.message || 'Unknown error'}`);
            }
            await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
        }

        throw new Error(`Timeout waiting for file to become active after ${timeoutMs}ms`);
    }

    /**
     * Deletes a file.
     */
    public async deleteFile(name: string): Promise<void> {
        try {
            const apiKey = this.getApiKey();
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/${name}?key=${apiKey}`,
                { method: 'DELETE' }
            );

            if (!response.ok) {
                logger.warn(`[GeminiFileService] Failed to GET file for deletion: ${response.status}`);
            } else {
                logger.info(`[GeminiFileService] Successfully deleted ${name}`);
            }
        } catch (error: unknown) {
            logger.warn(`[GeminiFileService] Error deleting file: ${error}`);
        }
    }

    /**
     * Lists files from the Gemini File API.
     */
    public async listFiles(pageSize = 100, pageToken?: string): Promise<{ files: GeminiFile[], nextPageToken?: string }> {
        try {
            const apiKey = this.getApiKey();
            let url = `https://generativelanguage.googleapis.com/v1beta/files?key=${apiKey}&pageSize=${pageSize}`;
            if (pageToken) {
                url += `&pageToken=${pageToken}`;
            }

            const response = await fetch(url, { method: 'GET' });

            if (!response.ok) {
                throw new Error(`Failed to list files: ${response.status}`);
            }

            return await response.json();
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            logger.error(`[GeminiFileService] listFiles failed: ${msg}`);
            throw new AppException(AppErrorCode.NETWORK_ERROR, `Failed to list Gemini Files: ${msg}`);
        }
    }
}