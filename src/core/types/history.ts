export interface HistoryItem {
    id: string;
    type: 'image' | 'video' | 'music' | 'text';
    url: string;
    thumbnailUrl?: string; // Small preview for gallery (300x300)
    prompt: string;
    timestamp: number;
    projectId: string;
    orgId?: string;
    meta?: string;
    mask?: string;
    category?: 'headshot' | 'bodyshot' | 'clothing' | 'environment' | 'logo' | 'other';
    tags?: string[];
    subject?: string;
    origin?: 'generated' | 'uploaded';
}
