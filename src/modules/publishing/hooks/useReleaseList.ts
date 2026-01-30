import { useState, useMemo } from 'react';
import { useReleases } from './useReleases';
import { useStore } from '@/core/store';

export function useReleaseList() {
    const currentOrganizationId = useStore(state => state.currentOrganizationId);
    const { releases, loading, deleteRelease, archiveRelease } = useReleases(currentOrganizationId);

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const filteredReleases = useMemo(() => {
        return releases.filter(release => {
            const matchesSearch =
                release.metadata.trackTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                release.metadata.artistName?.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesFilter = statusFilter === 'all' || release.status === statusFilter;

            return matchesSearch && matchesFilter;
        });
    }, [releases, searchQuery, statusFilter]);

    return {
        releases: filteredReleases,
        allReleases: releases,
        loading,
        searchQuery,
        setSearchQuery,
        statusFilter,
        setStatusFilter,
        deleteRelease,
        archiveRelease
    };
}
