import React from 'react';
import { Radio } from 'lucide-react';
import { ReleaseStatusCard } from './ReleaseStatusCard';
import { ActionableEmptyState } from '@/components/shared/ActionableEmptyState';

interface ReleasesContentProps {
    releases: any[];
    loading: boolean;
    error: string | null;
    onRetry: () => void;
}

export function ReleasesContent({ releases, loading, error, onRetry }: ReleasesContentProps) {
    if (loading && releases.length === 0) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-48 rounded-xl bg-white/[0.02] animate-pulse border border-white/5" />
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 border border-red-900/50 rounded-xl bg-red-900/10 text-center">
                <p className="text-red-400 text-sm">{error}</p>
                <button
                    onClick={onRetry}
                    className="mt-4 px-4 py-2 bg-red-900/20 hover:bg-red-900/30 text-red-400 rounded-lg transition-colors text-xs font-bold"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (releases.length === 0) {
        return (
            <ActionableEmptyState
                icon={<Radio size={48} />}
                title="NO ACTIVE RELEASES"
                description="Your distributed music will appear here once you start the rollout process from Publishing."
                colorClasses={{
                    text: 'text-gray-500',
                    bg: 'bg-white/5',
                    border: 'border-white/5'
                }}
            />
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {releases.map((release) => (
                <ReleaseStatusCard
                    key={release.id}
                    releaseTitle={release.title}
                    artistName={release.artist}
                    coverArtUrl={release.coverArtUrl}
                    deployments={release.deployments}
                    releaseDate={release.releaseDate}
                />
            ))}
        </div>
    );
}
