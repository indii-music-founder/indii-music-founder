import { useState, useMemo } from 'react';
import { useReleases } from '@/modules/publishing/hooks/useReleases';
import { useReleaseWorkspace } from '@/modules/publishing/hooks/useReleaseWorkspace';

export function useReleaseList() {
    const workspace = useReleaseWorkspace();
    const { releases, loading, error, hasPendingSync, deleteRelease, archiveRelease } = useReleases(workspace);

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
        error,
        searchQuery,
        setSearchQuery,
        statusFilter,
        setStatusFilter,
        hasPendingSync,
        deleteRelease,
        archiveRelease
    };
}
