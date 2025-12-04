import React, { useState } from 'react';
import { useStore, HistoryItem } from '@/core/store';
import { ImageGeneration } from '@/services/image/ImageGenerationService';
import { X, Image as ImageIcon, Sparkles, Loader2, Search } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import CreativeGallery from '../../creative/components/CreativeGallery';

interface FrameSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (image: HistoryItem) => void;
    target: 'firstFrame' | 'lastFrame';
}

export default function FrameSelectionModal({ isOpen, onClose, onSelect, target }: FrameSelectionModalProps) {
    const { currentProjectId, addToHistory } = useStore();
    const [activeTab, setActiveTab] = useState<'gallery' | 'generate'>('gallery');
    const [searchQuery, setSearchQuery] = useState('');
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const toast = useToast();

    if (!isOpen) return null;

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setIsGenerating(true);
        try {
            const results = await ImageGeneration.generateImages({
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
                addToHistory(newItem);
                onSelect(newItem);
                onClose();
            }
        } catch (e: unknown) {
            console.error("Frame Generation Error:", e);
            if (e instanceof Error) {
                toast.error(`Failed to generate frame: ${e.message}`);
            } else {
                toast.error("Failed to generate frame: An unknown error occurred.");
            }
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
                        onClick={() => setActiveTab('generate')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'generate' ? 'bg-purple-900/20 text-purple-400' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        <Sparkles size={16} /> Generate New
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden bg-[#0f0f0f] flex flex-col">

                    {/* Gallery Tab */}
                    {activeTab === 'gallery' && (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            <div className="p-4 border-b border-gray-800">
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
                            </div>
                            <CreativeGallery
                                compact={true}
                                onSelect={(item) => { onSelect(item); onClose(); }}
                                searchQuery={searchQuery}
                                className="bg-[#0f0f0f]"
                            />
                        </div>
                    )}

                    {/* Generate Tab */}
                    {activeTab === 'generate' && (
                        <div className="h-full flex flex-col items-center justify-center max-w-lg mx-auto text-center p-4">
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
