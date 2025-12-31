import { useState, useMemo } from 'react';

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

export const usePublicist = () => {
    const [activeTab, setActiveTab] = useState<'campaigns' | 'contacts'>('campaigns');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'Live' | 'Draft' | 'Scheduled'>('all');

    const rawCampaigns: Campaign[] = useMemo(() => [
        {
            id: '1',
            artist: 'LUNA',
            title: 'Eclipse Album Launch',
            type: 'Album',
            status: 'Live',
            progress: 65,
            releaseDate: '2025-11-15',
            openRate: 42,
            coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop'
        },
        {
            id: '2',
            artist: 'The Apollo',
            title: 'World Tour Announcement',
            type: 'Tour',
            status: 'Scheduled',
            progress: 30,
            releaseDate: '2026-01-20',
            openRate: 0,
            coverUrl: 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=300&h=300&fit=crop'
        },
        {
            id: '3',
            artist: 'Neon Vibe',
            title: 'Midnight Single',
            type: 'Single',
            status: 'Draft',
            progress: 10,
            releaseDate: 'TBD',
            openRate: 0
        }
    ], []);

    const rawContacts: Contact[] = useMemo(() => [
        {
            id: 'c1',
            name: 'Sarah Jenkins',
            outlet: 'Rolling Stone',
            role: 'Journalist',
            tier: 'Top',
            influenceScore: 95,
            relationshipStrength: 'Strong',
            avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop'
        },
        {
            id: 'c2',
            name: 'David Cho',
            outlet: 'Pitchfork',
            role: 'Editor',
            tier: 'Top',
            influenceScore: 88,
            relationshipStrength: 'Neutral',
            avatarUrl: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100&h=100&fit=crop'
        },
        {
            id: 'c3',
            name: 'Allyn Regione',
            outlet: 'Indie Shuffle',
            role: 'Curator',
            tier: 'Mid',
            influenceScore: 72,
            relationshipStrength: 'Strong',
            avatarUrl: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=100&h=100&fit=crop'
        },
        {
            id: 'c4',
            name: 'Global Hits Playlist',
            outlet: 'Spotify',
            role: 'Curator',
            tier: 'Top',
            influenceScore: 99,
            relationshipStrength: 'Weak'
        }
    ], []);

    const filteredCampaigns = useMemo(() => {
        return rawCampaigns.filter(c => {
            const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.artist.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesFilter = filterType === 'all' || c.status === filterType;
            return matchesSearch && matchesFilter;
        });
    }, [rawCampaigns, searchQuery, filterType]);

    const filteredContacts = useMemo(() => {
        return rawContacts.filter(c => {
            return c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.outlet.toLowerCase().includes(searchQuery.toLowerCase());
        });
    }, [rawContacts, searchQuery]);

    const stats = useMemo(() => ({
        globalReach: '1.2M',
        avgOpenRate: '34%',
        placementValue: '$45k'
    }), []);

    return {
        campaigns: filteredCampaigns,
        contacts: filteredContacts,
        stats,
        activeTab,
        setActiveTab,
        searchQuery,
        setSearchQuery,
        filterType,
        setFilterType
    };
};
