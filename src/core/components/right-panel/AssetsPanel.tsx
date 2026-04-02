import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { motion, AnimatePresence } from 'motion/react';
import { StorageService } from '@/services/StorageService';
import { processForKnowledgeBase } from '@/services/rag/ragService';
import { logger } from '@/utils/logger';
import { useToast } from '@/core/context/ToastContext';
import {
    ChevronRight, Folder, Image as ImageIcon, Film, Music, FileText,
    Sparkles, Clock, Upload, Trash2, Maximize2, Download, Search, X, MessageCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ActionableEmptyState } from '@/components/shared/ActionableEmptyState';

type AssetType = 'image' | 'video' | 'audio' | 'document';

interface UnifiedAsset {
    id: string; // prefixed composite ID
    type: AssetType;
    url: string;
    thumbnailUrl?: string;
    name: string;
    timestamp: number;
    source: 'generated' | 'uploaded' | 'file';
    originalId: string;
}

const BADGE: Record<AssetType, { icon: React.ElementType; label: string; cls: string }> = {
    image: { icon: ImageIcon, label: 'Image', cls: 'text-blue-400 bg-blue-500/15' },
    video: { icon: Film, label: 'Video', cls: 'text-purple-400 bg-purple-500/15' },
    audio: { icon: Music, label: 'Audio', cls: 'text-amber-400 bg-amber-500/15' },
    document: { icon: FileText, label: 'Doc', cls: 'text-emerald-400 bg-emerald-500/15' },
};

function relTime(ts: number) {
    if (!ts) return '';
    const d = Date.now() - ts;
    const m = Math.floor(d / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function AssetsPanel({ toggleRightPanel }: { toggleRightPanel: () => void }) {
    const toast = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [activeFilter, setActiveFilter] = useState<'all' | AssetType>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [selIdx, setSelIdx] = useState<number | null>(null);

    const {
        currentProjectId,
        userProfile,
        generatedHistory,
        uploadedImages,
        uploadedAudio,
        fileNodes,
        removeFromHistory,
        removeUploadedImage,
        removeUploadedAudio,
        deleteNode,
        fetchFileNodes,
        createFileNode,
        setSelectedItem,
        setModule,
        toggleAgentWindow,
        isAgentOpen
    } = useStore(useShallow(state => ({
        currentProjectId: state.currentProjectId,
        userProfile: state.userProfile,
        generatedHistory: state.generatedHistory,
        uploadedImages: state.uploadedImages,
        uploadedAudio: state.uploadedAudio,
        fileNodes: state.fileNodes,
        removeFromHistory: state.removeFromHistory,
        removeUploadedImage: state.removeUploadedImage,
        removeUploadedAudio: state.removeUploadedAudio,
        deleteNode: state.deleteNode,
        fetchFileNodes: state.fetchFileNodes,
        createFileNode: state.createFileNode,
        setSelectedItem: state.setSelectedItem,
        setModule: state.setModule,
        toggleAgentWindow: state.toggleAgentWindow,
        isAgentOpen: state.isAgentOpen
    })));

    useEffect(() => {
        if (currentProjectId) {
            fetchFileNodes(currentProjectId);
        }
    }, [currentProjectId, fetchFileNodes]);

    const allItems: UnifiedAsset[] = useMemo(() => {
        const items: UnifiedAsset[] = [];

        const historySource = [...(generatedHistory || []), ...(uploadedImages || []), ...(uploadedAudio || [])];
        historySource.forEach(h => {
            if (h.projectId !== currentProjectId) return;
            items.push({
                id: `hist-${h.id}`,
                type: h.type === 'music' ? 'audio' : (h.type as AssetType),
                url: h.url,
                thumbnailUrl: h.thumbnailUrl,
                name: h.prompt || 'Untitled',
                timestamp: h.timestamp,
                source: h.origin === 'uploaded' ? 'uploaded' : 'generated',
                originalId: h.id
            });
        });

        fileNodes.forEach(f => {
            if (f.type === 'folder') return;
            items.push({
                id: `file-${f.id}`,
                type: f.fileType as AssetType,
                url: f.data?.url || '',
                name: f.name,
                timestamp: f.createdAt,
                source: 'file',
                originalId: f.id
            });
        });

        return items.sort((a, b) => b.timestamp - a.timestamp);
    }, [generatedHistory, uploadedImages, uploadedAudio, fileNodes, currentProjectId]);

    const filteredItems = useMemo(() => {
        let items = allItems;
        if (activeFilter !== 'all') {
            items = items.filter(img => img.type === activeFilter);
        }
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            items = items.filter(img => img.name.toLowerCase().includes(q));
        }
        return items;
    }, [allItems, activeFilter, searchQuery]);

    const getFileTypeFromMime = useCallback((mime: string): 'image' | 'video' | 'audio' | 'document' => {
        if (mime.startsWith('image/')) return 'image';
        if (mime.startsWith('video/')) return 'video';
        if (mime.startsWith('audio/')) return 'audio';
        return 'document';
    }, []);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !currentProjectId || !userProfile?.id) return;

        let uploadedCount = 0;
        const toastId = toast.loading(`Uploading ${files.length} asset(s)...`);

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i]!;
                const fileType = getFileTypeFromMime(file.type);
                const timestamp = Date.now();
                const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
                const storagePath = `projects/${currentProjectId}/${userProfile.id}/${timestamp}_${sanitizedName}`;

                try {
                    const downloadUrl = await StorageService.uploadFile(file, storagePath);

                    processForKnowledgeBase(file, file.name, {
                        projectId: currentProjectId,
                        type: file.type,
                        size: file.size.toString()
                    }).then(() => {
                        toast.success(`Indexed ${file.name} for AI search`);
                    }).catch(err => {
                        logger.error("Indexing failed for", file.name, err);
                    });

                    await createFileNode(
                        file.name,
                        null,
                        currentProjectId,
                        userProfile.id,
                        fileType,
                        {
                            url: downloadUrl,
                            storagePath,
                            size: file.size,
                            mimeType: file.type
                        }
                    );
                    uploadedCount++;
                } catch (error: any) {
                    logger.error(`Failed to upload ${file.name}:`, error);
                    toast.error(`Failed: ${file.name}`);
                }
            }

            if (uploadedCount > 0) {
                toast.success(`Successfully uploaded ${uploadedCount} asset(s)`);
            }
        } finally {
            toast.dismiss(toastId);
            if (e.target) e.target.value = '';
        }
    };

    const handleDelete = async (asset: UnifiedAsset) => {
        if (asset.source === 'file') {
            await deleteNode(asset.originalId);
            toast.success('Asset deleted');
        } else if (asset.source === 'uploaded') {
            if (asset.type === 'audio') removeUploadedAudio(asset.originalId);
            else removeUploadedImage(asset.originalId);
            toast.success('Asset removed');
        } else {
            removeFromHistory(asset.originalId);
            toast.success('Creation removed from history');
        }
        setSelIdx(null);
    };

    const openInStudio = (asset: UnifiedAsset) => {
        // If it's a history item, we can set it so Studio picks it up
        if (asset.source !== 'file') {
            const rawItem = [...(generatedHistory || []), ...(uploadedImages || []), ...(uploadedAudio || [])]
                .find(h => h.id === asset.originalId);
            if (rawItem) setSelectedItem(rawItem);
        }

        if (asset.type === 'video') setModule('video');
        else if (asset.type === 'image') setModule('creative');
        else toast.info('Preview only supported for images and videos currently');
    };

    const handleDiscuss = (asset: UnifiedAsset) => {
        useStore.setState({
            commandBarInput: `Let's discuss this ${asset.type}: "${asset.name}"`,
        });
        useStore.setState({ rightPanelTab: 'agent', isRightPanelOpen: true });
        if (!isAgentOpen) toggleAgentWindow();
    };

    const sel = selIdx !== null ? filteredItems[selIdx] : null;

    return (
        <div className="flex flex-col h-full bg-card relative">
            <div className="absolute top-2 right-2 z-10">
                <button onClick={toggleRightPanel} className="p-1 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors" aria-label="Close Panel">
                    <ChevronRight size={16} />
                </button>
            </div>

            {/* Header & Filters */}
            <div className="p-4 pb-2 border-b border-white/5 bg-black/20 shrink-0">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold flex items-center gap-2">
                        <Folder size={16} className="text-blue-400" />
                        Project Assets
                    </h2>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg transition-colors"
                        title="Upload new assets"
                    >
                        <Upload size={12} />
                        Upload
                    </button>
                </div>

                {isSearching ? (
                    <div className="flex items-center gap-2 mb-3">
                        <div className="relative flex-1">
                            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search assets..."
                                className="w-full bg-black/30 border border-white/10 rounded-md py-1.5 pl-7 pr-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-white/20 transition-all"
                                autoFocus
                            />
                        </div>
                        <button onClick={() => { setIsSearching(false); setSearchQuery(''); }} className="p-1.5 text-gray-500 hover:text-gray-300">
                            <X size={14} />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex flex-wrap gap-1 text-[10px] font-medium">
                            {(['all', 'image', 'video', 'audio', 'document'] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => { setActiveFilter(f); setSelIdx(null); }}
                                    className={cn(
                                        "px-2.5 py-1 rounded-md transition-colors capitalize",
                                        activeFilter === f
                                            ? "bg-white text-black"
                                            : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200"
                                    )}
                                >
                                    {f === 'document' ? 'Docs' : f}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setIsSearching(true)} className="p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-white/5">
                            <Search size={12} />
                        </button>
                    </div>
                )}
            </div>

            {/* Hidden Input */}
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileUpload}
                multiple
            />

            {/* Grid Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 relative">
                {filteredItems.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500">
                        <Folder size={32} className="opacity-20 mb-3" />
                        <p className="text-sm font-medium text-gray-400">No assets found</p>
                        <p className="text-xs mt-1 text-gray-500">Upload files or generate media to fill your project.</p>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="mt-4 px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-xs font-medium rounded-lg transition-colors border border-white/10"
                        >
                            Upload Files
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-2">
                        {filteredItems.map((asset, i) => {
                            const badge = BADGE[asset.type] || BADGE['document'];
                            const BadgeIcon = badge.icon;
                            const isSelected = selIdx === i;

                            return (
                                <motion.button
                                    key={asset.id}
                                    onClick={() => setSelIdx(isSelected ? null : i)}
                                    className={cn(
                                        "rounded-lg overflow-hidden border transition-all text-left flex flex-col relative",
                                        isSelected
                                            ? "border-blue-500/50 ring-1 ring-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                                            : "border-white/5 hover:border-white/15"
                                    )}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: Math.min(i * 0.02, 0.2) }}
                                >
                                    <div className="aspect-square bg-[#0d1117] relative overflow-hidden w-full flex items-center justify-center group">
                                        {asset.type === 'video' ? (
                                            <video src={asset.url} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" muted loop playsInline onMouseEnter={e => e.currentTarget.play().catch(() => { })} onMouseLeave={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }} />
                                        ) : asset.type === 'image' ? (
                                            <img src={asset.thumbnailUrl || asset.url} alt={asset.name} loading="lazy" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                                        ) : (
                                            <BadgeIcon size={28} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
                                        )}

                                        <div className={cn("absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium backdrop-blur-md border border-white/5", badge.cls)}>
                                            <BadgeIcon size={10} />
                                        </div>
                                    </div>

                                    <div className="p-2 bg-[#161b22] border-t border-white/5 w-full">
                                        <p className="text-[10px] text-gray-300 font-medium line-clamp-1 mb-0.5" title={asset.name}>
                                            {asset.name}
                                        </p>
                                        <div className="flex items-center gap-1 text-[8px] text-gray-500">
                                            <Clock size={8} />
                                            {relTime(asset.timestamp)}
                                        </div>
                                    </div>
                                </motion.button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Detail Overlay */}
            <AnimatePresence>
                {sel && (
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="absolute bottom-0 left-0 right-0 bg-[#0d1117] border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-20 max-h-[70%] flex flex-col"
                    >
                        <div className="p-3 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                            <h3 className="text-xs font-bold text-gray-200 line-clamp-1 pr-4">{sel.name}</h3>
                            <button onClick={() => setSelIdx(null)} className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors shrink-0">
                                <X size={14} />
                            </button>
                        </div>

                        <div className="p-4 overflow-y-auto custom-scrollbar">
                            <div className="w-full aspect-video rounded-lg overflow-hidden bg-black/50 border border-white/5 mb-4 relative flex items-center justify-center">
                                {sel.type === 'video' ? (
                                    <video src={sel.url} className="w-full h-full object-contain" controls playsInline />
                                ) : sel.type === 'image' ? (
                                    <img src={sel.url} alt="" className="w-full h-full object-contain" />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center">
                                        {React.createElement(BADGE[sel.type]?.icon || ImageIcon, { size: 32, className: 'text-gray-500 mb-2' })}
                                        <span className="text-xs text-gray-500 font-mono tracking-wider">{sel.type.toUpperCase()}</span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3">
                                <div className="flex flex-wrap gap-2 text-[10px] text-gray-400 bg-white/5 p-2 rounded-md border border-white/5">
                                    <span className="flex items-center gap-1"><Clock size={10} /> Added {new Date(sel.timestamp).toLocaleString()}</span>
                                    <span className="flex items-center gap-1"><Folder size={10} /> Source: <span className="capitalize text-gray-300">{sel.source}</span></span>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => openInStudio(sel)}
                                        className="flex items-center justify-center gap-1.5 p-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-medium transition-colors border border-white/5"
                                    >
                                        <Maximize2 size={12} /> View in Studio
                                    </button>
                                    <button
                                        onClick={() => handleDiscuss(sel)}
                                        className="flex items-center justify-center gap-1.5 p-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg text-xs font-medium transition-colors border border-purple-500/20"
                                    >
                                        <MessageCircle size={12} /> Discuss
                                    </button>
                                    <button
                                        onClick={() => {
                                            const a = document.createElement('a');
                                            a.href = sel.url;
                                            a.download = sel.name;
                                            a.click();
                                        }}
                                        className="flex items-center justify-center gap-1.5 p-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-medium transition-colors border border-white/5"
                                    >
                                        <Download size={12} /> Download
                                    </button>
                                    <button
                                        onClick={() => handleDelete(sel)}
                                        className="flex items-center justify-center gap-1.5 p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-medium transition-colors border border-red-500/20"
                                    >
                                        <Trash2 size={12} /> Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
