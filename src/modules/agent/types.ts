export enum AgentActionType {
    SEARCH_VENUES = 'SEARCH_VENUES',
    EMAIL_OUTREACH = 'EMAIL_OUTREACH',
    UPDATE_STATUS = 'UPDATE_STATUS',
    RESEARCH_CONTACT = 'RESEARCH_CONTACT',
    BROWSER_DRIVE = 'BROWSER_DRIVE',
}

export enum GigStatus {
    IDENTIFIED = 'IDENTIFIED',
    CONTACTED = 'CONTACTED',
    NEGOTIATING = 'NEGOTIATING',
    BOOKED = 'BOOKED',
    REJECTED = 'REJECTED',
    ARCHIVED = 'ARCHIVED'
}

export interface Venue {
    id: string;
    name: string;
    city: string;
    state?: string;
    capacity: number;
    genres: string[];
    website?: string;
    contactEmail?: string;
    contactName?: string;
    instagramHandle?: string;
    status: 'active' | 'blacklisted' | 'unknown' | 'closed';
    notes?: string;
    lastScoutedAt?: number;
    imageUrl?: string;
    fitScore?: number;
}

export interface GigOpportunity {
    id: string;
    venueId: string;
    artistId: string;
    campaignId?: string;
    proposedDate?: number; // Timestamp
    status: GigStatus;
    dealType?: 'guarantee' | 'door_split' | 'promoter_profit' | 'unknown';
    guaranteeAmount?: number;
    ticketPrice?: number;
    notes?: string;
    createdAt: number;
    updatedAt: number;
}

export interface AgentAction {
    id: string;
    type: AgentActionType;
    description: string;
    timestamp: number;
    metadata?: Record<string, any>;
    status: 'pending' | 'completed' | 'failed';
    gigId?: string;
}

export interface OutreachCampaign {
    id: string;
    name: string;
    targetCities: string[];
    startDate: number;
    endDate?: number;
    status: 'active' | 'paused' | 'completed';
    gigs: string[]; // GigOpportunity IDs
}
