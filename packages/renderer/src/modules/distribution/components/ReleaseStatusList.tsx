
import React from 'react';
import { ReleaseStatus, DistributorId } from '@/services/distribution/types/distributor';
import { MoreHorizontal, Play, Archive, FileText, CheckCircle, AlertCircle, Clock, Loader2 } from 'lucide-react';

interface ReleaseItem {
    id: string; // Internal ID
    title: string;
    artist: string;
    coverArtUrl?: string;
    releaseDate: string;
    deployments: Record<DistributorId, { status: string }>;
}

interface ReleaseStatusListProps {
    releases: ReleaseItem[];
    onDeliver: (releaseId: string, distributorId: string) => void;
    onViewReport: (releaseId: string) => void;
}

export default function ReleaseStatusList({ releases, onDeliver, onViewReport }: ReleaseStatusListProps) {
    if (releases.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-gray-800 rounded-xl bg-[#161b22]/50">
                <div className="h-16 w-16 bg-gray-800 rounded-full flex items-center justify-center mb-4 text-gray-500">
                    <FileText size={32} />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">No Releases Yet</h3>
                <p className="text-gray-400 max-w-sm mb-6">Create your first release in the Studio to start distributing to platforms.</p>
                <button className="px-5 py-2.5 bg-white text-black rounded-lg font-semibold hover:bg-gray-200 transition-colors">
                    Create New Release
                </button>
            </div>
        );
    }

    return (
        <div className="bg-[#161b22] border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-gray-800 bg-gray-900/50">
                            <th className="py-4 px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider">Release</th>
                            <th className="py-4 px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider">Release Date</th>
                            <th className="py-4 px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider">Distribution Status</th>
                            <th className="py-4 px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                        {releases.map((release) => (
                            <tr key={release.id} className="group hover:bg-gray-800/30 transition-colors">
                                <td className="py-4 px-6">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 bg-gray-800 rounded-md overflow-hidden shrink-0 border border-gray-700">
                                            {release.coverArtUrl ? (
                                                <img src={release.coverArtUrl} alt={release.title} className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="h-full w-full flex items-center justify-center text-gray-600">
                                                    <FileText size={20} />
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <div className="font-bold text-white text-sm">{release.title}</div>
                                            <div className="text-xs text-gray-400">{release.artist}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="py-4 px-6 text-sm text-gray-300">
                                    {new Date(release.releaseDate).toLocaleDateString()}
                                </td>
                                <td className="py-4 px-6">
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(release.deployments).map(([distId, dept]) => (
                                            <StatusBadge key={distId} distributorId={distId} status={dept.status} />
                                        ))}
                                    </div>
                                </td>
                                <td className="py-4 px-6 text-right">
                                    <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors">
                                        <MoreHorizontal size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function StatusBadge({ distributorId, status }: { distributorId: string; status: string }) {
    const config = getStatusConfig(status);

    return (
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium ${config.classes} max-w-fit cursor-default`} title={`${distributorId}: ${status}`}>
            {config.icon}
            <span className="capitalize">{distributorId}</span>
        </div>
    );
}

function getStatusConfig(status: string) {
    switch (status) {
        case 'live':
        case 'delivered':
        case 'approved':
            return {
                classes: 'bg-green-500/10 border-green-500/20 text-green-400',
                icon: <CheckCircle size={10} />
            };
        case 'processing':
        case 'validating':
        case 'delivering':
            return {
                classes: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
                icon: <Loader2 size={10} className="animate-spin" />
            };
        case 'failed':
        case 'rejected':
            return {
                classes: 'bg-red-500/10 border-red-500/20 text-red-400',
                icon: <AlertCircle size={10} />
            };
        case 'draft':
        default:
            return {
                classes: 'bg-gray-800 border-gray-700 text-gray-400',
                icon: <Clock size={10} />
            };
    }
}
