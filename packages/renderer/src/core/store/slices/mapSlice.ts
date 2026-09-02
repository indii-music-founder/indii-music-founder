import { StateCreator } from 'zustand';
import type { StoreState } from '../types';

export interface AgentScoutLead {
    id: string;
    name: string;
    address: string;
    description: string;
    lat: number;
    lng: number;
    category?: string;
    discoveredAt: number;
}

export interface MapSlice {
    userPins: Array<{ id: string; lat: number; lng: number; timestamp: number }>;
    scoutLeads: AgentScoutLead[];
    addUserPin: (pin: { lat: number; lng: number }) => void;
    addScoutLeads: (leads: Omit<AgentScoutLead, 'id' | 'discoveredAt'>[]) => void;
    clearPins: () => void;
    clearScoutLeads: () => void;
}

export const createMapSlice: StateCreator<StoreState, [], [], MapSlice> = (set) => ({
    userPins: [],
    scoutLeads: [],

    addUserPin: (pin) => set((state) => ({
        userPins: [...state.userPins, {
            id: `pin_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            ...pin,
            timestamp: Date.now()
        }]
    })),

    addScoutLeads: (leads) => set((state) => {
        const newLeads = leads.map(lead => ({
            ...lead,
            id: `lead_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            discoveredAt: Date.now()
        }));

        return {
            scoutLeads: [...state.scoutLeads, ...newLeads]
        };
    }),

    clearPins: () => set({ userPins: [] }),
    clearScoutLeads: () => set({ scoutLeads: [] })
});
