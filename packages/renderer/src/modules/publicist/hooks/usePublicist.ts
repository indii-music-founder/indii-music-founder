import { useState, useMemo, useEffect, useRef } from 'react';
import { useStore } from '@/core/store'; // Access global store for userProfile
import { useShallow } from 'zustand/react/shallow';
import { PublicistService } from '@/services/publicist/PublicistService';
import { Campaign, Contact, PublicistStats } from '../types';
import { safeUnsubscribe } from '@/utils/safeUnsubscribe';

export const usePublicist = () => {
    const { userProfile } = useStore(useShallow(state => ({
        userProfile: state.userProfile
    })));
    const [activeTab, setActiveTab] = useState<'campaigns' | 'contacts' | 'superfans'>('campaigns');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'Live' | 'Draft' | 'Scheduled'>('all');

    // Data Loading State — loading is derived from whether campaigns have been received
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [hasReceivedData, setHasReceivedData] = useState(false);

    // Mounted guard to prevent state updates on unmounted component (Firestore b815 crash fix)
    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    // Derive loading from userId presence + data receipt
    const userId = userProfile?.uid || userProfile?.id;
    const loading = !!userId && !hasReceivedData;

    // Initial Data Fetch
    useEffect(() => {
        if (!userId) return;

        // Subscribe to live data
        const unsubCampaigns = PublicistService.subscribeToCampaigns(userId, (data) => {
            if (!isMountedRef.current) return;
            setCampaigns(data);
            setHasReceivedData(true);
        });
        const unsubContacts = PublicistService.subscribeToContacts(userId, (data) => {
            if (!isMountedRef.current) return;
            setContacts(data);
        });

        return () => {
            safeUnsubscribe(unsubCampaigns);
            safeUnsubscribe(unsubContacts);
        };
    }, [userId]);

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
        return PublicistService.calculateStats(campaigns, contacts);
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
        loading,
        userProfile // Expose for creating campaigns
    };
};
