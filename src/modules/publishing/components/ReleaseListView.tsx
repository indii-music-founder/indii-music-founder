import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, Filter, Plus, MoreHorizontal,
    Circle, CheckCircle2, AlertCircle, Clock,
    LayoutGrid, List as ListIcon, Trash2, Archive, ExternalLink
} from 'lucide-react';
import { ReleaseStatusCard } from './ReleaseStatusCard';
import { useReleaseList } from '../hooks/useReleaseList';
import { type DDEXReleaseRecord } from '../hooks/useReleases';

interface ReleaseListViewProps {
    onNewRelease: () => void;
    onReleaseClick?: (id: string) => void;
}

export const ReleaseListView: React.FC<ReleaseListViewProps> = ({ onNewRelease, onReleaseClick }) => {
    const {
        releases,
        loading,
        searchQuery,
        setSearchQuery,
        statusFilter,
        setStatusFilter,
        deleteRelease,
        archiveRelease
    } = useReleaseList();

    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const toggleSelection = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleBulkDelete = async () => {
        if (confirm(`Are you sure you want to delete ${selectedIds.length} releases?`)) {
            await Promise.all(selectedIds.map(id => deleteRelease(id)));
            setSelectedIds([]);
        }
    };

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input
                            type="text"
                            placeholder="Search by title, artist, or ISRC..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-900/50 border border-gray-800 rounded-xl text-sm text-white placeholder-gray-600 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all"
                        />
                    </div>

                    <div className="flex items-center bg-gray-900/50 border border-gray-800 rounded-xl p-1">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            <LayoutGrid size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            <ListIcon size={18} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-gray-900/50 border border-gray-800 rounded-xl px-4 py-2 text-sm text-gray-300 outline-none focus:border-blue-500/50 transition-all font-bold uppercase tracking-widest text-[10px]"
                    >
                        <option value="all">All Statuses</option>
                        <option value="live">Live</option>
                        <option value="processing">Processing</option>
                        <option value="failed">Failed</option>
                        <option value="draft">Draft</option>
                    </select>

                    <button
                        onClick={onNewRelease}
                        className="flex items-center gap-2 px-6 py-2 bg-white text-black rounded-xl font-bold text-sm hover:bg-gray-200 transition-all active:scale-[0.98]"
                    >
                        <Plus size={18} strokeWidth={3} />
                        New Release
                    </button>
                </div>
            </div>

            {/* Selection Actions */}
            <AnimatePresence>
                {selectedIds.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="flex items-center justify-between p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl"
                    >
                        <span className="text-sm font-bold text-blue-400">
                            {selectedIds.length} item{selectedIds.length > 1 ? 's' : ''} selected
                        </span>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleBulkDelete}
                                className="flex items-center gap-2 px-4 py-1.5 bg-red-500/20 text-red-500 rounded-lg text-xs font-bold hover:bg-red-500/30 transition-colors"
                            >
                                <Trash2 size={14} /> Delete
                            </button>
                            <button className="flex items-center gap-2 px-4 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-xs font-bold hover:bg-gray-700 transition-colors">
                                <Archive size={14} /> Archive
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* List/Grid Container */}
            <div className="min-h-[400px]">
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-[180px] bg-gray-900/40 rounded-2xl animate-pulse border border-gray-800/50" />
                        ))}
                    </div>
                ) : releases.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-gray-900/20 rounded-3xl border border-dashed border-gray-800">
                        <div className="w-20 h-20 bg-gray-900 rounded-3xl flex items-center justify-center mb-6">
                            <Plus size={32} className="text-gray-700" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">No Releases Found</h3>
                        <p className="text-gray-500 text-sm max-w-xs text-center mb-8">
                            {searchQuery ? `No results for "${searchQuery}". Try a different term or filter.` : "You haven't uploaded any music yet. Start by creating your first release."}
                        </p>
                        <button
                            onClick={onNewRelease}
                            className="bg-gray-800 text-white px-8 py-3 rounded-2xl font-bold hover:bg-gray-700 transition-all border border-gray-700"
                        >
                            Create Release
                        </button>
                    </div>
                ) : viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {releases.map((release) => (
                            <ReleaseStatusCard
                                key={release.id}
                                release={release}
                                isSelected={selectedIds.includes(release.id)}
                                onToggleSelection={() => toggleSelection(release.id)}
                                onOpenDetail={onReleaseClick}
                                onDelete={() => deleteRelease(release.id)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="bg-gray-900/20 border border-gray-800 rounded-2xl overflow-hidden overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-[#0A0A0A] border-b border-gray-800">
                                <tr>
                                    <th className="px-6 py-4">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.length === releases.length}
                                            onChange={(e) => setSelectedIds(e.target.checked ? releases.map(r => r.id) : [])}
                                            className="rounded border-gray-800 bg-gray-900"
                                        />
                                    </th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Metadata</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Type</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Status</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">ISRC</th>
                                    <th className="px-6 py-4 text-right"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/50">
                                {releases.map((release) => (
                                    <tr
                                        key={release.id}
                                        onClick={() => onReleaseClick?.(release.id)}
                                        className={`group hover:bg-white/[0.02] transition-colors cursor-pointer ${selectedIds.includes(release.id) ? 'bg-blue-500/5' : ''}`}
                                    >
                                        <td className="px-6 py-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(release.id)}
                                                onChange={() => {
                                                    toggleSelection(release.id);
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                                className="rounded border-gray-800 bg-gray-900"
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-lg bg-gray-800 overflow-hidden flex-shrink-0">
                                                    {release.assets?.coverArtUrl && (
                                                        <img src={release.assets.coverArtUrl} alt="" className="w-full h-full object-cover" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-white text-sm tracking-tight">{release.metadata.trackTitle}</p>
                                                    <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">{release.metadata.artistName}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-gray-800/50 px-2 py-0.5 rounded-full">
                                                {release.metadata.releaseType || 'Single'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${release.status === 'live' ? 'bg-green-500' : 'bg-yellow-500 animation-pulse'}`} />
                                                <span className="text-xs font-bold text-white capitalize">{release.status}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-[10px] text-gray-500">
                                            {release.metadata.isrc || 'PENDING'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button className="p-2 text-gray-400 hover:text-white rounded-lg transition-colors">
                                                    <ExternalLink size={16} />
                                                </button>
                                                <button onClick={() => deleteRelease(release.id)} className="p-2 text-gray-400 hover:text-red-400 rounded-lg transition-colors">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
