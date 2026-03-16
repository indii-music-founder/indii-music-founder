import React from 'react';
import { Card } from '@/components/ui/card';
import type { ReleaseStatus } from '@/services/distribution/types/distributor';

interface ReleaseStatusCardProps {
    releaseTitle: string;
    artistName: string;
    coverArtUrl?: string;
    deployments: Record<string, { status: ReleaseStatus; error?: string }>;
    releaseDate?: string;
    upc?: string;
}

const getStatusColor = (status: ReleaseStatus): string => {
    switch (status) {
        case 'live':
        case 'delivered':
            return 'text-dept-publishing bg-dept-publishing-muted border-dept-publishing-glow/20';
        case 'failed':
        case 'rejected':
        case 'taken_down':
            return 'text-dept-marketing bg-dept-marketing-muted border-dept-marketing-glow/20';
        case 'processing':
        case 'delivering':
        case 'validating':
            return 'text-dept-distribution bg-dept-distribution-muted border-dept-distribution-glow/20';
        case 'in_review':
        case 'pending_review':
            return 'text-dept-brand bg-dept-brand-muted border-dept-brand-glow/20';
        default:
            return 'text-dept-default bg-dept-default-muted border-dept-default-glow/20';
    }
};

const getStatusLabel = (status: ReleaseStatus): string => {
    return status.replace(/_/g, ' ').toUpperCase();
};

export const ReleaseStatusCard: React.FC<ReleaseStatusCardProps> = ({
    releaseTitle,
    artistName,
    coverArtUrl,
    deployments,
    releaseDate,
    upc
}) => {
    // Determine overall status (most critical one)
    const deploymentList = Object.values(deployments);
    const overallStatus = deploymentList.length > 0 ? deploymentList[0].status : 'draft';

    return (
        <Card className="group relative overflow-hidden bg-white/5 border-white/10 hover:border-dept-distribution/30 transition-all duration-300 hover:shadow-2xl hover:shadow-dept-distribution/10 backdrop-blur-sm">
            <div className="flex flex-col">
                {/* Header with Cover Art */}
                <div className="relative aspect-square overflow-hidden bg-gray-900">
                    {coverArtUrl ? (
                        <img
                            src={coverArtUrl}
                            alt={`${releaseTitle} cover`}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-700">
                            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                            </svg>
                        </div>
                    )}

                    {/* Status Overlay */}
                    <div className="absolute top-4 right-4 focus-within:">
                        <span className={`px-2.5 py-1 text-[10px] font-black tracking-widest rounded-full border backdrop-blur-md ${getStatusColor(overallStatus)}`}>
                            {getStatusLabel(overallStatus)}
                        </span>
                    </div>
                </div>

                {/* Info Section */}
                <div className="p-5">
                    <div className="mb-4">
                        <h3 className="font-bold text-lg text-white leading-tight line-clamp-1 group-hover:text-dept-distribution transition-colors uppercase tracking-tight">
                            {releaseTitle}
                        </h3>
                        <p className="text-sm text-gray-500 font-medium mb-1">{artistName}</p>
                        <p className="text-[10px] text-gray-600 uppercase tracking-wider">
                            Released: {releaseDate ? new Date(releaseDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD'}
                        </p>
                    </div>

                    {/* Deployments List */}
                    <div className="space-y-2 mb-4">
                        <div className="text-[9px] font-bold text-gray-700 uppercase tracking-widest border-b border-gray-800/50 pb-1">
                            Deployments
                        </div>
                        {Object.entries(deployments).map(([id, data]) => (
                            <div key={id} className="flex items-center justify-between text-[11px]">
                                <span className="text-gray-400 capitalize flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-blue-500" />
                                    {id}
                                </span>
                                <span className={`${getStatusColor(data.status).split(' ')[0]} font-bold`}>
                                    {data.status.replace('_', ' ')}
                                </span>
                            </div>
                        ))}
                        {Object.keys(deployments).length === 0 && (
                            <div className="text-[11px] text-gray-600 italic py-1">No active deployments</div>
                        )}
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-gray-800/50">
                        {upc && (
                            <span className="text-[10px] text-gray-600 font-mono">UPC: {upc}</span>
                        )}
                        <button className="text-[11px] font-bold text-white hover:text-dept-distribution transition-colors ml-auto group/btn flex items-center gap-1 uppercase tracking-widest">
                            VIEW DETAILS
                            <svg className="w-3 h-3 transform transition-transform group-hover/btn:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Premium detail: thin accent line */}
            <div className={`absolute bottom-0 left-0 h-[2px] w-0 group-hover:w-full transition-all duration-500 ${getStatusColor(overallStatus).replace('text-', 'bg-').split(' ')[0]}`} />
        </Card>
    );
};
