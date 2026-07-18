import { AppErrorCode, AppException } from '@/shared/types/errors';

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

    /**
     * DEPRECATED: File operations must route through backend API.
     * Client-side file uploads are disabled. Use the fileUpload Cloud Function instead.
     */
    public async uploadFile(): Promise<GeminiFile> {
        throw new AppException(
            AppErrorCode.INTERNAL_ERROR,
            'File operations must route through backend API. Use the fileUpload Cloud Function instead of direct client-side upload.'
        );
    }

    /**
     * DEPRECATED: File operations must route through backend API.
     */
    public async getFile(): Promise<GeminiFile> {
        throw new AppException(
            AppErrorCode.INTERNAL_ERROR,
            'File operations must route through backend API. Use the fileQuery Cloud Function instead.'
        );
    }

    /**
     * DEPRECATED: File operations must route through backend API.
     */
    public async waitForActive(): Promise<GeminiFile> {
        throw new AppException(
            AppErrorCode.INTERNAL_ERROR,
            'File operations must route through backend API. Use the fileStatus Cloud Function instead.'
        );
    }

    /**
     * DEPRECATED: File operations must route through backend API.
     */
    public async deleteFile(): Promise<void> {
        throw new AppException(
            AppErrorCode.INTERNAL_ERROR,
            'File operations must route through backend API. Use the fileDelete Cloud Function instead.'
        );
    }

    /**
     * DEPRECATED: File operations must route through backend API.
     */
    public async listFiles(): Promise<{ files: GeminiFile[], hasMore: boolean }> {
        throw new AppException(
            AppErrorCode.INTERNAL_ERROR,
            'File operations must route through backend API. Use the fileList Cloud Function instead.'
        );
    }
}
