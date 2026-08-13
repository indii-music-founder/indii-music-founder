import React, { useCallback, useEffect, useState } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { motion, AnimatePresence } from 'motion/react';
import {
    Folder,
    File,
    Image as ImageIcon,
    Music,
    Video,
    FileText,
    Search,
    Grid,
    List as ListIcon,
    Star,
    Clock,
    Trash2,
    Download,
    X,
    RotateCcw,
    ShieldAlert,
    Bot,
    User as UserIcon,
    HardDrive,
    CheckSquare,
    Square,
} from 'lucide-react';
import { FileNode } from '@/services/FileSystemService';
import { desktopFileIndexService } from '@/services/agent/DesktopFileIndexService';
import { cn } from '@/lib/utils';
import FilePreview from './FilePreview';
import { NavItem } from './components/NavItem';
import { DetailRow } from './components/DetailRow';
import { FileTree } from './components/FileTree';
import { normalizeExternalHttpUrl } from '@/utils/safeExternalUrl';
import { trashService } from '@/services/trash/TrashService';
import { TrashItem, TrashResourceType } from '@indii/shared';
import { auth } from '@/services/firebase';
import {
    EmailAuthProvider,
    GoogleAuthProvider,
    reauthenticateWithCredential,
    reauthenticateWithPopup,
} from 'firebase/auth';

type TrashSourceFilter = 'all' | 'user' | 'agent';

export default function FileDashboard() {
    const { fileNodes, currentProjectId, selectedFileNodeId, setSelectedFileNode, fetchFileNodes } = useStore(
        useShallow(state => ({
            fileNodes: state.fileNodes,
            currentProjectId: state.currentProjectId,
            selectedFileNodeId: state.selectedFileNodeId,
            setSelectedFileNode: state.setSelectedFileNode,
            fetchFileNodes: state.fetchFileNodes,
        }))
    );

    const [activeTab, setActiveTab] = useState<'active' | 'trash'>('active');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<TrashResourceType | 'all'>('all');
    const [sourceFilter, setSourceFilter] = useState<TrashSourceFilter>('all');

    // Trash state
    const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
    const [selectedTrashIds, setSelectedTrashIds] = useState<string[]>([]);
    const [isLoadingTrash, setIsLoadingTrash] = useState(false);

    // Purge Modal state
    const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
    const [purgeConfirmationText, setTypedConfirmationText] = useState('');
    const [purgePassword, setPurgePassword] = useState('');
    const [purgeStatusMessage, setPurgeStatusMessage] = useState<string | null>(null);
    const [isPurging, setIsPurging] = useState(false);

    useEffect(() => {
        setSelectedFileNode(null);
        if (currentProjectId) {
            void fetchFileNodes(currentProjectId);
        }
    }, [currentProjectId, fetchFileNodes, setSelectedFileNode]);

    const loadTrashItems = useCallback(async () => {
        setIsLoadingTrash(true);
        try {
            const items = await trashService.listTrash({
                type: filterType === 'all' ? undefined : filterType,
                projectId: currentProjectId || undefined,
            });
            setTrashItems(items);
        } catch (err) {
            console.error('[FileDashboard] Failed to load trash items:', err);
        } finally {
            setIsLoadingTrash(false);
        }
    }, [currentProjectId, filterType]);

    useEffect(() => {
        if (activeTab === 'trash') {
            void loadTrashItems();
        }
    }, [activeTab, loadTrashItems]);

    // Filter active nodes
    const displayActiveNodes = fileNodes.filter((node: FileNode) => {
        if (node.isTrashed) return false;
        const matchesSearch = node.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = filterType === 'all' || (node.fileType as string) === filterType;
        return matchesSearch && matchesFilter;
    });

    // Filter trash items
    const displayTrashItems = trashItems.filter((item: TrashItem) => {
        const matchesSearch =
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.originalLocation.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesSource =
            sourceFilter === 'all' ||
            (sourceFilter === 'user' && item.provenance.actor === 'user') ||
            (sourceFilter === 'agent' && item.provenance.actor === 'agent');
        return matchesSearch && matchesSource;
    });

    const getFileIcon = (type?: string, className?: string) => {
        switch (type) {
            case 'image':
            case 'brand_assets':
                return <ImageIcon className={className} />;
            case 'audio':
                return <Music className={className} />;
            case 'video':
                return <Video className={className} />;
            case 'document':
            case 'knowledge_docs':
                return <FileText className={className} />;
            default:
                return <File className={className} />;
        }
    };

    const downloadFileUrl = (url?: string, name?: string) => {
        const safeUrl = normalizeExternalHttpUrl(url);
        if (!safeUrl) return;
        const a = document.createElement('a');
        a.href = safeUrl;
        a.download = name || 'file';
        a.rel = 'noopener';
        a.click();
    };

    const formatBytes = (bytes: number = 0) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const handleMoveNodeToTrash = async (nodeId: string, nodeName: string) => {
        const { ConfirmDialog } = await import('@/components/ui/ConfirmDialog');
        const ok = await ConfirmDialog.call({
            title: 'Move to Trash?',
            message: `"${nodeName}" will be moved to Trash. You can restore it anytime.`,
            confirmText: 'Move to Trash',
            cancelText: 'Cancel',
            variant: 'destructive',
        });

        if (ok) {
            await trashService.moveToTrash(
                { type: 'file_nodes', targetId: nodeId },
                { actor: 'user', reason: 'Moved to trash from Files Dashboard' },
                currentProjectId || undefined
            );
            setSelectedFileNode(null);
        }
    };

    const handleRestoreItem = async (item: TrashItem) => {
        try {
            await trashService.restoreFromTrash(item.id);
            await loadTrashItems();
            setSelectedTrashIds(prev => prev.filter(id => id !== item.id));
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            const { AlertDialog } = await import('@/components/ui/AlertDialog');
            await AlertDialog.call({
                title: 'Restore Conflict',
                message: `Failed to restore '${item.name}': ${message}`,
            });
        }
    };

    const handleBatchRestore = async () => {
        if (selectedTrashIds.length === 0) return;
        for (const id of selectedTrashIds) {
            try {
                await trashService.restoreFromTrash(id);
            } catch (err) {
                console.error(`Failed to restore ${id}:`, err);
            }
        }
        await loadTrashItems();
        setSelectedTrashIds([]);
    };

    const handleExecutePurge = async () => {
        if (purgeConfirmationText !== 'DELETE') return;
        setIsPurging(true);
        setPurgeStatusMessage(null);

        const targetItems = trashItems.filter(item => selectedTrashIds.includes(item.id));
        const cloudItems = targetItems.filter(item => item.type !== 'local_files');
        const localItems = targetItems.filter(item => item.type === 'local_files');

        let cloudPurgedCount = 0;
        let localPurgedCount = 0;
        const errors: string[] = [];

        try {
            const user = auth.currentUser;
            if (!user) throw new Error('Sign in before permanently deleting Trash items.');
            const providerIds = new Set(user.providerData.map(provider => provider.providerId));
            if (providerIds.has('password')) {
                if (!user.email || !purgePassword) throw new Error('Enter your password to reauthenticate.');
                await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, purgePassword));
            } else if (providerIds.has('google.com')) {
                await reauthenticateWithPopup(user, new GoogleAuthProvider());
            } else {
                throw new Error('This account must add a supported sign-in method before permanent deletion.');
            }
            await user.getIdToken(true);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            setIsPurging(false);
            setPurgeStatusMessage(`Reauthentication failed: ${message}`);
            return;
        }

        // 1. Permanently remove local payloads only after the native main-process dialog.
        const confirmedLocalIds: string[] = [];
        if (localItems.length > 0) {
            for (const localItem of localItems) {
                try {
                    const folderId = localItem.restoreData.folderId as string;
                    if (!folderId) continue;
                    const resLocal = await desktopFileIndexService.purgeFromTrash(folderId, localItem.id);
                    if (resLocal?.success) {
                        localPurgedCount++;
                        confirmedLocalIds.push(localItem.id);
                    } else if (resLocal?.cancelled) {
                        errors.push(`Purge cancelled for local file '${localItem.name}'`);
                    }
                } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : String(err);
                    errors.push(`Local file purge error (${localItem.name}): ${message}`);
                }
            }
        }

        // 2. The trusted callable deletes cloud payloads and all confirmed
        // manifests, including local manifests whose native deletion succeeded.
        const serverPurgeIds = [...cloudItems.map(item => item.id), ...confirmedLocalIds];
        if (serverPurgeIds.length > 0) {
            try {
                const purgeResult = await trashService.permanentlyPurge(serverPurgeIds);

                const cloudIdSet = new Set(cloudItems.map(item => item.id));
                cloudPurgedCount = purgeResult.purgedIds.filter(id => cloudIdSet.has(id)).length;
                if (purgeResult.failedIds.length > 0) {
                    errors.push(...purgeResult.failedIds.map(f => `${f.id}: ${f.error}`));
                }
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                errors.push(`Server purge error: ${message}`);
            }
        }

        setIsPurging(false);
        setIsPurgeModalOpen(false);
        setTypedConfirmationText('');
        setPurgePassword('');
        setSelectedTrashIds([]);
        await loadTrashItems();

        if (errors.length > 0) {
            const { AlertDialog } = await import('@/components/ui/AlertDialog');
            await AlertDialog.call({
                title: 'Purge Summary',
                message: `Purged ${cloudPurgedCount + localPurgedCount} item(s). Failed / Cancelled:\n${errors.join('\n')}`,
            });
        }
    };

    const toggleSelectAllTrash = () => {
        if (selectedTrashIds.length === displayTrashItems.length) {
            setSelectedTrashIds([]);
        } else {
            setSelectedTrashIds(displayTrashItems.map(i => i.id));
        }
    };

    const toggleSelectTrashItem = (id: string) => {
        setSelectedTrashIds(prev => (prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]));
    };

    return (
        <div className="flex h-full bg-background overflow-hidden relative">
            {/* Ambient Background Effect */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-green-500/10 rounded-full blur-[120px] pointer-events-none" />

            {/* Left Sidebar (Internal Navigation) */}
            <div className="w-64 border-r border-white/5 bg-surface/30 backdrop-blur-xl flex flex-col z-10">
                <div className="p-6">
                    <h1 className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-green-500">
                        ASSETS
                    </h1>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest mt-1">Project Vault</p>
                </div>

                <nav className="flex-1 overflow-y-auto px-3 space-y-1">
                    <NavItem
                        icon={Clock}
                        label="Recent"
                        active={activeTab === 'active' && filterType === 'all'}
                        onClick={() => {
                            setActiveTab('active');
                            setFilterType('all');
                        }}
                    />
                    <NavItem icon={Star} label="Favorites" />

                    <div className="mt-8 mb-2 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Media Types</div>
                    <NavItem
                        icon={ImageIcon}
                        label="Images"
                        count={fileNodes.filter((n: FileNode) => n.fileType === 'image' && !n.isTrashed).length}
                        onClick={() => {
                            setActiveTab('active');
                            setFilterType('file_nodes');
                        }}
                        active={activeTab === 'active' && filterType === 'file_nodes'}
                    />
                    <NavItem
                        icon={Video}
                        label="Video"
                        count={fileNodes.filter((n: FileNode) => n.fileType === 'video' && !n.isTrashed).length}
                        onClick={() => {
                            setActiveTab('active');
                            setFilterType('file_nodes');
                        }}
                    />
                    <NavItem
                        icon={Music}
                        label="Audio DNA"
                        count={fileNodes.filter((n: FileNode) => n.fileType === 'audio' && !n.isTrashed).length}
                        onClick={() => {
                            setActiveTab('active');
                            setFilterType('file_nodes');
                        }}
                    />
                    <NavItem
                        icon={FileText}
                        label="Documents"
                        count={fileNodes.filter((n: FileNode) => n.fileType === 'document' && !n.isTrashed).length}
                        onClick={() => {
                            setActiveTab('active');
                            setFilterType('knowledge_docs');
                        }}
                    />

                    <div className="mt-8 mb-2 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Locations</div>
                    <NavItem
                        icon={Folder}
                        label="All Files"
                        onClick={() => {
                            setActiveTab('active');
                            setFilterType('all');
                        }}
                        active={activeTab === 'active' && filterType === 'all'}
                    />
                    <NavItem
                        icon={Trash2}
                        label="Trash Vault"
                        count={trashItems.length}
                        onClick={() => {
                            setActiveTab('trash');
                        }}
                        active={activeTab === 'trash'}
                    />

                    {activeTab === 'active' && (
                        <div className="mt-4 px-2">
                            <FileTree nodes={fileNodes.filter(n => !n.isTrashed)} parentId={null} />
                        </div>
                    )}
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
                            placeholder={activeTab === 'trash' ? 'Search trash items, paths...' : 'Search files, folders...'}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-full pl-10 pr-4 py-2.5 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        {activeTab === 'trash' && (
                            <div className="flex items-center gap-2 mr-4">
                                <span className="text-xs text-gray-400">Provenance:</span>
                                <select
                                    value={sourceFilter}
                                    onChange={e => setSourceFilter(e.target.value as TrashSourceFilter)}
                                    className="bg-black/30 border border-white/10 rounded-md text-xs text-gray-200 px-2 py-1 focus:outline-none"
                                >
                                    <option value="all">All Sources</option>
                                    <option value="user">User Trashed</option>
                                    <option value="agent">Agent Trashed</option>
                                </select>
                            </div>
                        )}

                        {activeTab === 'trash' && selectedTrashIds.length > 0 && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleBatchRestore}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-200 rounded-lg text-xs font-medium transition-colors"
                                >
                                    <RotateCcw size={14} /> Restore ({selectedTrashIds.length})
                                </button>
                                <button
                                    onClick={() => setIsPurgeModalOpen(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/30 hover:bg-red-600/50 border border-red-500/40 text-red-200 rounded-lg text-xs font-medium transition-colors"
                                >
                                    <Trash2 size={14} /> Delete Forever
                                </button>
                            </div>
                        )}

                        <div className="flex items-center gap-2 bg-black/20 p-1 rounded-lg border border-white/5">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={cn('p-2 rounded-md transition-colors', viewMode === 'grid' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300')}
                            >
                                <Grid size={16} />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={cn('p-2 rounded-md transition-colors', viewMode === 'list' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300')}
                            >
                                <ListIcon size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content View */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    {activeTab === 'active' ? (
                        !currentProjectId ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                <Folder size={48} className="mb-4 opacity-20" />
                                <p>Select a project to view files</p>
                            </div>
                        ) : displayActiveNodes.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6">
                                    <Search size={32} className="opacity-20" />
                                </div>
                                <h3 className="text-xl font-semibold text-gray-300 mb-2">No files found</h3>
                                <p className="text-sm">We couldn't find any active resources matching your criteria.</p>
                            </div>
                        ) : (
                            <div className={cn('grid gap-4', viewMode === 'grid' ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' : 'grid-cols-1')}>
                                <AnimatePresence>
                                    {displayActiveNodes.map((node: FileNode) => (
                                        <motion.div
                                            layout
                                            key={node.id}
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            whileHover={{ y: -4 }}
                                            onClick={() => setSelectedFileNode(node.id)}
                                            className={cn(
                                                'group cursor-pointer rounded-xl border transition-all duration-200 overflow-hidden',
                                                selectedFileNodeId === node.id
                                                    ? 'bg-blue-900/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                                                    : 'bg-surface/40 border-white/5 hover:border-white/10 hover:bg-surface/60',
                                                viewMode === 'list' && 'flex items-center p-3 gap-4'
                                            )}
                                        >
                                            <div
                                                className={cn(
                                                    'relative bg-black/40 flex items-center justify-center border-white/5',
                                                    viewMode === 'grid' ? 'aspect-video border-b' : 'w-16 h-16 rounded-lg flex-shrink-0'
                                                )}
                                            >
                                                {node.fileType === 'image' && node.data?.url ? (
                                                    <img src={node.data.url} alt={node.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    getFileIcon(node.fileType, cn('opacity-30', viewMode === 'grid' ? 'w-12 h-12' : 'w-6 h-6'))
                                                )}
                                            </div>

                                            <div className={cn('flex flex-col justify-center', viewMode === 'grid' ? 'p-4' : 'flex-1 min-w-0 py-2')}>
                                                <h4 className="text-sm font-medium text-gray-200 truncate leading-tight" title={node.name}>
                                                    {node.name}
                                                </h4>
                                                <div className="flex items-center text-xs text-gray-500 mt-2 gap-3">
                                                    <span className="capitalize">{node.fileType || 'File'}</span>
                                                    <span className="w-1 h-1 rounded-full bg-gray-600" />
                                                    <span>{formatBytes(node.data?.size)}</span>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        )
                    ) : (
                        /* TRASH VIEW */
                        isLoadingTrash ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-500" role="status">
                                <Trash2 size={32} className="mb-4 animate-pulse opacity-30" />
                                <p>Loading Trash items...</p>
                            </div>
                        ) : displayTrashItems.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6">
                                    <Trash2 size={32} className="opacity-20" />
                                </div>
                                <h3 className="text-xl font-semibold text-gray-300 mb-2">Trash Vault is empty</h3>
                                <p className="text-sm">Items moved to trash will remain here safely until you choose to restore or delete them.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between pb-3 border-b border-white/5 text-xs text-gray-400">
                                    <button onClick={toggleSelectAllTrash} className="flex items-center gap-2 hover:text-white transition-colors">
                                        {selectedTrashIds.length === displayTrashItems.length ? <CheckSquare size={16} /> : <Square size={16} />}
                                        Select All ({displayTrashItems.length})
                                    </button>
                                    <span>No automatic expiration. Trashed items persist until you purge them.</span>
                                </div>

                                <div className={cn('grid gap-4', viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1')}>
                                    {displayTrashItems.map((item: TrashItem) => {
                                        const isSelected = selectedTrashIds.includes(item.id);
                                        const isLocal = item.type === 'local_files';
                                        const isDeviceAvailable = item.deviceInfo?.isAvailable ?? true;

                                        return (
                                            <div
                                                key={item.id}
                                                onClick={() => toggleSelectTrashItem(item.id)}
                                                className={cn(
                                                    'relative p-4 rounded-xl border transition-all cursor-pointer bg-surface/30 border-white/5 hover:border-white/10',
                                                    isSelected && 'bg-blue-900/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                                                )}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="p-2.5 rounded-lg bg-black/40 text-gray-400">{getFileIcon(item.type, 'w-5 h-5')}</div>
                                                        <div className="min-w-0">
                                                            <h4 className="text-sm font-semibold text-gray-200 truncate">{item.name}</h4>
                                                            <p className="text-xs text-gray-500 truncate">{item.originalLocation}</p>
                                                        </div>
                                                    </div>

                                                    <button
                                                        onClick={e => {
                                                            e.stopPropagation();
                                                            handleRestoreItem(item);
                                                        }}
                                                        className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors"
                                                        title="Restore"
                                                    >
                                                        <RotateCcw size={16} />
                                                    </button>
                                                </div>

                                                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-gray-400">
                                                    <div className="flex items-center gap-2">
                                                        {item.provenance.actor === 'agent' ? (
                                                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 text-[10px] font-medium border border-purple-500/20">
                                                                <Bot size={12} /> {item.provenance.agentName || item.provenance.agentId || 'Agent'}
                                                            </span>
                                                        ) : (
                                                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-300 text-[10px] font-medium border border-gray-500/20">
                                                                <UserIcon size={12} /> User
                                                            </span>
                                                        )}

                                                        {isLocal && (
                                                            <span
                                                                className={cn(
                                                                    'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border',
                                                                    isDeviceAvailable
                                                                        ? 'bg-green-500/10 text-green-300 border-green-500/20'
                                                                        : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                                                                )}
                                                            >
                                                                <HardDrive size={12} /> {isDeviceAvailable ? 'Local Desktop' : 'Offline Device'}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <span className="text-[10px] text-gray-500">{new Date(item.trashedAt).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )
                    )}
                </div>
            </div>

            {/* Right Context Panel for Active Node */}
            <AnimatePresence>
                {activeTab === 'active' && selectedFileNodeId && (
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
                            <div className="h-64 bg-black/20 border-b border-white/5 p-4">
                                <FilePreview variant="compact" />
                            </div>

                            <div className="p-6 space-y-6">
                                <div>
                                    <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Properties</h4>
                                    <div className="space-y-3">
                                        <DetailRow label="ID" value={selectedFileNodeId.slice(0, 8) + '...'} />
                                        <DetailRow
                                            label="Type"
                                            value={fileNodes.find((n: FileNode) => n.id === selectedFileNodeId)?.fileType || 'Unknown'}
                                            className="capitalize"
                                        />
                                        <DetailRow label="Size" value={formatBytes(fileNodes.find((n: FileNode) => n.id === selectedFileNodeId)?.data?.size)} />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Actions</h4>
                                    {(() => {
                                        const node = fileNodes.find((n: FileNode) => n.id === selectedFileNodeId);
                                        return (
                                            <>
                                                <button
                                                    onClick={() => downloadFileUrl(node?.data?.url, node?.name)}
                                                    disabled={!node?.data?.url}
                                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-sm text-gray-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                                >
                                                    <Download size={14} className="text-gray-500" /> Download File
                                                </button>
                                                <button
                                                    onClick={() => handleMoveNodeToTrash(selectedFileNodeId, node?.name || 'File')}
                                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-500/10 text-sm text-red-400 transition-colors"
                                                >
                                                    <Trash2 size={14} className="text-red-500" /> Move to Trash
                                                </button>
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Reauthentication & Typed Confirmation Modal for Permanent Deletion */}
            {isPurgeModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-surface/90 border border-red-500/30 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-6">
                        <div className="flex items-center gap-3 text-red-400">
                            <ShieldAlert size={28} />
                            <div>
                                <h3 className="text-lg font-black tracking-tight text-white">Permanent Deletion</h3>
                                <p className="text-xs text-red-300/80">User-only unrecoverable action</p>
                            </div>
                        </div>

                        <p className="text-sm text-gray-300 leading-relaxed">
                            You are about to permanently purge <strong className="text-white">{selectedTrashIds.length}</strong> item(s). This operation is
                            irreversible and cannot be undone by agents or administrators.
                        </p>

                        <div className="space-y-2">
                            {auth.currentUser?.providerData.some(provider => provider.providerId === 'password') && (
                                <>
                                    <label className="text-xs text-gray-400 font-medium">Re-enter your password:</label>
                                    <input
                                        type="password"
                                        value={purgePassword}
                                        onChange={event => setPurgePassword(event.target.value)}
                                        autoComplete="current-password"
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 transition-all"
                                    />
                                </>
                            )}
                            <label className="text-xs text-gray-400 font-medium">Type <code className="bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded font-mono">DELETE</code> to confirm:</label>
                            <input
                                type="text"
                                value={purgeConfirmationText}
                                onChange={e => setTypedConfirmationText(e.target.value)}
                                placeholder="DELETE"
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-red-500 transition-all"
                            />
                        </div>

                        {purgeStatusMessage && (
                            <p role="alert" className="text-xs text-red-300">{purgeStatusMessage}</p>
                        )}

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                onClick={() => {
                                    setIsPurgeModalOpen(false);
                                    setTypedConfirmationText('');
                                    setPurgePassword('');
                                    setPurgeStatusMessage(null);
                                }}
                                disabled={isPurging}
                                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-gray-300 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleExecutePurge}
                                disabled={purgeConfirmationText !== 'DELETE' || isPurging}
                                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-red-900/30 flex items-center gap-2"
                            >
                                {isPurging ? 'Purging...' : 'Purge Permanently'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
