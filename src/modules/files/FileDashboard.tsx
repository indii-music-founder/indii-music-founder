import React, { useState, useEffect } from 'react';
import { useStore } from '@/core/store';
import { motion, AnimatePresence } from 'framer-motion';
import { Folder, File, Image as ImageIcon, Music, Video, FileText, Search, Plus, Upload, Filter, Grid, List as ListIcon, MoreVertical, Star, Clock, Trash2, Download, ExternalLink, X } from 'lucide-react';
import { FileNode } from '@/services/FileSystemService';
import { cn } from '@/lib/utils';
import FilePreview from './FilePreview';

export default function FileDashboard() {
    const { fileNodes, currentProjectId, selectedFileNodeId, setSelectedFileNode } = useStore();
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<FileNode['fileType'] | 'all'>('all');

    // Filter nodes
    const displayNodes = fileNodes.filter((node: FileNode) => {
        if (!node.parentId) {
            // we'll just show all files in a flat view for the dashboard unless we build a breadcrumb system
            // To make it impressive, let's show everything flat but grouped
        }

        const matchesSearch = node.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = filterType === 'all' || node.fileType === filterType;

        return matchesSearch && matchesFilter && node.type !== 'folder'; // Exclude folders for flat asset view, or keep them?
    });

    const getFileIcon = (type?: FileNode['fileType'], className?: string) => {
        switch (type) {
            case 'image': return <ImageIcon className={className} />;
            case 'audio': return <Music className={className} />;
            case 'video': return <Video className={className} />;
            case 'document': return <FileText className={className} />;
            default: return <File className={className} />;
        }
    };

    const formatBytes = (bytes: number = 0) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    return (
        <div className="flex h-full bg-background overflow-hidden relative">
            {/* Ambient Background Effect */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

            {/* Left Sidebar (Internal Navigation) */}
            <div className="w-64 border-r border-white/5 bg-surface/30 backdrop-blur-xl flex flex-col z-10">
                <div className="p-6">
                    <h1 className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                        ASSETS
                    </h1>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest mt-1">Project Vault</p>
                </div>

                <div className="px-4 pb-4">
                    <button className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20 active:scale-95">
                        <Upload size={16} /> Upload Asset
                    </button>
                </div>

                <nav className="flex-1 overflow-y-auto px-3 space-y-1">
                    <NavItem icon={Clock} label="Recent" active />
                    <NavItem icon={Star} label="Favorites" />

                    <div className="mt-8 mb-2 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Media Types</div>
                    <NavItem icon={ImageIcon} label="Images" count={fileNodes.filter((n: FileNode) => n.fileType === 'image').length} onClick={() => setFilterType('image')} active={filterType === 'image'} />
                    <NavItem icon={Video} label="Video" count={fileNodes.filter((n: FileNode) => n.fileType === 'video').length} onClick={() => setFilterType('video')} active={filterType === 'video'} />
                    <NavItem icon={Music} label="Audio DNA" count={fileNodes.filter((n: FileNode) => n.fileType === 'audio').length} onClick={() => setFilterType('audio')} active={filterType === 'audio'} />
                    <NavItem icon={FileText} label="Documents" count={fileNodes.filter((n: FileNode) => n.fileType === 'document').length} onClick={() => setFilterType('document')} active={filterType === 'document'} />

                    <div className="mt-8 mb-2 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Locations</div>
                    <NavItem icon={Folder} label="All Files" onClick={() => setFilterType('all')} active={filterType === 'all'} />
                    <NavItem icon={Trash2} label="Trash" />
                </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col z-10 min-w-0">
                {/* Top Toolbar */}
                <div className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-surface/20 backdrop-blur-md">
                    <div className="relative w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                        <input
                            type="text"
                            placeholder="Search files, folders, or metadata..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-full pl-10 pr-4 py-2.5 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                        />
                    </div>

                    <div className="flex items-center gap-2 bg-black/20 p-1 rounded-lg border border-white/5">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={cn("p-2 rounded-md transition-colors", viewMode === 'grid' ? "bg-white/10 text-white shadow-sm" : "text-gray-500 hover:text-gray-300")}
                        >
                            <Grid size={16} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={cn("p-2 rounded-md transition-colors", viewMode === 'list' ? "bg-white/10 text-white shadow-sm" : "text-gray-500 hover:text-gray-300")}
                        >
                            <ListIcon size={16} />
                        </button>
                    </div>
                </div>

                {/* File Grid/List */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    {!currentProjectId ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500">
                            <Folder size={48} className="mb-4 opacity-20" />
                            <p>Select a project to view files</p>
                        </div>
                    ) : displayNodes.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500">
                            <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6">
                                <Search size={32} className="opacity-20" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-300 mb-2">No files found</h3>
                            <p className="text-sm">We couldn't find any resources matching your criteria.</p>
                        </div>
                    ) : (
                        <div className={cn(
                            "grid gap-4",
                            viewMode === 'grid' ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" : "grid-cols-1"
                        )}>
                            <AnimatePresence>
                                {displayNodes.map((node: FileNode) => (
                                    <motion.div
                                        layout
                                        key={node.id}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        whileHover={{ y: -4 }}
                                        onClick={() => setSelectedFileNode(node.id)}
                                        className={cn(
                                            "group cursor-pointer rounded-xl border transition-all duration-200 overflow-hidden",
                                            selectedFileNodeId === node.id
                                                ? "bg-blue-900/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                                                : "bg-surface/40 border-white/5 hover:border-white/10 hover:bg-surface/60",
                                            viewMode === 'list' && "flex items-center p-3 gap-4"
                                        )}
                                    >
                                        {/* Thumbnail Area */}
                                        <div className={cn(
                                            "relative bg-black/40 flex items-center justify-center border-white/5",
                                            viewMode === 'grid' ? "aspect-video border-b" : "w-16 h-16 rounded-lg flex-shrink-0"
                                        )}>
                                            {node.fileType === 'image' && node.data?.url ? (
                                                <img src={node.data.url} alt={node.name} className="w-full h-full object-cover" />
                                            ) : (
                                                getFileIcon(node.fileType, cn("opacity-30", viewMode === 'grid' ? "w-12 h-12" : "w-6 h-6"))
                                            )}

                                            {/* Hover Actions */}
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px]">
                                                <button className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors">
                                                    <ExternalLink size={16} />
                                                </button>
                                                <button className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors">
                                                    <Download size={16} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Meta Area */}
                                        <div className={cn(
                                            "flex flex-col justify-center",
                                            viewMode === 'grid' ? "p-4" : "flex-1 min-w-0 py-2"
                                        )}>
                                            <div className="flex items-start justify-between gap-2">
                                                <h4 className="text-sm font-medium text-gray-200 truncate leading-tight flex-1" title={node.name}>
                                                    {node.name}
                                                </h4>
                                                {viewMode === 'grid' && (
                                                    <button className="text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                        <MoreVertical size={14} />
                                                    </button>
                                                )}
                                            </div>

                                            <div className={cn(
                                                "flex items-center text-xs text-gray-500 mt-2 gap-3",
                                                viewMode === 'list' && "mt-1"
                                            )}>
                                                <span className="capitalize">{node.fileType || 'File'}</span>
                                                <span className="w-1 h-1 rounded-full bg-gray-600" />
                                                <span>{formatBytes(node.data?.size)}</span>
                                            </div>
                                        </div>

                                        {viewMode === 'list' && (
                                            <button className="p-2 text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity mr-2">
                                                <MoreVertical size={16} />
                                            </button>
                                        )}
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Context Panel (File Details) */}
            <AnimatePresence>
                {selectedFileNodeId && (
                    <motion.div
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 320, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        className="bg-surface/40 border-l border-white/5 backdrop-blur-xl z-20 flex flex-col"
                    >
                        <div className="p-4 border-b border-white/5 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-gray-200">File Details</h3>
                            <button onClick={() => setSelectedFileNode(null)} className="p-1 hover:bg-white/10 rounded-md text-gray-400 transition-colors">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {/* Re-use the existing high-quality FilePreview but in compact mode */}
                            <div className="h-64 bg-black/20 border-b border-white/5 p-4">
                                <FilePreview variant="compact" />
                            </div>

                            <div className="p-6 space-y-6">
                                <div>
                                    <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Properties</h4>
                                    <div className="space-y-3">
                                        <DetailRow label="ID" value={selectedFileNodeId.slice(0, 8) + '...'} />
                                        <DetailRow label="Type" value={fileNodes.find((n: FileNode) => n.id === selectedFileNodeId)?.fileType || 'Unknown'} className="capitalize" />
                                        <DetailRow label="Size" value={formatBytes(fileNodes.find((n: FileNode) => n.id === selectedFileNodeId)?.data?.size)} />
                                        <DetailRow label="Created" value="Today" />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Actions</h4>
                                    <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-sm text-gray-300 transition-colors">
                                        <ExternalLink size={14} className="text-gray-500" /> Open in Studio
                                    </button>
                                    <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-sm text-gray-300 transition-colors">
                                        <Download size={14} className="text-gray-500" /> Download File
                                    </button>
                                    <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-500/10 text-sm text-red-400 transition-colors">
                                        <Trash2 size={14} className="text-red-500" /> Delete File
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

function NavItem({ icon: Icon, label, count, active, onClick }: { icon: React.ElementType, label: string, count?: number, active?: boolean, onClick?: () => void }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all text-sm",
                active
                    ? "bg-blue-500/10 text-blue-400 font-medium"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
            )}
        >
            <div className="flex items-center gap-3">
                <Icon size={16} />
                <span>{label}</span>
            </div>
            {count !== undefined && (
                <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full",
                    active ? "bg-blue-500/20 text-blue-300" : "bg-white/5 text-gray-500"
                )}>
                    {count}
                </span>
            )}
        </button>
    );
}

function DetailRow({ label, value, className }: { label: string, value: string, className?: string }) {
    return (
        <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">{label}</span>
            <span className={cn("text-gray-200 font-medium", className)}>{value}</span>
        </div>
    );
}
