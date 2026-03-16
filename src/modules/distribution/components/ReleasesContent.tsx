import React, { useState } from 'react';
import { Radio, PlusCircle } from 'lucide-react';
import { ReleaseStatusCard } from './ReleaseStatusCard';
import { SubmitReleaseModal } from './SubmitReleaseModal';
import { ActionableEmptyState } from '@/components/shared/ActionableEmptyState';

interface ReleasesContentProps {
    releases: any[];
    loading: boolean;
    error: string | null;
    onRetry: () => void;
}

export function ReleasesContent({ releases, loading, error, onRetry }: ReleasesContentProps) {
    const [submitOpen, setSubmitOpen] = useState(false);

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

    return (
        <>
            {/* Submit button row */}
            <div className="flex justify-end mb-4">
                <button
                    onClick={() => setSubmitOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-black font-black text-xs uppercase tracking-widest rounded-lg hover:bg-gray-200 active:scale-[0.98] transition-all"
                >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Submit Release
                </button>
            </div>

            {releases.length === 0 ? (
                <ActionableEmptyState
                    icon={<Radio size={48} />}
                    title="NO ACTIVE RELEASES"
                    description="Submit your first release using the button above."
                    colorClasses={{
                        text: 'text-gray-500',
                        bg: 'bg-white/5',
                        border: 'border-white/5'
                    }}
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
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {releases.map((release) => (
                        <ReleaseStatusCard
                            key={release.id}
                            releaseTitle={release.title}
                            artistName={release.artist}
                            coverArtUrl={release.coverArtUrl}
                            deployments={release.deployments}
                            releaseDate={release.releaseDate || new Date().toISOString()}
                        />
                    ))}
                </div>
            )}

            <SubmitReleaseModal
                open={submitOpen}
                onClose={() => setSubmitOpen(false)}
                onSubmitted={() => {
                    setSubmitOpen(false);
                    onRetry(); // refresh releases list
                }}
            />
        </>
    );
}
