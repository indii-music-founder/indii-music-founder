import React, { useState, useRef, useMemo, memo, useCallback, useEffect } from 'react';
import FileUpload from '@/components/kokonutui/file-upload';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Play, Pause, Image as ImageIcon, Trash2, Maximize2, Upload, Plus, ArrowLeftToLine, ArrowRightToLine, Anchor, ThumbsUp, ThumbsDown, Flag, Download, Share2, Star, RotateCw } from 'lucide-react';

import { useToast } from '@/core/context/ToastContext';
import { ActionableEmptyState } from '@/components/shared/ActionableEmptyState';

import { HistoryItem } from '@/core/store';

interface CreativeGalleryProps {
    compact?: boolean;
    onSelect?: (item: HistoryItem) => void;
    className?: string;
    searchQuery?: string;
}

interface GalleryItemProps {
    item: HistoryItem;
    onSelect: (item: HistoryItem) => void;
    setVideoInput: (key: 'firstFrame' | 'lastFrame', value: HistoryItem) => void;
    addCharacterReference: (ref: { image: HistoryItem; referenceType: "subject" | "style" | "reference" }) => void;
    setSelectedItem: (item: HistoryItem | null) => void;
    toast: any;
    generationMode: string;
    onDelete: (id: string, type: 'image' | 'video' | 'music' | 'text', origin: 'generated' | 'uploaded') => void;
    setPrompt: (prompt: string) => void;
    setViewMode: (mode: any) => void;
    playTrack: (track: HistoryItem) => void;
    pauseTrack: () => void;
    resumeTrack: () => void;
    currentTrack: HistoryItem | null;
    isPlaying: boolean;
}

const GalleryItem = memo(({ item, onSelect, setVideoInput, addCharacterReference, setSelectedItem, toast, generationMode, onDelete, setPrompt, setViewMode, playTrack, pauseTrack, resumeTrack, currentTrack, isPlaying }: GalleryItemProps) => {
    return (
        <div
            draggable
            onDragStart={(e) => e.dataTransfer.setData('text/plain', item.id)}
            onClick={() => onSelect(item)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(item);
                }
            }}
            tabIndex={0}
            role="button"
            aria-label={`Select ${item.prompt}`}
            data-testid={`gallery-item-${item.id}`}
            className="group relative aspect-video bg-[#1a1a1a] rounded-lg border border-gray-800 overflow-hidden hover:border-gray-600 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
        >
            {item.type === 'video' ? (
                item.url.startsWith('data:image') ? (
                    <div className="relative w-full h-full">
                        <img
                            src={item.url}
                            alt={item.prompt}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-contain bg-black"
                        />
                        <div className="absolute top-2 left-2 bg-purple-600/80 text-white text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-sm">
                            STORYBOARD
                        </div>
                    </div>
                ) : (
                    <video src={item.url} className="w-full h-full object-contain bg-black" loop muted onMouseOver={e => e.currentTarget.play()} onMouseOut={e => e.currentTarget.pause()} />
                )
            ) : item.type === 'music' ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-gray-400 p-4 text-center group-hover:text-white transition-colors">
                    <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mb-2">
                        <Share2 size={24} className="ml-1" />
                    </div>
                    <span className="text-[10px] font-mono leading-tight max-w-full truncate px-2">{item.prompt}</span>
                </div>
            ) : (
                item.url === 'placeholder:dev-data-uri-too-large' ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-gray-500 p-4 text-center">
                        <ImageIcon size={24} className="mb-2 opacity-20" />
                        <span className="text-[10px] font-mono leading-tight">DEV PREVIEW<br />(Size Limit)</span>
                    </div>
                ) : (
                    <img
                        src={item.url}
                        alt={item.prompt}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-contain bg-black"
                    />
                )
            )}

            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex flex-col justify-end p-3">
                <p className="text-xs text-white line-clamp-2 mb-2">{item.prompt}</p>
                <div className="flex justify-between items-center">
                    <span className="text-[10px] text-gray-400 uppercase">{item.type}</span>
                    <div className="flex gap-1">
                        {item.type !== 'music' && generationMode === 'video' && (
                            <>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setVideoInput('firstFrame', item); toast.success("Set as First Frame"); }}
                                    data-testid="set-first-frame-btn"
                                    className="p-1.5 bg-gray-800/50 text-white rounded hover:bg-blue-600 transition-colors"
                                    title="Set as First Frame"
                                    aria-label="Set as First Frame"
                                >
                                    <ArrowLeftToLine size={14} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setVideoInput('lastFrame', item); toast.success("Set as Last Frame"); }}
                                    data-testid="set-last-frame-btn"
                                    className="p-1.5 bg-gray-800/50 text-white rounded hover:bg-purple-600 transition-colors"
                                    title="Set as Last Frame"
                                    aria-label="Set as Last Frame"
                                >
                                    <ArrowRightToLine size={14} />
                                </button>
                            </>
                        )}
                        <button
                            onClick={(e) => { e.stopPropagation(); addCharacterReference({ image: item, referenceType: 'subject' }); toast.success("Character Reference Set"); }}
                            data-testid="set-anchor-btn"
                            className="p-1.5 bg-gray-800/50 text-white rounded hover:bg-yellow-500 hover:text-black focus-visible:ring-2 focus-visible:ring-white/50 transition-colors"
                            title="Add Character Reference"
                            aria-label="Add Character Reference"
                        >
                            <Anchor size={14} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setSelectedItem(item); }}
                            data-testid="view-fullsize-btn"
                            className="p-1.5 bg-gray-800/50 text-white rounded hover:bg-gray-700 focus-visible:ring-2 focus-visible:ring-white/50 transition-colors"
                            title="View Fullsize"
                            aria-label="View Fullsize"
                        >
                            <Maximize2 size={14} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); toast.success("Feedback recorded: Liked"); }}
                            data-testid="like-btn"
                            className="p-1.5 bg-gray-800/50 text-white rounded hover:bg-blue-500 focus-visible:ring-2 focus-visible:ring-white/50 transition-colors"
                            title="Like"
                            aria-label="Like"
                        >
                            <ThumbsUp size={14} />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setPrompt(item.prompt);
                                setViewMode('direct');
                                toast.success("Prompt loaded for re-roll!");
                            }}
                            data-testid="reroll-btn"
                            className="p-1.5 bg-gray-800/50 text-white rounded hover:bg-dept-creative/50 hover:text-white transition-colors"
                            title="Re-roll with this prompt"
                            aria-label="Re-roll with this prompt"
                        >
                            <RotateCw size={14} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); toast.success("Feedback recorded: Disliked"); }}
                            data-testid="dislike-btn"
                            className="p-1.5 bg-gray-800/50 text-white rounded hover:bg-orange-500 focus-visible:ring-2 focus-visible:ring-white/50 transition-colors"
                            title="Dislike"
                            aria-label="Dislike"
                        >
                            <ThumbsDown size={14} />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                import('@/utils/download').then(({ downloadAsset }) => {
                                    downloadAsset(item.url, `${item.type}-export-${item.id.slice(0, 8)}`);
                                    toast.success('Downloading asset...');
                                });
                            }}
                            data-testid="download-asset-btn"
                            className="p-1.5 bg-gray-800/50 text-white rounded hover:bg-green-600 transition-colors"
                            title="Download"
                            aria-label="Download"
                        >
                            <Download size={14} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(item.id, item.type, item.origin as any); }}
                            data-testid="delete-asset-btn"
                            className="p-1.5 bg-red-500/10 text-red-500 rounded hover:bg-red-500 hover:text-white transition-colors border border-red-500/20"
                            title="Delete"
                            aria-label="Delete"
                        >
                            <Trash2 size={14} />
                        </button>
                        {item.type === 'music' && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const isCurrent = currentTrack?.id === item.id;
                                    if (isCurrent && isPlaying) {
                                        pauseTrack();
                                    } else if (isCurrent) {
                                        resumeTrack();
                                    } else {
                                        playTrack(item);
                                    }
                                }}
                                data-testid="play-asset-btn"
                                className={`p-1.5 rounded transition-colors ${currentTrack?.id === item.id && isPlaying ? 'bg-blue-600 text-white' : 'bg-gray-800/50 text-white hover:bg-blue-500'}`}
                                title={currentTrack?.id === item.id && isPlaying ? "Pause" : "Play"}
                                aria-label={currentTrack?.id === item.id && isPlaying ? "Pause" : "Play"}
                            >
                                {currentTrack?.id === item.id && isPlaying ? <Pause size={14} /> : <Play size={14} />}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {item.type === 'video' && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center pointer-events-none">
                    <Play size={10} className="text-white ml-0.5" />
                </div>
            )}
            {item.type === 'music' && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500/50 rounded-full flex items-center justify-center pointer-events-none">
                    <Download size={10} className="text-white" />
                </div>
            )}
        </div>
    );
});

export default function CreativeGallery({ compact = false, onSelect, className = '', searchQuery = '' }: CreativeGalleryProps) {
    // ⚡ Bolt Optimization: Use useShallow to prevent re-renders on unrelated store updates
    const {
        generatedHistory, removeFromHistory, uploadedImages, addUploadedImage, removeUploadedImage,
        uploadedAudio, addUploadedAudio, removeUploadedAudio, currentProjectId, generationMode,
        setVideoInput, selectedItem, setSelectedItem, addCharacterReference, setPrompt, setViewMode,
        playTrack, stopTrack, currentTrack, isPlaying, pauseTrack, resumeTrack
    } = useStore(useShallow(state => ({
        generatedHistory: state.generatedHistory,
        removeFromHistory: state.removeFromHistory,
        uploadedImages: state.uploadedImages,
        addUploadedImage: state.addUploadedImage,
        removeUploadedImage: state.removeUploadedImage,
        uploadedAudio: state.uploadedAudio,
        addUploadedAudio: state.addUploadedAudio,
        removeUploadedAudio: state.removeUploadedAudio,
        currentProjectId: state.currentProjectId,
        generationMode: state.generationMode,
        setVideoInput: state.setVideoInput,
        selectedItem: state.selectedItem,
        setSelectedItem: state.setSelectedItem,
        addCharacterReference: state.addCharacterReference,
        setPrompt: state.setPrompt,
        setViewMode: state.setViewMode,
        playTrack: state.playTrack,
        stopTrack: state.stopTrack,
        currentTrack: state.currentTrack,
        isPlaying: state.isPlaying,
        pauseTrack: state.pauseTrack,
        resumeTrack: state.resumeTrack
    })));
    const fileInputRef = useRef<HTMLInputElement>(null);
    const toast = useToast();

    // ⚡ Bolt Optimization: Stable callback reference for onSelect to prevent re-renders when parent passes new arrow function
    const onSelectRef = useRef(onSelect);
    useEffect(() => {
        onSelectRef.current = onSelect;
    });


    const handleSelect = useCallback((item: HistoryItem) => {
        if (onSelectRef.current) {
            onSelectRef.current(item);
        } else {
            setSelectedItem(item);
            setViewMode('editor');
        }
    }, [setSelectedItem, setViewMode]);

    // Combine all items and sort by timestamp (newest first)
    // ⚡ Bolt Optimization: Memoize allItems and compute filtered arrays inside the callback
    const allItems = useMemo(() => {
        const filteredUploadedImages = (searchQuery
            ? uploadedImages?.filter(item => item.prompt?.toLowerCase().includes(searchQuery.toLowerCase()))
            : uploadedImages) || [];

        const filteredUploadedAudio = (searchQuery
            ? uploadedAudio?.filter(item => item.prompt?.toLowerCase().includes(searchQuery.toLowerCase()))
            : uploadedAudio) || [];

        const filteredGenerated = (searchQuery
            ? generatedHistory?.filter(item => item.prompt?.toLowerCase().includes(searchQuery.toLowerCase()))
            : generatedHistory) || [];

        return [...filteredUploadedImages, ...filteredUploadedAudio, ...filteredGenerated].sort((a, b) => b.timestamp - a.timestamp);
    }, [uploadedImages, uploadedAudio, generatedHistory, searchQuery]);

    const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    const isVideo = file.type.startsWith('video/');
                    const isAudio = file.type.startsWith('audio/');

                    const newItem: HistoryItem = {
                        id: crypto.randomUUID(),
                        type: isAudio ? 'music' : (isVideo ? 'video' : 'image'),
                        url: e.target.result as string,
                        prompt: file.name,
                        timestamp: Date.now(),
                        projectId: currentProjectId,
                        origin: 'uploaded'
                    };

                    if (isAudio) {
                        addUploadedAudio(newItem);
                    } else {
                        addUploadedImage(newItem);
                    }
                }
            };
            reader.readAsDataURL(file);
        });
        toast.success(`${files.length} asset(s) uploaded.`);
    }, [addUploadedAudio, addUploadedImage, currentProjectId, toast]);

    const isEmpty = allItems.length === 0;

    // --- Virtualization Logic ---
    const parentRef = useRef<HTMLDivElement>(null);
    const [columns, setColumns] = useState(compact ? 2 : 4);

    useEffect(() => {
        if (!parentRef.current) return;
        const observer = new ResizeObserver((entries) => {
            const width = entries[0].contentRect.width;
            if (compact) {
                setColumns(2);
            } else {
                setColumns(width >= 1024 ? 4 : width >= 768 ? 3 : 2);
            }
        });
        observer.observe(parentRef.current);
        return () => observer.disconnect();
    }, [compact]);

    const rowCount = Math.ceil(allItems.length / columns);

    // eslint-disable-next-line react-hooks/incompatible-library
    const rowVirtualizer = useVirtualizer({
        count: rowCount,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 200, // Will be dynamically measured after first render
        overscan: 2,
    });

    // ⚡ Bolt Optimization: Stable delete handler
    const handleDelete = useCallback((id: string, type: 'image' | 'video' | 'music' | 'text', origin: 'generated' | 'uploaded') => {
        if (origin === 'uploaded') {
            if (type === 'music') removeUploadedAudio(id);
            else removeUploadedImage(id);
        } else {
            removeFromHistory(id);
        }
    }, [removeUploadedAudio, removeUploadedImage, removeFromHistory]);

    if (isEmpty) {
        return (
            <div className="flex-1 p-8">
                <ActionableEmptyState
                    icon={<ImageIcon size={48} />}
                    title="GALLERY IS EMPTY"
                    description="Upload media or generate new AI assets to see them appear in your gallery."
                    actionLabel="Upload Media"
                    onAction={() => fileInputRef.current?.click()}
                    colorClasses={{
                        text: 'text-gray-400',
                        bg: 'bg-[#111]',
                        border: 'border-white/5',
                        glow: 'shadow-white/5'
                    }}
                />
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileUpload}
                    accept="image/*,video/*,audio/*"
                    multiple
                />
            </div>
        );
    }

    const gridClass = compact
        ? "grid grid-cols-2 gap-2"
        : "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4";

    return (
        <div data-testid="creative-gallery" className={`flex-1 flex flex-col h-full overflow-hidden ${className}`}>
            {/* Upload Header - Optional if compact */}
            {!compact && (
                <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                    <h2 className="text-sm font-bold text-gray-200">Asset Gallery</h2>
                    <div className="flex gap-2">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="text-xs flex items-center gap-2 px-3 py-1.5 bg-[#222] hover:bg-[#333] text-white rounded-md transition-colors"
                        >
                            <Upload size={14} />
                            Upload
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileUpload}
                            accept="image/*,video/*,audio/*"
                            multiple
                        />
                    </div>
                </div>
            )}

            {/* Generation History */}
            <div ref={parentRef} className="flex-1 p-4 overflow-y-auto custom-scrollbar relative">
                {!compact && <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">All Assets</h2>}

                <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const startIndex = virtualRow.index * columns;
                        const rowItems = allItems.slice(startIndex, startIndex + columns);

                        return (
                            <div
                                key={virtualRow.index}
                                data-index={virtualRow.index}
                                ref={rowVirtualizer.measureElement}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    transform: `translateY(${virtualRow.start}px)`,
                                    paddingBottom: '16px' // equivalent to gap-4
                                }}
                            >
                                <div className={gridClass}>
                                    {rowItems.map(item => (
                                        <GalleryItem
                                            key={item.id}
                                            item={item}
                                            onSelect={handleSelect}
                                            setVideoInput={setVideoInput}
                                            addCharacterReference={addCharacterReference}
                                            setSelectedItem={setSelectedItem}
                                            toast={toast}
                                            generationMode={generationMode}
                                            onDelete={item.origin === 'uploaded' ? (item.type === 'music' ? removeUploadedAudio : removeUploadedImage) : removeFromHistory}
                                            setPrompt={setPrompt}
                                            setViewMode={setViewMode}
                                            playTrack={playTrack}
                                            pauseTrack={pauseTrack}
                                            resumeTrack={resumeTrack}
                                            currentTrack={currentTrack}
                                            isPlaying={isPlaying}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
