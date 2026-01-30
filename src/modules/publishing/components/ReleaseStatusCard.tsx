import React from 'react';
import { motion } from 'framer-motion';
import { Music, Edit2, Trash2, CheckSquare, ExternalLink, Globe, Clock, AlertCircle } from 'lucide-react';
import { DDEXReleaseRecord } from '@/services/metadata/types';

interface ReleaseStatusCardProps {
    release: DDEXReleaseRecord;
    isSelected: boolean;
    onToggleSelection: (id: string) => void;
    onDelete: (id: string) => void;
}

export const ReleaseStatusCard: React.FC<ReleaseStatusCardProps> = ({
    release,
    isSelected,
    onToggleSelection,
    onDelete
}) => {
    // Determine status color and label
    const statusMap: Record<string, { color: string; text: string }> = {
        live: { color: 'bg-green-500', text: 'Live' },
        pending_review: { color: 'bg-yellow-500', text: 'Pending' },
        draft: { color: 'bg-gray-500', text: 'Draft' },
        metadata_complete: { color: 'bg-blue-500', text: 'Processing' },
        assets_uploaded: { color: 'bg-blue-500', text: 'Processing' },
        validating: { color: 'bg-blue-500', text: 'Validating' },
        delivering: { color: 'bg-blue-500', text: 'Delivering' }
    };

    const statusInfo = statusMap[release.status] || { color: 'bg-gray-600', text: release.status };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className={`group relative flex items-center justify-between p-4 rounded-xl border transition-all duration-200 cursor-pointer ${isSelected
                ? 'bg-blue-500/5 border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.05)]'
                : 'bg-[#121212] hover:bg-[#161616] border-gray-800/50 hover:border-gray-700 shadow-lg'
                }`}
            onClick={() => onToggleSelection(release.id)}
        >
            <div className="flex items-center gap-4">
                {/* Selection Checkbox */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelection(release.id);
                    }}
                    className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${isSelected
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'border-gray-700 hover:border-gray-500 text-transparent'
                        }`}
                >
                    <CheckSquare size={12} fill="currentColor" />
                </button>

                <div className="relative w-14 h-14 bg-gray-800 rounded-lg overflow-hidden flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-300">
                    {release.assets.coverArtUrl ? (
                        <img src={release.assets.coverArtUrl} alt={release.metadata.trackTitle} className="w-full h-full object-cover" />
                    ) : (
                        <Music size={20} className="text-gray-600" />
                    )}
                    {/* Tiny status overlay for mobile-ish feel */}
                    <div className={`absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full border-2 border-gray-800 ${statusInfo.color}`} />
                </div>

                <div className="flex flex-col">
                    <h4 className="font-bold text-base text-white group-hover:text-blue-400 transition-colors mb-0.5 max-w-[200px] sm:max-w-none truncate">
                        {release.metadata.trackTitle}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-gray-500 font-medium font-mono lowercase">
                        <span>{release.metadata.artistName}</span>
                        <span className="w-0.5 h-0.5 rounded-full bg-gray-600" />
                        <span>{release.metadata.releaseType}</span>
                    </div>
                </div>
            </div>

            {/* DDEX / DSP Delivery Mini Badges */}
            <div className="hidden lg:flex items-center gap-2 mr-Auto">
                {/* Mocking DSP indicators based on typical DDEX scenarios */}
                <div className="flex -space-x-1.5 overflow-hidden">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-white/5 flex items-center justify-center">
                        <span className="text-[8px] text-emerald-400 font-bold uppercase italic">S</span>
                    </div>
                    <div className="w-6 h-6 rounded-full bg-blue-500/10 border border-white/5 flex items-center justify-center">
                        <span className="text-[8px] text-blue-400 font-bold uppercase italic">A</span>
                    </div>
                    <div className="w-6 h-6 rounded-full bg-red-500/10 border border-white/5 flex items-center justify-center">
                        <span className="text-[8px] text-red-400 font-bold uppercase italic">Y</span>
                    </div>
                </div>
                <div className="h-4 w-px bg-gray-800/50 mx-1" />
                <div className="flex items-center gap-1.5 text-[10px] text-gray-400 uppercase tracking-widest font-bold bg-gray-900/50 px-2 py-0.5 rounded border border-gray-800">
                    <Globe size={10} /> {release.metadata.genre || 'GENRE'}
                </div>
            </div>

            <div className="flex items-center gap-6">
                <div className="text-right hidden sm:block">
                    <div className="flex items-center justify-end gap-1.5 px-2.5 py-1 bg-gray-900 rounded border border-gray-800/80 group-hover:border-gray-700 transition-colors">
                        <div className={`w-1.5 h-1.5 rounded-full ${statusInfo.color} animate-pulse`} />
                        <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">
                            {statusInfo.text}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <button className="p-2 text-gray-600 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
                        <Edit2 size={16} />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(release.id);
                        }}
                        className="p-2 text-gray-600 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <Trash2 size={16} />
                    </button>
                    <button
                        className="p-2 text-gray-600 hover:text-blue-400 hover:bg-gray-800 rounded-lg transition-colors"
                        onClick={(e) => {
                            e.stopPropagation();
                            // Logic to open DDEX preview/link
                        }}
                    >
                        <ExternalLink size={16} />
                    </button>
                </div>
            </div>

            {/* Status Tooltip / Detail Reveal (Placeholder for logic) */}
            <div className="absolute inset-0 bg-white/[0.01] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
        </motion.div>
    );
};
