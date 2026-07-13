export interface HistoryItem {
    id: string;
    type: 'image' | 'video' | 'music' | 'text';
    url: string;
    thumbnailUrl?: string; // Small preview for gallery (300x300)
    storageUri?: string; // Canonical Firebase Storage URI for durable media lookup
    prompt: string;
    timestamp: number;
    projectId: string;
    orgId?: string;
    meta?: string;
    mask?: string;
    category?: 'headshot' | 'bodyshot' | 'clothing' | 'environment' | 'logo' | 'other';
    tags?: string[];
    subject?: string;
    origin?: 'generated' | 'uploaded' | 'canvas-export' | 'editor';
    localPath?: string; // Path to locally saved file (Electron/Veo)
    /** ID of the source HistoryItem this was derived from (e.g., canvas-export of a generated image) */
    parentId?: string;
    /**
     * ISSUE-1007: cover-art mode asked the model for compliant dimensions
     * but never measured or validated the actual output against the
     * user's distributor requirements. Present only when the image was
     * generated in cover-art mode and its real decoded dimensions were
     * successfully measured.
     */
    distributorCompliance?: {
        valid: boolean;
        errors: string[];
        warnings: string[];
        measuredWidth: number;
        measuredHeight: number;
        mimeType?: string;
        sizeBytes?: number;
        sha256?: string;
    };
}
