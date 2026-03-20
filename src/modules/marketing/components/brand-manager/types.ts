import { BrandKit } from '@/modules/workflow/types';
import { BrandAsset, SocialLinks, UserProfile } from '@/types/User';

/**
 * Shared props interface for all BrandManager tab panels.
 * Each panel receives the data and handlers it needs from the parent.
 */
export interface BrandManagerTabProps {
    userProfile: UserProfile | null;
    brandKit: BrandKitWithDefaults;
    release: ReleaseDetails;
    updateBrandKit: (updates: Partial<BrandKit>) => void;
    saveBrandKit: (updates: Partial<BrandKit>) => Promise<void>;
    setUserProfile: (profile: UserProfile) => void;
}

/**
 * BrandKit with default values applied (never null/undefined at top level).
 */
export interface BrandKitWithDefaults {
    colors: string[];
    fonts: string;
    brandDescription: string;
    negativePrompt: string;
    socials: SocialLinks;
    brandAssets: BrandAsset[];
    referenceImages: BrandAsset[];
    releaseDetails: ReleaseDetails;
    healthHistory: HealthHistoryEntry[];
    digitalAura: string[];
}

export interface ReleaseDetails {
    title: string;
    type: string;
    artists: string;
    genre: string;
    mood: string;
    themes: string;
    lyrics: string;
    releaseDate?: string;
    coverArtUrl?: string;
    tracks?: TrackEntry[];
}

export interface TrackEntry {
    title: string;
    duration: string;
    collaborators?: string;
}

export interface HealthHistoryEntry {
    id: string;
    date: string;
    type: string;
    score: number;
    content: string;
    issues: string[];
    suggestions: string[];
}

export interface AnalysisResult {
    isConsistent: boolean;
    score: number;
    issues: string[];
    suggestions: string[];
}
