import { create } from 'zustand';
import { Venue, GigOpportunity, OutreachCampaign, GigStatus } from '../types';

interface AgentState {
    venues: Venue[];
    gigs: GigOpportunity[];

    campaigns: OutreachCampaign[];
    isScanning: boolean;

    // Actions
    addVenue: (venue: Venue) => void;
    updateVenue: (id: string, updates: Partial<Venue>) => void;
    addGig: (gig: GigOpportunity) => void;
    updateGigStatus: (id: string, status: GigStatus) => void;

    setScanning: (isScanning: boolean) => void;

    // Selectors
    getGigsByStatus: (status: GigStatus) => GigOpportunity[];
    getVenue: (id: string) => Venue | undefined;
}

export const useAgentStore = create<AgentState>((set, get) => ({
    venues: [],
    gigs: [],

    campaigns: [],
    isScanning: false,

    addVenue: (venue) => set((state) => ({
        venues: [...state.venues, venue]
    })),

    updateVenue: (id, updates) => set((state) => ({
        venues: state.venues.map((v) => (v.id === id ? { ...v, ...updates } : v))
    })),

    addGig: (gig) => set((state) => ({
        gigs: [...state.gigs, gig]
    })),

    updateGigStatus: (id, status) => set((state) => ({
        gigs: state.gigs.map((g) => (g.id === id ? { ...g, status, updatedAt: Date.now() } : g))
    })),



    setScanning: (isScanning) => set({ isScanning }),

    getGigsByStatus: (status) => get().gigs.filter((g) => g.status === status),

    getVenue: (id) => get().venues.find((v) => v.id === id),
}));
