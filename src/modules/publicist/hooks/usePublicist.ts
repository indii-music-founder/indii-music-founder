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

    // Initial Data Fetch & Seeding
    useEffect(() => {
        if (!userProfile?.id) return;

        const init = async () => {
            setLoading(true);
            try {
                // Seed mock data if empty
                await PublicistService.seedDatabase(userProfile.id);
            } catch (e) {
                console.error("Failed to seed database:", e);
            } finally {
                setLoading(false);
            }
        };

        init();

        // Subscribe to live data
        const unsubCampaigns = PublicistService.subscribeToCampaigns(userProfile.id, setCampaigns);
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

    const stats: PublicistStats = useMemo(() => ({
        globalReach: '1.2M',
        avgOpenRate: '34%',
        placementValue: '$45k'
    }), []); // TODO: Calculate these from real data later

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
