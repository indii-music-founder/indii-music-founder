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
}

export interface PublicistStats {
    globalReach: string;
    avgOpenRate: string;
    placementValue: string;
}
