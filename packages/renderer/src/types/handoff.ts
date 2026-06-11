/**
 * Universal Send-To Handoff Types
 * Maps visual assets to different indii platform modules.
 */

export type SendToTarget = 'merch' | 'marketing' | 'boardroom' | 'touring';

export interface SendToPayload {
    assetId: string;
    assetUrl: string;
    assetType: 'image' | 'video';
    prompt?: string;
    originModule: 'creative' | 'files' | 'dashboard';
    timestamp: number;
    metadata?: {
        width?: number;
        height?: number;
        aspect?: number;
        digitalAuraTags?: string[];
        campaignId?: string;
        projectId: string;
    };
}
