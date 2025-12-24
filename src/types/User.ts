import { Timestamp } from 'firebase/firestore';
import { BrandKit, KnowledgeDocument, SavedWorkflow } from '@/modules/workflow/types';

export interface UserPreferences {
    theme: 'dark' | 'light';
    notifications: boolean;
}

export interface UserMembership {
    tier: 'free' | 'pro' | 'enterprise';
    expiresAt: Timestamp | null;
}

export interface UserProfile {
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
    goals?: string[];
}
