import { Timestamp } from 'firebase/firestore';
import { UserProfile as AppUserProfile } from '../modules/workflow/types';

export interface UserContext extends AppUserProfile {
    uid: string;
    email: string;
    displayName: string | null;
    photoURL: string | null;
    createdAt: Timestamp;
    lastLoginAt: Timestamp;
    tier: 'free' | 'pro' | 'enterprise';
    preferences: any; // Override string type from AppUserProfile if needed, or map it
}

