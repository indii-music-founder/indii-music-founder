/**
 * Universal Send-To Handoff Types
 * Maps visual assets to different indii platform modules (external routing).
 * Also supports cross-stage handoff within Creative (Image/Veo/Omni).
 */

import { HistoryItem } from '@/core/types/history';

// External module routing
export type SendToTarget = 'merch' | 'marketing' | 'boardroom' | 'touring';

export interface SendToPayload {
    assetId: string;
    assetUrl: string;
    assetType: 'image' | 'video';
    prompt?: string;
    targetView?: string;
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

// Cross-stage handoff within Creative (Image / Veo / Omni / timeline editor)
export type CreativeStage = 'image' | 'veo' | 'omni' | 'editor';

export type HandoffRole =
    | 'source-video'      // Veo/Omni source (video input)
    | 'first-frame'       // Veo/Omni first frame
    | 'last-frame'        // Veo/Omni last frame
    | 'reference-image'   // Veo/Omni reference image for styling/character
    | 'reference-audio'   // Omni audio reference
    | 'image-input';      // Image stage input/reference

export interface StageHandoffPayload {
    item: HistoryItem;
    role: HandoffRole;
    originStage: CreativeStage;
    timestamp: number;
    parentJobId?: string;
}

// Type validation: which asset types are valid for each role
export const VALID_ASSET_TYPES: Record<HandoffRole, ('image' | 'video' | 'music' | 'text')[]> = {
    'source-video': ['video'],
    'first-frame': ['image', 'video'],     // Can extract frame from video
    'last-frame': ['image', 'video'],      // Can extract frame from video
    'reference-image': ['image'],
    'reference-audio': ['music'],
    'image-input': ['image'],
};
