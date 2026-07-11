export interface Campaign {
    id: string;
    artist: string;
    title: string;
    type: 'Album' | 'Single' | 'Tour';
    status: 'Draft' | 'Live' | 'Scheduled' | 'Ended';
    progress: number; // 0-100
    releaseDate: string;
    coverUrl?: string;
    openRate: number;
    budget: number; // Added budget field
}

export interface Contact {
    id: string;
    name: string;
    outlet: string;
    role: 'Journalist' | 'Curator' | 'Influencer' | 'Editor';
    tier: 'Top' | 'Mid' | 'Blog';
    influenceScore: number; // 0-100
    relationshipStrength: 'Strong' | 'Neutral' | 'Weak';
    avatarUrl?: string;
    notes?: string;
    lastInteraction?: string;
    /**
     * Verified recipient email (ISSUE-912). Never inferred from name/outlet —
     * "Open in Mail" must be disabled without a real address on file here.
     */
    email?: string;
}

export interface PublicistStats {
    globalReach: string;
    avgOpenRate: string;
    placementValue: string;
}
