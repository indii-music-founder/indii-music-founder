import { useState, useMemo } from 'react';
import { useReleases } from './useReleases';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';

export function useReleaseList() {
    const { currentOrganizationId } = useStore(useShallow(state => ({
        currentOrganizationId: state.currentOrganizationId
    })));
    const { releases, loading, hasPendingSync, deleteRelease, archiveRelease } = useReleases(currentOrganizationId);

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
        hasPendingSync,
        deleteRelease,
        archiveRelease
    };
}
