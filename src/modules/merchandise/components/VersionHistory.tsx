import React, { useState, useEffect, useMemo } from 'react';
import { X, History, Clock, RotateCcw, Eye, Trash2, ChevronDown, ChevronUp, Calendar, Loader2 } from 'lucide-react';
import { collection, query, where, orderBy, getDocs, doc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/lib/utils';
import { logger } from '@/utils/logger';

interface DesignVersion {
    id: string;
    name: string;
    canvasJSON: string;
    thumbnail: string;
    lastModified: Date;
    createdAt: Date;
}

interface VersionHistoryProps {
    isOpen: boolean;
    onClose: () => void;
    onRestoreVersion: (version: DesignVersion) => void;
    currentDesignId?: string;
}

export const VersionHistory: React.FC<VersionHistoryProps> = ({
    isOpen,
    onClose,
    onRestoreVersion,
    currentDesignId
}) => {
    const { userProfile, currentOrganizationId, currentProjectId } = useStore(useShallow(state => ({
        userProfile: state.userProfile,
        currentOrganizationId: state.currentOrganizationId,
        currentProjectId: state.currentProjectId
    })));
    const [versions, setVersions] = useState<DesignVersion[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedVersion, setSelectedVersion] = useState<DesignVersion | null>(null);
    const [previewVersion, setPreviewVersion] = useState<DesignVersion | null>(null);
    const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

    // Fetch versions from Firestore
    useEffect(() => {
        if (!isOpen || !userProfile?.id) return;

        const fetchVersions = async () => {
            setLoading(true);
            try {
                const q = query(
                    collection(db, 'designs'),
                    where('userId', '==', userProfile.id),
                    orderBy('lastModified', 'desc')
                );

                const snapshot = await getDocs(q);
                const fetchedVersions: DesignVersion[] = [];

                snapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    fetchedVersions.push({
                        id: docSnap.id,
                        name: data.name || 'Untitled Design',
                        canvasJSON: data.canvasJSON || '{}',
                        thumbnail: data.thumbnail || '',
                        lastModified: data.lastModified instanceof Timestamp
                            ? data.lastModified.toDate()
                            : new Date(data.lastModified),
                        createdAt: data.createdAt instanceof Timestamp
                            ? data.createdAt.toDate()
                            : new Date(data.createdAt || data.lastModified)
                    });
                });

                setVersions(fetchedVersions);

                // Auto-expand the most recent date
                if (fetchedVersions.length > 0) {
                    const firstDate = formatDateKey(fetchedVersions[0]!.lastModified);
                    setExpandedDates(new Set([firstDate]));
                }
            } catch (error) {
                logger.error('Failed to fetch design versions:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchVersions();
    }, [isOpen, userProfile?.id]);

    // Group versions by date
    const groupedVersions = useMemo(() => {
        const groups = new Map<string, DesignVersion[]>();

        versions.forEach(version => {
            const dateKey = formatDateKey(version.lastModified);
            if (!groups.has(dateKey)) {
                groups.set(dateKey, []);
            }
            groups.get(dateKey)!.push(version);
        });

        return groups;
    }, [versions]);

    const handleRestore = (version: DesignVersion) => {
        onRestoreVersion(version);
        onClose();
    };

    const handleDelete = async (version: DesignVersion) => {
        try {
            await deleteDoc(doc(db, 'designs', version.id));
            setVersions(prev => prev.filter(v => v.id !== version.id));
        } catch (error) {
            logger.error('Failed to delete version:', error);
        }
    };

    const toggleDateExpanded = (dateKey: string) => {
        setExpandedDates(prev => {
            const next = new Set(prev);
            if (next.has(dateKey)) {
                next.delete(dateKey);
            } else {
                next.add(dateKey);
            }
            return next;
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-4xl max-h-[85vh] bg-neutral-900 rounded-2xl border border-white/10 shadow-2xl flex overflow-hidden">
                {/* Left Panel - Version List */}
                <div className="w-80 border-r border-white/10 flex flex-col">
                    {/* Header */}
                    <div className="p-4 border-b border-white/10">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                                <History size={18} />
                            </div>
                            <div>
                                <h2 className="text-sm font-bold text-white">Version History</h2>
                                <p className="text-xs text-neutral-400">{versions.length} saved versions</p>
                            </div>
                        </div>
                    </div>

                    {/* Version List */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-full gap-3">
                                <Loader2 size={24} className="text-blue-400 animate-spin" />
                                <p className="text-sm text-neutral-500">Loading versions...</p>
                            </div>
                        ) : versions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center p-6">
                                <History size={32} className="text-neutral-700 mb-3" />
                                <p className="text-neutral-400 text-sm">No saved versions yet</p>
                                <p className="text-neutral-600 text-xs mt-1">
                                    Your designs will be auto-saved as you work
                                </p>
                            </div>
                        ) : (
                            <div className="p-2">
                                {Array.from(groupedVersions.entries()).map(([dateKey, dateVersions]) => (
                                    <div key={dateKey} className="mb-2">
                                        {/* Date Header */}
                                        <button
                                            onClick={() => toggleDateExpanded(dateKey)}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-neutral-400 hover:text-white transition-colors"
                                        >
                                            <Calendar size={12} />
                                            <span className="flex-1 text-left">{dateKey}</span>
                                            <span className="text-neutral-600">{dateVersions.length}</span>
                                            {expandedDates.has(dateKey) ? (
                                                <ChevronUp size={12} />
                                            ) : (
                                                <ChevronDown size={12} />
                                            )}
                                        </button>

                                        {/* Versions for this date */}
                                        {expandedDates.has(dateKey) && (
                                            <div className="space-y-1 ml-2">
                                                {dateVersions.map(version => (
                                                    <VersionItem
                                                        key={version.id}
                                                        version={version}
                                                        isSelected={selectedVersion?.id === version.id}
                                                        isCurrent={version.id === currentDesignId}
                                                        onSelect={() => setSelectedVersion(version)}
                                                        onPreview={() => setPreviewVersion(version)}
                                                        onRestore={() => handleRestore(version)}
                                                        onDelete={() => handleDelete(version)}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel - Preview */}
                <div className="flex-1 flex flex-col">
                    {/* Preview Header */}
                    <div className="p-4 border-b border-white/10 flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-white">
                                {previewVersion?.name || selectedVersion?.name || 'Select a version'}
                            </h3>
                            {(previewVersion || selectedVersion) && (
                                <p className="text-xs text-neutral-400 flex items-center gap-1 mt-0.5">
                                    <Clock size={10} />
                                    {formatTime((previewVersion || selectedVersion)!.lastModified)}
                                </p>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Preview Area */}
                    <div className="flex-1 bg-neutral-950 flex items-center justify-center p-8">
                        {(previewVersion || selectedVersion) ? (
                            <div className="relative w-full max-w-lg aspect-square bg-neutral-800 rounded-xl overflow-hidden border border-white/10">
                                {(previewVersion || selectedVersion)!.thumbnail ? (
                                    <img
                                        src={(previewVersion || selectedVersion)!.thumbnail}
                                        alt="Design preview"
                                        className="w-full h-full object-contain"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-neutral-600">
                                        <History size={48} />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center text-neutral-600">
                                <Eye size={48} className="mx-auto mb-4 opacity-50" />
                                <p>Select a version to preview</p>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    {(previewVersion || selectedVersion) && (
                        <div className="p-4 border-t border-white/10 flex gap-3">
                            <button
                                onClick={() => handleRestore((previewVersion || selectedVersion)!)}
                                className="flex-1 py-3 bg-blue-500 hover:bg-blue-400 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                            >
                                <RotateCcw size={16} />
                                Restore This Version
                            </button>
                            <button
                                onClick={onClose}
                                className="px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-medium text-sm transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Version Item Component
const VersionItem: React.FC<{
    version: DesignVersion;
    isSelected: boolean;
    isCurrent: boolean;
    onSelect: () => void;
    onPreview: () => void;
    onRestore: () => void;
    onDelete: () => void;
}> = ({ version, isSelected, isCurrent, onSelect, onPreview, onRestore, onDelete }) => {
    return (
        <div
            onClick={onSelect}
            onMouseEnter={onPreview}
            className={cn(
                "group relative p-2 rounded-lg cursor-pointer transition-all",
                isSelected
                    ? 'bg-blue-500/20 border border-blue-500/40'
                    : 'hover:bg-white/5 border border-transparent'
            )}
        >
            <div className="flex items-start gap-2">
                {/* Thumbnail */}
                <div className="w-10 h-10 rounded bg-neutral-800 overflow-hidden flex-shrink-0">
                    {version.thumbnail ? (
                        <img
                            src={version.thumbnail}
                            alt=""
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-600">
                            <History size={14} />
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">
                        {version.name}
                    </p>
                    <p className="text-[10px] text-neutral-500 flex items-center gap-1">
                        <Clock size={8} />
                        {formatTime(version.lastModified)}
                    </p>
                </div>

                {/* Current Badge */}
                {isCurrent && (
                    <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[9px] font-bold rounded">
                        CURRENT
                    </span>
                )}
            </div>

            {/* Hover Actions */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRestore();
                    }}
                    className="p-1.5 bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 rounded transition-colors"
                    title="Restore"
                >
                    <RotateCcw size={12} />
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                    className="p-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded transition-colors"
                    title="Delete"
                >
                    <Trash2 size={12} />
                </button>
            </div>
        </div>
    );
};

// Utility Functions
function formatDateKey(date: Date): string {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (isSameDay(date, today)) {
        return 'Today';
    } else if (isSameDay(date, yesterday)) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
    }
}

function formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

function isSameDay(d1: Date, d2: Date): boolean {
    return (
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate()
    );
}

export default VersionHistory;
