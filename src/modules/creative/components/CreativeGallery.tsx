import React, { useState, useRef } from 'react';
import { useStore } from '@/core/store';
import { Play, Image as ImageIcon, Trash2, Maximize2, Upload, Plus, ArrowLeftToLine, ArrowRightToLine } from 'lucide-react';
import CreativeCanvas from './CreativeCanvas';
import { useToast } from '@/core/context/ToastContext';

export default function CreativeGallery({ compact = false }: { compact?: boolean }) {
    const { generatedHistory, removeFromHistory, uploadedImages, addUploadedImage, removeUploadedImage, currentProjectId, generationMode, setVideoInput, selectedItem, setSelectedItem } = useStore();
    // const [selectedItem, setSelectedItem] = useState<{ id: string; url: string; prompt: string; type: 'image' | 'video'; mask?: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const toast = useToast();

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
                        projectId: currentProjectId
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
            <div className="flex-1 flex items-center justify-center text-gray-500 flex-col gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center">
                    <ImageIcon size={32} className="opacity-50" />
                </div>
                <p>Gallery is empty. Start creating or upload assets!</p>
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                    <Upload size={16} /> Upload Assets
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    multiple
                    accept="image/*,video/*"
                    onChange={handleFileUpload}
                />
            </div>
        );
    }

    const renderGridItem = (item: any, onDelete: (id: string) => void) => (
        <div
            key={item.id}
            draggable
            onDragStart={(e) => e.dataTransfer.setData('text/plain', item.id)}
            onClick={() => setSelectedItem(item)}
            className="group relative aspect-video bg-[#1a1a1a] rounded-lg border border-gray-800 overflow-hidden hover:border-gray-600 transition-all cursor-pointer"
        >
            {item.type === 'video' ? (
                item.url.startsWith('data:image') ? (
                    <div className="relative w-full h-full">
                        <img src={item.url} alt={item.prompt} className="w-full h-full object-contain bg-black" />
                        <div className="absolute top-2 left-2 bg-purple-600/80 text-white text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-sm">
                            STORYBOARD
                        </div>
                    </div>
                ) : (
                    <video src={item.url} className="w-full h-full object-contain bg-black" loop muted onMouseOver={e => e.currentTarget.play()} onMouseOut={e => e.currentTarget.pause()} />
                )
            ) : (
                <img src={item.url} alt={item.prompt} className="w-full h-full object-contain bg-black" />
            )}

            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                <p className="text-xs text-white line-clamp-2 mb-2">{item.prompt}</p>
                <div className="flex justify-between items-center">
                    <span className="text-[10px] text-gray-400 uppercase">{item.type}</span>
                    <div className="flex gap-1">
                        {generationMode === 'video' && (
                            <>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setVideoInput('firstFrame', item); toast.success("Set as First Frame"); }}
                                    className="p-1.5 bg-gray-800/50 text-white rounded hover:bg-purple-600 transition-colors"
                                    title="Set as First Frame"
                                >
                                    <ArrowLeftToLine size={14} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setVideoInput('lastFrame', item); toast.success("Set as Last Frame"); }}
                                    className="p-1.5 bg-gray-800/50 text-white rounded hover:bg-purple-600 transition-colors"
                                    title="Set as Last Frame"
                                >
                                    <ArrowRightToLine size={14} />
                                </button>
                            </>
                        )}
                        <button className="p-1.5 bg-gray-800/50 text-white rounded hover:bg-gray-700 transition-colors">
                            <Maximize2 size={14} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                            className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500 hover:text-white transition-colors"
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
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Assets Section */}
            <div
                className="flex-shrink-0 p-4 border-b border-gray-800 max-h-[40%] overflow-y-auto custom-scrollbar transition-colors"
                onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add('bg-gray-800/50');
                }}
                onDragLeave={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('bg-gray-800/50');
                }}
                onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('bg-gray-800/50');
                    const id = e.dataTransfer.getData('text/plain');
                    if (id) {
                        const item = generatedHistory.find(i => i.id === id);
                        if (item) {
                            addUploadedImage({
                                ...item,
                                id: crypto.randomUUID(),
                                timestamp: Date.now()
                            });
                            toast.success("Saved to Assets");
                        }
                    } else if (e.dataTransfer.files.length > 0) {
                        // Handle file drop directly
                        const files = e.dataTransfer.files;
                        Array.from(files).forEach(file => {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                                if (ev.target?.result) {
                                    const isVideo = file.type.startsWith('video/');
                                    addUploadedImage({
                                        id: crypto.randomUUID(),
                                        type: isVideo ? 'video' : 'image',
                                        url: ev.target.result as string,
                                        prompt: file.name,
                                        timestamp: Date.now(),
                                        projectId: currentProjectId
                                    });
                                }
                            };
                            reader.readAsDataURL(file);
                        });
                        toast.success(`${files.length} asset(s) uploaded.`);
                    }
                }}
            >
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Assets & Uploads</h2>
                    <div className="flex gap-2">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                        >
                            <Plus size={14} /> Upload
                        </button>
                        {/* Mobile Camera Button */}
                        <button
                            onClick={() => {
                                if (fileInputRef.current) {
                                    fileInputRef.current.setAttribute('capture', 'environment');
                                    fileInputRef.current.click();
                                    // Reset after click to allow normal upload next time
                                    setTimeout(() => fileInputRef.current?.removeAttribute('capture'), 100);
                                }
                            }}
                            className="md:hidden text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 bg-purple-900/20 px-2 py-1 rounded border border-purple-500/30"
                        >
                            <ImageIcon size={14} /> Take Picture
                        </button>
                    </div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        multiple
                        accept="image/*,video/*"
                        onChange={handleFileUpload}
                    />
                </div>
                {uploadedImages.length > 0 ? (
                    <div className={gridClass}>
                        {/* Add New Card */}
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="aspect-video bg-[#1a1a1a] rounded-lg border border-dashed border-gray-700 hover:border-purple-500 hover:bg-purple-900/10 transition-all flex flex-col items-center justify-center gap-2 group"
                        >
                            <div className="w-8 h-8 rounded-full bg-gray-800 group-hover:bg-purple-500/20 flex items-center justify-center transition-colors">
                                <Plus size={16} className="text-gray-400 group-hover:text-purple-400" />
                            </div>
                            <span className="text-[10px] font-medium text-gray-500 group-hover:text-purple-300 uppercase tracking-wide">Add Asset</span>
                        </button>
                        {uploadedImages.map(item => renderGridItem(item, removeUploadedImage))}
                    </div>
                ) : (
                    <div className="p-10 border-2 border-dashed border-gray-700 hover:border-purple-500 hover:bg-purple-900/10 rounded-xl flex flex-col items-center justify-center text-gray-400 gap-4 transition-all duration-300 group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <div className="w-16 h-16 rounded-full bg-gray-800 group-hover:bg-purple-500/20 flex items-center justify-center transition-colors shadow-lg">
                            <Upload size={24} className="opacity-70 group-hover:text-purple-400 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                        </div>
                        <div className="text-center">
                            <p className="text-base font-bold text-gray-300 mb-1 group-hover:text-white">Drop files here</p>
                            <p className="text-xs text-gray-500 group-hover:text-gray-400">or click to browse</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Gallery Section */}
            <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Generation History</h2>
                <div className={gridClass}>
                    {generatedHistory.map(item => renderGridItem(item, removeFromHistory))}
                </div>
            </div>
        </div>
    );
}
