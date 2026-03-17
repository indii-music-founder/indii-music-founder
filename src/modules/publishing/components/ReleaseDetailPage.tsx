import React from 'react';
import { motion } from 'motion/react';
import {
    ChevronLeft,
    Edit2,
    Globe,
    ExternalLink,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Music,
    Disc,
    User,
    Calendar,
    Hash,
    Layers
} from 'lucide-react';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
import type { ReleaseAssets, DistributorId, ReleaseStatus } from '@/services/distribution/types/distributor';

interface ReleaseDetailPageProps {
    releaseId: string;
    metadata: ExtendedGoldenMetadata;
    assets: ReleaseAssets;
    deployments: {
        distributorId: DistributorId;
        status: ReleaseStatus;
        distributorReleaseId?: string;
        liveUrl?: string;
    }[];
    onEdit?: () => void;
    onTakedown?: (distributorId: DistributorId) => void;
    onBack?: () => void;
    className?: string;
}

export const ReleaseDetailPage: React.FC<ReleaseDetailPageProps> = ({
    releaseId,
    metadata,
    assets,
    deployments,
    onEdit,
    onTakedown,
    onBack,
    className = ''
}) => {
    const statusMap: Record<ReleaseStatus, { label: string; color: string; icon: React.ReactNode }> = {
        'draft': { label: 'Draft', color: 'gray', icon: <Edit2 size={12} /> },
        'validating': { label: 'Validating', color: 'blue', icon: <Clock size={12} /> },
        'pending_review': { label: 'Review', color: 'yellow', icon: <AlertTriangle size={12} /> },
        'in_review': { label: 'Review', color: 'yellow', icon: <AlertTriangle size={12} /> },
        'approved': { label: 'Approved', color: 'green', icon: <CheckCircle2 size={12} /> },
        'processing': { label: 'Processing', color: 'blue', icon: <Layers size={12} /> },
        'delivering': { label: 'Delivering', color: 'blue', icon: <Globe size={12} /> },
        'delivered': { label: 'Delivered', color: 'green', icon: <CheckCircle2 size={12} /> },
        'live': { label: 'Live', color: 'green', icon: <Globe size={12} /> },
        'failed': { label: 'Failed', color: 'red', icon: <AlertTriangle size={12} /> },
        'takedown_requested': { label: 'Takedown', color: 'red', icon: <Clock size={12} /> },
        'taken_down': { label: 'Removed', color: 'gray', icon: <Hash size={12} /> },
        'rejected': { label: 'Rejected', color: 'red', icon: <AlertTriangle size={12} /> }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex flex-col gap-8 ${className}`}
        >
            {/* Header / Navigation */}
            <div className="flex items-center justify-between">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-800 rounded-xl text-sm font-bold text-gray-400 hover:text-white transition-all group"
                >
                    <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                    Back to Catalog
                </button>
                <button
                    onClick={onEdit}
                    className="flex items-center gap-2 px-6 py-2.5 bg-white text-black rounded-xl font-bold text-sm hover:bg-gray-200 transition-all active:scale-95 shadow-lg"
                >
                    <Edit2 size={16} />
                    Edit Release
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Artwork & Deployment Status */}
                <div className="space-y-6">
                    <div className="relative group aspect-square rounded-2xl overflow-hidden border border-gray-800 shadow-2xl">
                        {assets.coverArt?.url ? (
                            <img
                                src={assets.coverArt.url}
                                alt={metadata.trackTitle}
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            />
                        ) : (
                            <div className="w-full h-full bg-gray-900 flex items-center justify-center text-gray-700">
                                <Music size={64} />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                        <div className="absolute bottom-6 left-6 right-6">
                            <div className="flex items-center gap-2">
                                <span className="px-3 py-1 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg text-[10px] font-black text-white uppercase tracking-widest">
                                    {metadata.genre || 'Electronic'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#121212] border border-gray-800 rounded-2xl p-6 shadow-xl">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-6 px-1 flex items-center justify-between">
                            Platforms
                            <Globe size={14} className="text-gray-700" />
                        </h3>
                        <div className="space-y-3">
                            {deployments.map((dep) => {
                                const status = statusMap[dep.status] || statusMap['draft'];
                                return (
                                    <div key={dep.distributorId} className="flex items-center justify-between p-3 bg-gray-900/40 rounded-xl border border-gray-800/50 group hover:border-gray-700 transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 bg-gray-900 rounded-lg text-gray-400 group-hover:text-white transition-colors`}>
                                                <Globe size={16} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-200 group-hover:text-white transition-colors">
                                                    {dep.distributorId.charAt(0).toUpperCase() + dep.distributorId.slice(1)}
                                                </p>
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`text-[10px] font-bold uppercase tracking-tight text-${status.color}-500`}>
                                                        {status.label}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                        {dep.liveUrl && (
                                            <a
                                                href={dep.liveUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-all"
                                            >
                                                <ExternalLink size={14} />
                                            </a>
                                        )}
                                        {/* Item 411: Request Takedown action */}
                                        {(dep.status === 'live' || dep.status === 'delivered') && onTakedown && (
                                            <button
                                                onClick={() => onTakedown(dep.distributorId)}
                                                className="p-2 text-gray-600 hover:text-red-400 hover:bg-red-900/10 rounded-lg transition-all"
                                                title="Request takedown"
                                                aria-label={`Request takedown from ${dep.distributorId}`}
                                            >
                                                <AlertTriangle size={12} />
                                            </button>
                                        )}
                                        </div>
                                    </div>
                                );
                            })}
                            {deployments.length === 0 && (
                                <div className="text-center py-8 opacity-40">
                                    <p className="text-xs font-bold uppercase tracking-widest">Not Deployed</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Metadata Detail */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-[#121212] border border-gray-800 rounded-2xl p-8 shadow-xl">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                            <div>
                                <h1 className="text-4xl font-black text-white tracking-tighter mb-2 italic">
                                    {metadata.trackTitle}
                                </h1>
                                <div className="flex items-center gap-4 text-gray-400 font-bold text-sm tracking-tight">
                                    <div className="flex items-center gap-2">
                                        <User size={16} className="text-blue-500" />
                                        {metadata.artistName}
                                    </div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-800" />
                                    <div className="flex items-center gap-2">
                                        <Disc size={16} className="text-purple-500" />
                                        {metadata.labelName || 'Independent'}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 px-4 py-3 bg-gray-900/50 rounded-2xl border border-gray-800">
                                <Calendar size={18} className="text-gray-500" />
                                <div>
                                    <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest leading-none mb-1">Release Date</p>
                                    <p className="text-sm font-bold text-white leading-none">
                                        {metadata.releaseDate ? new Date(metadata.releaseDate).toLocaleDateString() : 'TBD'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                            <div className="space-y-6">
                                <h4 className="text-xs font-black text-gray-600 uppercase tracking-widest border-b border-gray-800 pb-2">Technical Metadata</h4>
                                <div className="space-y-4">
                                    <DetailRow label="ISRC" value={metadata.isrc || 'Pending'} />
                                    <DetailRow label="UPC/EAN" value={metadata.upc || 'Pending'} />
                                    <DetailRow label="Primary Genre" value={metadata.genre} />
                                    <DetailRow label="Sub Genre" value={metadata.subGenre || 'N/A'} />
                                </div>
                            </div>
                            <div className="space-y-6">
                                <h4 className="text-xs font-black text-gray-600 uppercase tracking-widest border-b border-gray-800 pb-2">Rights & Credits</h4>
                                <div className="space-y-4">
                                    <DetailRow label="C Line" value={`© ${new Date().getFullYear()} ${metadata.labelName || metadata.artistName}`} />
                                    <DetailRow label="P Line" value={`℗ ${new Date().getFullYear()} ${metadata.labelName || metadata.artistName}`} />
                                    <DetailRow label="Explicit Content" value={metadata.explicit ? 'Explicit' : 'Clean'} />
                                    <DetailRow label="Language" value={metadata.language || 'English'} />
                                </div>
                            </div>
                        </div>

                        {/* Tracks Section (Simplified for Beta) */}
                        <div className="mt-12">
                            <h4 className="text-xs font-black text-gray-600 uppercase tracking-widest border-b border-gray-800 pb-4 flex items-center justify-between">
                                Tracklist
                                <span className="px-2 py-0.5 bg-gray-900 rounded-md text-[10px] font-bold text-gray-400">1 Track</span>
                            </h4>
                            <div className="mt-4 p-4 bg-gray-900/30 rounded-2xl border border-gray-800/50 flex items-center justify-between group cursor-pointer hover:bg-gray-900/50 transition-all">
                                <div className="flex items-center gap-4">
                                    <span className="text-xs font-black text-gray-700 w-4 tracking-tighter">01</span>
                                    <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                                        <Music size={18} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-200 group-hover:text-white transition-colors">{metadata.trackTitle}</p>
                                        <p className="text-xs font-medium text-gray-600">Original Mix • 4:24</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="hidden md:block">
                                        <div className="flex gap-1 items-center px-2 py-1 bg-green-500/10 border border-green-500/20 rounded-md">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                            <span className="text-[9px] font-black text-green-500 uppercase">Lossless</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

const DetailRow: React.FC<{ label: string; value?: string | boolean }> = ({ label, value }) => (
    <div className="flex items-center justify-between py-1">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-tight">{label}</span>
        <span className="text-sm font-bold text-gray-200 tracking-tight">{value || '—'}</span>
    </div>
);
