import { Timestamp } from 'firebase/firestore';
import { SocialStats } from '@/services/social/types';

// --- Shared Core Types (Moved from workflow/types.ts to avoid circular deps) ---

export interface SocialLinks {
    twitter?: string;
    instagram?: string;
    website?: string;
    spotify?: string;
    soundcloud?: string;
    bandcamp?: string;
    beatport?: string;
    pro?: string; // Performing Rights Org
    distributor?: string;
}

export interface ReleaseDetails {
    title: string;
    type: string; // Single, EP, Album
    artists: string;
    genre: string;
    mood: string;
    themes: string;
    lyrics: string;
}

export interface BrandAsset {
    id?: string;
    url: string;
    description: string;
    category?: 'headshot' | 'bodyshot' | 'clothing' | 'environment' | 'logo' | 'other';
    tags?: string[];
    subject?: string; // e.g. "Dave", "The Band"
}

export interface BrandKit {
    colors: string[];
    fonts: string;
    brandDescription: string;
    aestheticStyle?: string; // Visual aesthetic (e.g., "Cyberpunk", "Minimalist", "Retro 80s")
    negativePrompt: string;
    socials: SocialLinks;
    brandAssets: BrandAsset[];
    referenceImages: BrandAsset[];
    releaseDetails: ReleaseDetails;
    visualsAcknowledged?: boolean; // True if user confirmed they have no visual assets yet
    targetAudience?: string; // Target demographic for marketing
    visualIdentity?: string; // Brand visual style/vibe
}

// Node workflow types needed for SavedWorkflow
// We can use 'any' for now or import minimal types if we want to be strict,
// but to avoid circular deps with workflow/types.ts (which imports UserProfile),
// we should keep SavedWorkflow generically typed here or move Node types to a third generic file.
// For now, let's keep SavedWorkflow definition simple here or just interface it.

export interface SavedWorkflow {
    id: string;
    name: string;
    description: string;
    nodes: any[]; // Using any[] to avoid importing detailed Node types here
    edges: any[];
    viewport: { x: number; y: number; zoom: number };
    createdAt: string;
    updatedAt: string;
}

export type KnowledgeDocumentIndexingStatus = 'pending' | 'indexing' | 'ready' | 'error';

export interface KnowledgeDocument {
    id: string;
    name: string;
    content: string;
    type: string;
    tags?: string[];
    entities?: string[];
    embeddingId?: string;
    indexingStatus: KnowledgeDocumentIndexingStatus;
    createdAt: number;
}

// --- User Types ---

export interface UserPreferences {
    theme: 'dark' | 'light';
    notifications: boolean;
    [key: string]: any; // Allow extensibility
}

export interface UserMembership {
    tier: 'free' | 'pro' | 'enterprise';
    expiresAt: Timestamp | null;
}

export interface UserProfile {
    id: string; // Unified ID (usually same as uid)
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    lastLoginAt: Timestamp;
    emailVerified: boolean;
    membership: UserMembership;
    preferences: UserPreferences;

    // App Specific Fields
    bio?: string;
    brandKit?: BrandKit;
    creativePreferences?: string; // Legacy 'preferences' string for creative direction
    analyzedTrackIds?: string[];
    knowledgeBase?: KnowledgeDocument[];
    savedWorkflows?: SavedWorkflow[];
    careerStage?: string;
    artistType?: 'Solo' | 'Band' | 'Collective';
    goals?: string[];

    // Social & Commerce
    accountType: 'fan' | 'artist' | 'label' | 'admin';
    socialStats?: SocialStats;

    // Legacy support aliases
    avatarUrl?: string;
}
