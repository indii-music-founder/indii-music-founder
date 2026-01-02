import { useState, useMemo, useEffect } from 'react';
import { useStore } from '@/core/store'; // Access global store for userProfile
import { PublicistService } from '@/services/publicist/PublicistService';
import { Campaign, Contact, PublicistStats } from '../types';

export const usePublicist = () => {
    const { userProfile } = useStore();
    const [activeTab, setActiveTab] = useState<'campaigns' | 'contacts'>('campaigns');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'Live' | 'Draft' | 'Scheduled'>('all');

    // Data Loading State
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);

    // Initial Data Fetch
    useEffect(() => {
        if (!userProfile?.id) return;

        setLoading(true);
        // Subscribe to live data
        const unsubCampaigns = PublicistService.subscribeToCampaigns(userProfile.id, (data) => {
            setCampaigns(data);
            setLoading(false);
        });
        const unsubContacts = PublicistService.subscribeToContacts(userProfile.id, setContacts);

        return () => {
            unsubCampaigns();
            unsubContacts();
        };
    }, [userProfile?.id]);

    const filteredCampaigns = useMemo(() => {
        return campaigns.filter(c => {
            const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.artist.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesFilter = filterType === 'all' || c.status === filterType;
            return matchesSearch && matchesFilter;
        });
    }, [campaigns, searchQuery, filterType]);

    const filteredContacts = useMemo(() => {
        return contacts.filter(c => {
            return c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.outlet.toLowerCase().includes(searchQuery.toLowerCase());
        });
    }, [contacts, searchQuery]);

    const stats: PublicistStats = useMemo(() => {
        // 1. Calculate Average Open Rate
        const totalOpenRate = campaigns.reduce((acc, c) => acc + (c.openRate || 0), 0);
        const avgOpenRateVal = campaigns.length > 0 ? Math.round(totalOpenRate / campaigns.length) : 0;

        // 2. Estimate Global Reach based on Contacts Tier
        // Top: 500k, Mid: 50k, Low/Other: 5k
        const reach = contacts.reduce((acc, c) => {
            if (c.tier === 'Top') return acc + 500000;
            if (c.tier === 'Mid') return acc + 50000;
            return acc + 5000;
        }, 0);

        // Format reach (e.g. 1.2M, 850k)
        const formatReach = (n: number) => {
            if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
            if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
            return n.toString();
        };

        // 3. Estimate Placement Value (Mock logic based on "Live" campaigns)
        // e.g. Each live campaign is worth ~$15k in potential value
        const liveCampaigns = campaigns.filter(c => c.status === 'Live').length;
        const value = liveCampaigns * 15000;

        return {
            globalReach: formatReach(reach),
            avgOpenRate: `${avgOpenRateVal}%`,
            placementValue: `$${(value / 1000).toFixed(0)}k`
        };
    }, [campaigns, contacts]);

    return {
        campaigns: filteredCampaigns,
        contacts: filteredContacts,
        stats,
        activeTab,
        setActiveTab,
        searchQuery,
        setSearchQuery,
        filterType,
        setFilterType,
        loading
    };
};
