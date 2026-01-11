import React, { useState, useRef } from 'react';
import FileUpload from '@/components/kokonutui/file-upload';
import { useStore } from '@/core/store';
import { Play, Image as ImageIcon, Trash2, Maximize2, Upload, Plus, ArrowLeftToLine, ArrowRightToLine, Anchor, ThumbsUp, ThumbsDown, Flag, Download, Share2, Star } from 'lucide-react';

import { useToast } from '@/core/context/ToastContext';

import { HistoryItem } from '@/core/store';

interface CreativeGalleryProps {
    compact?: boolean;
    onSelect?: (item: HistoryItem) => void;
    className?: string;
    searchQuery?: string;
}

export default function CreativeGallery({ compact = false, onSelect, className = '', searchQuery = '' }: CreativeGalleryProps) {
    const { generatedHistory, removeFromHistory, uploadedImages, addUploadedImage, removeUploadedImage, currentProjectId, generationMode, setVideoInput, selectedItem, setSelectedItem, setEntityAnchor } = useStore();
    // const [selectedItem, setSelectedItem] = useState<{ id: string; url: string; prompt: string; type: 'image' | 'video'; mask?: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const toast = useToast();

    // Filter items based on search query
    const filteredUploaded = searchQuery
        ? uploadedImages.filter(item => item.prompt?.toLowerCase().includes(searchQuery.toLowerCase()))
        : uploadedImages;

    const filteredGenerated = searchQuery
        ? generatedHistory.filter(item => item.prompt?.toLowerCase().includes(searchQuery.toLowerCase()))
        : generatedHistory;

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    const isVideo = file.type.startsWith('video/');
                    addUploadedImage({
                        id: crypto.randomUUID(),
                        type: isVideo ? 'video' : 'image',
                        url: e.target.result as string,
                        prompt: file.name,
                        timestamp: Date.now(),
                        projectId: currentProjectId,
                        origin: 'uploaded'
                    });
                }
            };
            reader.readAsDataURL(file);
        });
        toast.success(`${files.length} asset(s) uploaded.`);
    };

    const isEmpty = generatedHistory.length === 0 && uploadedImages.length === 0;

    if (isEmpty) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-gray-500">
                <div className="w-16 h-16 rounded-2xl bg-[#1a1a1a] border border-dashed border-gray-800 flex items-center justify-center mb-4">
                    <Upload className="w-6 h-6 text-gray-600" />
                </div>
                <p className="text-sm font-medium">No assets yet</p>
                <p className="text-xs opacity-60 mt-1">Upload or generate to see them here</p>
            </div>
        );
    }

    const renderGridItem = (item: HistoryItem, onDelete: (id: string) => void) => (
        <div
            key={item.id}
            draggable
            onDragStart={(e) => e.dataTransfer.setData('text/plain', item.id)}
            onClick={() => onSelect ? onSelect(item) : setSelectedItem(item)}
            className="group relative aspect-video bg-[#1a1a1a] rounded-lg border border-gray-800 overflow-hidden hover:border-gray-600 transition-all cursor-pointer"
        >
            {item.type === 'video' ? (
                item.url.startsWith('data:image') ? (
                    <div className="relative w-full h-full">
                        <img src={item.url} alt={item.prompt} loading="lazy" className="w-full h-full object-contain bg-black" />
                        <div className="absolute top-2 left-2 bg-purple-600/80 text-white text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-sm">
                            STORYBOARD
                        </div>
                    </div>
                ) : (
                    <video src={item.url} className="w-full h-full object-contain bg-black" loop muted onMouseOver={e => e.currentTarget.play()} onMouseOut={e => e.currentTarget.pause()} />
                )
            ) : (
                item.url === 'placeholder:dev-data-uri-too-large' ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-gray-500 p-4 text-center">
                        <ImageIcon size={24} className="mb-2 opacity-20" />
                        <span className="text-[10px] font-mono leading-tight">DEV PREVIEW<br />(Size Limit)</span>
                    </div>
                ) : (
                    <img src={item.url} alt={item.prompt} className="w-full h-full object-contain bg-black" />
                )
            )}

            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex flex-col justify-end p-3">
                <p className="text-xs text-white line-clamp-2 mb-2">{item.prompt}</p>
                <div className="flex justify-between items-center">
                    <span className="text-[10px] text-gray-400 uppercase">{item.type}</span>
                    <div className="flex gap-1">
                        {generationMode === 'video' && (
                            <>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setVideoInput('firstFrame', item); toast.success("Set as First Frame"); }}
                                    className="p-1.5 bg-gray-800/50 text-white rounded hover:bg-blue-600 focus-visible:ring-2 focus-visible:ring-white/50 transition-colors"
                                    title="Set as First Frame"
                                    aria-label="Set as First Frame"
                                >
                                    <ArrowLeftToLine size={14} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setVideoInput('lastFrame', item); toast.success("Set as Last Frame"); }}
                                    className="p-1.5 bg-gray-800/50 text-white rounded hover:bg-purple-600 focus-visible:ring-2 focus-visible:ring-white/50 transition-colors"
                                    title="Set as Last Frame"
                                    aria-label="Set as Last Frame"
                                >
                                    <ArrowRightToLine size={14} />
                                </button>
                            </>
                        )}
                        <button
                            onClick={(e) => { e.stopPropagation(); setEntityAnchor(item); toast.success("Entity Anchor Set"); }}
                            className="p-1.5 bg-gray-800/50 text-white rounded hover:bg-yellow-500 hover:text-black focus-visible:ring-2 focus-visible:ring-white/50 transition-colors"
                            title="Set as Entity Anchor (Character Lock)"
                            aria-label="Set as Entity Anchor (Character Lock)"
                        >
                            <Anchor size={14} />
                        </button>
                        <button
                            className="p-1.5 bg-gray-800/50 text-white rounded hover:bg-gray-700 focus-visible:ring-2 focus-visible:ring-white/50 transition-colors"
                            title="View Fullsize"
                            aria-label="View Fullsize"
                        >
                            <Maximize2 size={14} />
                        </button>
                        <button
                            className="p-1.5 bg-gray-800/50 text-white rounded hover:bg-blue-500 focus-visible:ring-2 focus-visible:ring-white/50 transition-colors"
                            title="Like"
                            aria-label="Like"
                        >
                            <ThumbsUp size={14} />
                        </button>
                        <button
                            className="p-1.5 bg-gray-800/50 text-white rounded hover:bg-orange-500 focus-visible:ring-2 focus-visible:ring-white/50 transition-colors"
                            title="Dislike"
                            aria-label="Dislike"
                        >
                            <ThumbsDown size={14} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                            className="p-1.5 bg-red-500/10 text-red-500 rounded hover:bg-red-500 hover:text-white focus-visible:ring-2 focus-visible:ring-white/50 transition-colors border border-red-500/20"
                            title="Delete"
                            aria-label="Delete"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {item.type === 'video' && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center pointer-events-none">
                    <Play size={10} className="text-white ml-0.5" />
                </div>
            )}
        </div>
    );

    const gridClass = compact
        ? "grid grid-cols-2 gap-2"
        : "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4";

    return (
        <div className={`flex-1 flex flex-col h-full overflow-hidden ${className}`}>

            {/* Generation History */}
            <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Generation History</h2>
                <div className={gridClass}>
                    {filteredGenerated.map(item => renderGridItem(item, removeFromHistory))}
                </div>
            </div>
        </div>
    );
}
