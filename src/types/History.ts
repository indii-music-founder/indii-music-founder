export interface HistoryItem {
    id: string;
    type: 'image' | 'video' | 'music' | 'text';
    url: string;
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
