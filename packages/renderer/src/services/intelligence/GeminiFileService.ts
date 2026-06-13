import { AppErrorCode, AppException } from '@/shared/types/errors';
import { logger } from '@/utils/logger';
import { initializeFallbackClient } from './fallback/FallbackClient';

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

    private async getClient() {
        try {
            return await initializeFallbackClient();
        } catch (error: unknown) {
            throw new AppException(
                AppErrorCode.INTERNAL_ERROR,
                'Failed to initialize AI client for File Service.'
            );
        }
    }

    /**
     * Uploads a file to the Gemini File API using the unified SDK.
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
            const client = await this.getClient();
            const mimeType = file.type || 'application/octet-stream';
            const size = file.size;

            logger.info(`[GeminiFileService] Starting file upload for ${displayName} (${size} bytes)`);

            if (onProgress) onProgress(0);

            // Use the unified SDK for uploading
            const response = await client.files.upload({
                file,
                config: {
                    mimeType,
                    displayName
                }
            });

            if (onProgress) onProgress(100);

            logger.info(`[GeminiFileService] Upload complete! URI: ${response.uri}`);
            return response as unknown as GeminiFile;

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
            const client = await this.getClient();
            const response = await client.files.get({ name });
            return response as unknown as GeminiFile;
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
            const client = await this.getClient();
            await client.files.delete({ name });
            logger.info(`[GeminiFileService] Successfully deleted ${name}`);
        } catch (error: unknown) {
            logger.warn(`[GeminiFileService] Error deleting file: ${error}`);
        }
    }

    /**
     * Lists files from the Gemini File API.
     */
    public async listFiles(pageSize = 100, pageToken?: string): Promise<{ files: GeminiFile[], hasMore: boolean }> {
        try {
            const client = await this.getClient();
            // @google/genai returns a Pager (async-iterable); `.page` is the current
            // page of items and `hasNextPage()` reports whether more remain. The SDK
            // manages page tokens internally, so there is no token to surface.
            const pager = await client.files.list({ config: { pageSize, pageToken } });
            return {
                files: (pager.page || []) as unknown as GeminiFile[],
                hasMore: pager.hasNextPage(),
            };
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            logger.error(`[GeminiFileService] listFiles failed: ${msg}`);
            throw new AppException(AppErrorCode.NETWORK_ERROR, `Failed to list Gemini Files: ${msg}`);
        }
    }
}
