import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ReleaseStatus } from '@/services/distribution/types/distributor';

interface ReleaseStatusCardProps {
    releaseTitle: string;
    artistName: string;
    coverArtUrl?: string;
    status: ReleaseStatus;
    releaseDate: string;
    upc?: string;
}

const getStatusColor = (status: ReleaseStatus): string => {
    switch (status) {
        case 'live':
        case 'delivered':
            return 'bg-green-100 text-green-800 border-green-200';
        case 'failed':
        case 'rejected':
        case 'taken_down':
            return 'bg-red-100 text-red-800 border-red-200';
        case 'processing':
        case 'delivering':
        case 'validating':
            return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'in_review':
        case 'pending_review':
            return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        default: // draft, takedown_requested
            return 'bg-gray-100 text-gray-800 border-gray-200';
    }
};

const getStatusLabel = (status: ReleaseStatus): string => {
    return status.replace(/_/g, ' ').toUpperCase();
};

export const ReleaseStatusCard: React.FC<ReleaseStatusCardProps> = ({
    releaseTitle,
    artistName,
    coverArtUrl,
    status,
    releaseDate,
    upc
}) => {
    return (
        <Card className="overflow-hidden bg-white hover:shadow-md transition-shadow">
            <div className="flex flex-row">
                {/* Cover Art Section */}
                <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gray-200 flex-shrink-0 relative">
                    {coverArtUrl ? (
                        <img
                            src={coverArtUrl}
                            alt={`${releaseTitle} cover`}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <span className="text-xs">No Cover</span>
                        </div>
                    )}
                </div>

                {/* Details Section */}
                <div className="flex-1 p-4 flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-lg leading-tight line-clamp-1">{releaseTitle}</h3>
                                <p className="text-sm text-muted-foreground line-clamp-1">{artistName}</p>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getStatusColor(status)}`}>
                                {getStatusLabel(status)}
                            </span>
                        </div>
                    </div>

                    <div className="flex justify-between items-end mt-2 text-xs text-gray-500">
                        <div>
                            <p>Release Date: {new Date(releaseDate).toLocaleDateString()}</p>
                            {upc && <p>UPC: {upc}</p>}
                        </div>
                        <button className="text-primary hover:underline font-medium">
                            View Details
                        </button>
                    </div>
                </div>
            </div>

            {/* Progress Bar for Processing states */}
            {(status === 'processing' || status === 'delivering') && (
                <div className="h-1 w-full bg-blue-100">
                    <div className="h-full bg-blue-500 w-1/2 animate-pulse" />
                </div>
            )}
        </Card>
    );
};
