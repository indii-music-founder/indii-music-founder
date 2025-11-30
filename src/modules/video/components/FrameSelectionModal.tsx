import React, { useState, useRef } from 'react';
import { useStore, HistoryItem } from '@/core/store';
import { Image as ImageService } from '@/services/image/ImageService';
import { X, Upload, Image as ImageIcon, Sparkles, Loader2, Search } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';

interface FrameSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (image: HistoryItem) => void;
    target: 'firstFrame' | 'lastFrame';
}

export default function FrameSelectionModal({ isOpen, onClose, onSelect, target }: FrameSelectionModalProps) {
    const { generatedHistory, uploadedImages, addUploadedImage, currentProjectId } = useStore();
    const [activeTab, setActiveTab] = useState<'gallery' | 'upload' | 'generate'>('gallery');
    const [searchQuery, setSearchQuery] = useState('');
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const toast = useToast();

    if (!isOpen) return null;

    const allAssets = [...uploadedImages, ...generatedHistory].sort((a, b) => b.timestamp - a.timestamp);
    const filteredAssets = allAssets.filter(item =>
        !searchQuery || item.prompt?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            if (event.target?.result) {
                const newItem: HistoryItem = {
                    id: crypto.randomUUID(),
                    type: 'image',
                    url: event.target.result as string,
                    prompt: file.name,
                    timestamp: Date.now(),
                    projectId: currentProjectId
                };
                addUploadedImage(newItem);
                onSelect(newItem);
                onClose();
            }
        };
        reader.readAsDataURL(file);
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setIsGenerating(true);
        try {
            const results = await ImageService.generateImages({
                prompt: prompt,
                count: 1,
                resolution: '1K',
                aspectRatio: '16:9'
            });

            if (results.length > 0) {
                const newItem: HistoryItem = {
                    id: results[0].id,
                    type: 'image',
                    url: results[0].url,
                    prompt: results[0].prompt,
                    timestamp: Date.now(),
                    projectId: currentProjectId
                };
                // We don't necessarily add to main history here to avoid clutter, 
                // but for now let's just pass it to select.
                // Or maybe we should add it to history? Let's add it.
                useStore.getState().addToHistory(newItem);
                onSelect(newItem);
                onClose();
            }
        } catch (e) {
            console.error("Frame Generation Error:", e);
            toast.error("Failed to generate frame.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-[800px] max-w-[90vw] h-[600px] max-h-[90vh] bg-[#1a1a1a] border border-gray-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        Select {target === 'firstFrame' ? 'First' : 'Last'} Frame
                        <span className="text-xs font-normal text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                            {target === 'firstFrame' ? 'Start of Video' : 'End of Video'}
                        </span>
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 p-2 bg-[#111] border-b border-gray-800">
                    <button
                        onClick={() => setActiveTab('gallery')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'gallery' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        <ImageIcon size={16} /> Gallery
                    </button>
                    <button
                        onClick={() => setActiveTab('upload')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'upload' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        <Upload size={16} /> Upload
                    </button>
                    <button
                        onClick={() => setActiveTab('generate')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'generate' ? 'bg-purple-900/20 text-purple-400' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        <Sparkles size={16} /> Generate New
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[#0f0f0f]">

                    {/* Gallery Tab */}
                    {activeTab === 'gallery' && (
                        <div className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search assets..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:ring-1 focus:ring-purple-500 outline-none"
                                />
                            </div>

                            {filteredAssets.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                                    <ImageIcon size={48} className="mb-4 opacity-20" />
                                    <p>No assets found.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
                                    {filteredAssets.map(item => (
                                        <div
                                            key={item.id}
                                            onClick={() => { onSelect(item); onClose(); }}
                                            className="aspect-video bg-gray-800 rounded-lg overflow-hidden border border-transparent hover:border-purple-500 cursor-pointer group relative"
                                        >
                                            <img src={item.url} alt={item.prompt} className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <span className="text-white text-xs font-medium bg-purple-600 px-2 py-1 rounded">Select</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Upload Tab */}
                    {activeTab === 'upload' && (
                        <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-gray-700 rounded-xl hover:border-gray-500 transition-colors bg-[#1a1a1a] p-8">
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleFileUpload}
                            />
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="cursor-pointer flex flex-col items-center text-center"
                            >
                                <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4 text-purple-400">
                                    <Upload size={32} />
                                </div>
                                <h3 className="text-lg font-bold text-white mb-2">Upload an Image</h3>
                                <p className="text-gray-400 text-sm max-w-xs mb-6">
                                    Click to browse or drag and drop your image file here.
                                </p>
                                <button className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors">
                                    Browse Files
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Generate Tab */}
                    {activeTab === 'generate' && (
                        <div className="h-full flex flex-col items-center justify-center max-w-lg mx-auto text-center">
                            <div className="w-16 h-16 bg-purple-900/20 rounded-full flex items-center justify-center mb-4 text-purple-400">
                                <Sparkles size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">Generate a New Frame</h3>
                            <p className="text-gray-400 text-sm mb-6">
                                Describe the image you want to use as your {target === 'firstFrame' ? 'starting' : 'ending'} point.
                            </p>

                            <div className="w-full relative">
                                <textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="A cinematic shot of..."
                                    className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl p-4 text-white focus:ring-1 focus:ring-purple-500 outline-none resize-none h-32 mb-4"
                                />
                                <button
                                    onClick={handleGenerate}
                                    disabled={isGenerating || !prompt.trim()}
                                    className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                                >
                                    {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                                    Generate Frame
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
