import React, { useState, useMemo } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { HistoryItem } from '@/core/types/history';
import {
    ChevronRight, Image as ImageIcon, Video, Music,
    FileText, Search, Eye, Grid3X3, List
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

type AssetFilter = 'all' | 'images' | 'videos' | 'audio' | 'files';
type ViewStyle = 'grid' | 'list';

interface AssetsPanelProps {
    toggleRightPanel: () => void;
}

export default function AssetsPanel({ toggleRightPanel }: AssetsPanelProps) {
    const {
        generatedHistory,
        uploadedImages,
        uploadedAudio,
        fileNodes,
        setSelectedItem,
        setViewMode,
        setModule
    } = useStore(useShallow(state => ({
        generatedHistory: state.generatedHistory,
        uploadedImages: state.uploadedImages,
        uploadedAudio: state.uploadedAudio,
        fileNodes: state.fileNodes,
        setSelectedItem: state.setSelectedItem,
        setViewMode: state.setViewMode,
        setModule: state.setModule
    })));

    const [filter, setFilter] = useState<AssetFilter>('all');
    const [viewStyle, setViewStyle] = useState<ViewStyle>('grid');
    const [searchQuery, setSearchQuery] = useState('');

    // Aggregate all assets into a single sorted list
    const allAssets = useMemo(() => {
        const assets: HistoryItem[] = [];

        // Generated images/videos
        generatedHistory.forEach(item => assets.push(item));

        // Uploaded images (deduplicate)
        uploadedImages.forEach(item => {
            if (!assets.find(a => a.id === item.id)) {
                assets.push(item);
            }
        });

        // Uploaded audio (deduplicate)
        uploadedAudio.forEach(item => {
            if (!assets.find(a => a.id === item.id)) {
                assets.push(item);
            }
        });

        // File nodes → convert to pseudo-HistoryItem for display
        fileNodes.forEach(node => {
            if (!assets.find(a => a.id === node.id)) {
                const mime = node.data?.mimeType || '';
                const nodeType = node.type === 'folder' ? 'text' : (
                    mime.startsWith('image') ? 'image' :
                        mime.startsWith('video') ? 'video' :
                            mime.startsWith('audio') ? 'music' : 'text'
                );
                assets.push({
                    id: node.id,
                    type: nodeType as HistoryItem['type'],
                    url: node.data?.url || '',
                    thumbnailUrl: node.data?.url || '',
                    prompt: node.name,
                    timestamp: node.updatedAt || 0,
                    projectId: node.projectId || '',
                    origin: 'uploaded'
                });
            }
        });

        // Sort newest first
        return assets.sort((a, b) => b.timestamp - a.timestamp);
    }, [generatedHistory, uploadedImages, uploadedAudio, fileNodes]);

    // Filter assets
    const filteredAssets = useMemo(() => {
        let filtered = allAssets;

        switch (filter) {
            case 'images':
                filtered = filtered.filter(a => a.type === 'image');
                break;
            case 'videos':
                filtered = filtered.filter(a => a.type === 'video');
                break;
            case 'audio':
                filtered = filtered.filter(a => a.type === 'music');
                break;
            case 'files':
                filtered = filtered.filter(a => a.type === 'text');
                break;
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(a =>
                a.prompt?.toLowerCase().includes(q) ||
                a.tags?.some(t => t.toLowerCase().includes(q))
            );
        }

        return filtered;
    }, [allAssets, filter, searchQuery]);

    // Counts for filter badges
    const counts = useMemo(() => ({
        all: allAssets.length,
        images: allAssets.filter(a => a.type === 'image').length,
        videos: allAssets.filter(a => a.type === 'video').length,
        audio: allAssets.filter(a => a.type === 'music').length,
        files: allAssets.filter(a => a.type === 'text').length,
    }), [allAssets]);

    const filterButtons: { id: AssetFilter; label: string; icon: React.ElementType; count: number }[] = [
        { id: 'all', label: 'All', icon: Grid3X3, count: counts.all },
        { id: 'images', label: 'Images', icon: ImageIcon, count: counts.images },
        { id: 'videos', label: 'Videos', icon: Video, count: counts.videos },
        { id: 'audio', label: 'Audio', icon: Music, count: counts.audio },
        { id: 'files', label: 'Files', icon: FileText, count: counts.files },
    ];

    const handleAssetClick = (asset: HistoryItem) => {
        if (asset.type === 'image' || asset.type === 'video') {
            setSelectedItem(asset);
            setModule('creative');
            setViewMode('editor');
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'image': return <ImageIcon size={10} />;
            case 'video': return <Video size={10} />;
            case 'music': return <Music size={10} />;
            default: return <FileText size={10} />;
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'image': return 'text-purple-400 bg-purple-500/15';
            case 'video': return 'text-blue-400 bg-blue-500/15';
            case 'music': return 'text-amber-400 bg-amber-500/15';
            default: return 'text-gray-400 bg-white/10';
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#080809]">
            {/* Header */}
            <div className="p-3 border-b border-white/[0.06] flex items-center justify-between bg-[#060608]/80 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-2">
                    <div className="p-1 bg-amber-500/10 rounded-md">
                        <Grid3X3 size={13} className="text-amber-400" />
                    </div>
                    <h3 className="text-xs font-bold text-gray-200 tracking-tight">Project Assets</h3>
                    <span className="text-[9px] font-mono text-gray-600 bg-white/[0.04] px-1.5 py-0.5 rounded">
                        {counts.all}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setViewStyle(viewStyle === 'grid' ? 'list' : 'grid')}
                        className="p-1 text-gray-500 hover:text-gray-300 hover:bg-white/[0.06] rounded transition-colors"
                        title={viewStyle === 'grid' ? 'List view' : 'Grid view'}
                    >
                        {viewStyle === 'grid' ? <List size={13} /> : <Grid3X3 size={13} />}
                    </button>
                    <button
                        onClick={toggleRightPanel}
                        className="p-1 hover:bg-white/[0.06] rounded text-gray-500 hover:text-gray-300 transition-colors"
                        aria-label="Close Panel"
                    >
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="px-3 py-2 border-b border-white/[0.04] shrink-0">
                <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search assets..."
                        className="w-full bg-white/[0.03] border border-white/[0.06] rounded-md pl-8 pr-3 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-white/[0.12] focus:bg-white/[0.05] transition-all"
                    />
                </div>
            </div>

            {/* Filter Bar */}
            <div className="px-3 py-2 flex gap-1 overflow-x-auto no-scrollbar border-b border-white/[0.04] shrink-0">
                {filterButtons.map(({ id, label, icon: Icon, count }) => (
                    <button
                        key={id}
                        onClick={() => setFilter(id)}
                        className={cn(
                            "flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wide transition-all whitespace-nowrap",
                            filter === id
                                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                                : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04] border border-transparent'
                        )}
                    >
                        <Icon size={10} />
                        {label}
                        {count > 0 && (
                            <span className={cn(
                                "text-[8px] font-mono px-1 rounded",
                                filter === id ? 'text-amber-400' : 'text-gray-600'
                            )}>
                                {count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Asset Grid / List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                {filteredAssets.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6">
                        <div className="w-12 h-12 rounded-xl bg-white/[0.03] flex items-center justify-center mb-3">
                            <ImageIcon size={20} className="text-gray-600" />
                        </div>
                        <p className="text-xs font-medium text-gray-400">No assets yet</p>
                        <p className="text-[10px] text-gray-600 mt-1 max-w-[180px]">
                            Generate images, upload files, or record audio to see them here.
                        </p>
                    </div>
                ) : viewStyle === 'grid' ? (
                    <div className="grid grid-cols-3 gap-1.5">
                        <AnimatePresence>
                            {filteredAssets.map((asset) => (
                                <motion.button
                                    key={asset.id}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    onClick={() => handleAssetClick(asset)}
                                    className="group relative aspect-square bg-white/[0.03] rounded-lg overflow-hidden border border-white/[0.06] hover:border-white/[0.15] transition-all cursor-pointer"
                                >
                                    {/* Thumbnail */}
                                    {asset.type === 'video' ? (
                                        <video
                                            src={asset.thumbnailUrl || asset.url}
                                            preload="metadata"
                                            muted
                                            className="w-full h-full object-cover"
                                            onError={(e) => { (e.target as HTMLVideoElement).style.display = 'none'; }}
                                        />
                                    ) : asset.type === 'image' ? (
                                        <img
                                            src={asset.thumbnailUrl || asset.url}
                                            alt={asset.prompt || ''}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />
                                    ) : null}

                                    {/* Fallback icon for non-visual or broken media */}
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none -z-0">
                                        <div className={cn("p-2 rounded-lg", getTypeColor(asset.type))}>
                                            {getTypeIcon(asset.type)}
                                        </div>
                                    </div>

                                    {/* Type badge */}
                                    <div className="absolute top-1 right-1 z-10">
                                        <div className={cn("p-0.5 rounded", getTypeColor(asset.type))}>
                                            {getTypeIcon(asset.type)}
                                        </div>
                                    </div>

                                    {/* Hover overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-end p-1.5">
                                        <p className="text-[9px] text-white/80 line-clamp-2 leading-tight">
                                            {asset.prompt || 'Untitled'}
                                        </p>
                                    </div>
                                </motion.button>
                            ))}
                        </AnimatePresence>
                    </div>
                ) : (
                    <div className="flex flex-col gap-1">
                        <AnimatePresence>
                            {filteredAssets.map((asset) => (
                                <motion.button
                                    key={asset.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    onClick={() => handleAssetClick(asset)}
                                    className="flex items-center gap-2.5 p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-transparent hover:border-white/[0.08] transition-all cursor-pointer group text-left"
                                >
                                    {/* Mini thumbnail */}
                                    <div className="w-10 h-10 rounded-md overflow-hidden bg-white/[0.04] flex-shrink-0 flex items-center justify-center">
                                        {asset.type === 'image' && asset.url ? (
                                            <img src={asset.thumbnailUrl || asset.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                                        ) : (
                                            <div className={cn("p-1.5 rounded", getTypeColor(asset.type))}>
                                                {getTypeIcon(asset.type)}
                                            </div>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] text-gray-300 font-medium truncate">
                                            {asset.prompt || 'Untitled'}
                                        </p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className={cn("text-[8px] font-bold uppercase tracking-wider", getTypeColor(asset.type).split(' ')[0])}>
                                                {asset.type}
                                            </span>
                                            <span className="text-[8px] text-gray-600 font-mono">
                                                {new Date(asset.timestamp).toLocaleDateString()}
                                            </span>
                                            {asset.origin && (
                                                <span className="text-[8px] text-gray-600 capitalize">
                                                    {asset.origin}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action */}
                                    <Eye size={12} className="text-gray-600 group-hover:text-gray-300 transition-colors flex-shrink-0" />
                                </motion.button>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
}
