import React, { useState } from 'react';
import { X, Calendar, Image as ImageIcon, Wand2, Loader2, ChevronDown } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { ScheduledPost, CampaignStatus, ImageAsset } from '../types';
import { SOCIAL_TOOLS } from '../tools';
import BrandAssetsDrawer from '../../creative/components/BrandAssetsDrawer';

interface CreatePostModalProps {
    onClose: () => void;
    onSave: (post: ScheduledPost) => void;
}

export default function CreatePostModal({ onClose, onSave }: CreatePostModalProps) {
    const toast = useToast();
    const [platform, setPlatform] = useState<'Twitter' | 'Instagram' | 'LinkedIn'>('Twitter');
    const [copy, setCopy] = useState('');
    const [selectedImage, setSelectedImage] = useState<ImageAsset | null>(null);
    const [scheduledDate, setScheduledDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [scheduledTime, setScheduledTime] = useState<string>('12:00');

    const [isGenerating, setIsGenerating] = useState(false);
    const [isAssetDrawerOpen, setIsAssetDrawerOpen] = useState(false);

    const handleGenerateCopy = async () => {
        setIsGenerating(true);
        try {
            const generatedCopy = await SOCIAL_TOOLS.write_social_copy({
                platform,
                topic: copy || "New product launch", // Fallback topic if empty
                tone: "Professional yet exciting"
            });
            setCopy(generatedCopy);
            toast.success("Copy generated!");
        } catch (error) {
            toast.error("Failed to generate copy");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = () => {
        if (!copy) {
            toast.error("Please enter some copy for the post");
            return;
        }

        const newPost: ScheduledPost = {
            id: Math.random().toString(36).substr(2, 9),
            platform,
            copy,
            imageAsset: selectedImage || {
                assetType: 'image',
                title: 'Placeholder',
                imageUrl: '',
                caption: ''
            },
            day: new Date(scheduledDate).getDate(), // Simplified day logic
            scheduledTime: new Date(`${scheduledDate}T${scheduledTime}`),
            status: CampaignStatus.PENDING
        };

        onSave(newPost);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#161b22] border border-gray-800 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-bg-dark">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        Create New Post
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1">

                    {/* Platform Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Platform</label>
                        <div className="flex gap-3">
                            {(['Twitter', 'Instagram', 'LinkedIn'] as const).map((p) => (
                                <button
                                    key={p}
                                    onClick={() => setPlatform(p)}
                                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${platform === p
                                        ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20'
                                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-750'
                                        }`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Copy Section */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="block text-sm font-medium text-gray-400">Post Copy</label>
                            <button
                                onClick={handleGenerateCopy}
                                disabled={isGenerating}
                                className="text-xs flex items-center gap-1.5 text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50"
                            >
                                {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                                {isGenerating ? 'Generating...' : 'Generate with AI'}
                            </button>
                        </div>
                        <textarea
                            value={copy}
                            onChange={(e) => setCopy(e.target.value)}
                            placeholder="What's on your mind?"
                            className="w-full h-32 bg-bg-dark border border-gray-700 rounded-lg p-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                        />
                    </div>

                    {/* Media Section */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Media</label>
                        {selectedImage ? (
                            <div className="relative group rounded-lg overflow-hidden border border-gray-700 inline-block">
                                <img src={selectedImage.imageUrl} alt="Selected" className="h-40 w-auto object-cover" />
                                <button
                                    onClick={() => setSelectedImage(null)}
                                    className="absolute top-2 right-2 p-1 bg-black/60 hover:bg-red-500/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <X size={14} />
                                </button>
                                <div className="absolute bottom-0 inset-x-0 bg-black/60 p-2 text-xs text-white truncate">
                                    {selectedImage.title}
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsAssetDrawerOpen(true)}
                                className="w-full h-32 border-2 border-dashed border-gray-700 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-gray-500 hover:bg-gray-800/50 transition-all gap-2"
                            >
                                <ImageIcon size={24} />
                                <span className="text-sm">Select from Brand Assets</span>
                            </button>
                        )}
                    </div>

                    {/* Scheduling */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Date</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={scheduledDate}
                                    onChange={(e) => setScheduledDate(e.target.value)}
                                    className="w-full bg-bg-dark border border-gray-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                />
                                <Calendar className="absolute right-3 top-2.5 text-gray-500 pointer-events-none" size={16} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Time</label>
                            <div className="relative">
                                <input
                                    type="time"
                                    value={scheduledTime}
                                    onChange={(e) => setScheduledTime(e.target.value)}
                                    className="w-full bg-bg-dark border border-gray-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                />
                                <ChevronDown className="absolute right-3 top-2.5 text-gray-500 pointer-events-none" size={16} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-800 bg-bg-dark flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg transition-colors shadow-lg shadow-blue-900/20"
                    >
                        Schedule Post
                    </button>
                </div>
            </div>

            {/* Brand Assets Drawer Integration */}
            {isAssetDrawerOpen && (
                <BrandAssetsDrawer
                    onClose={() => setIsAssetDrawerOpen(false)}
                    onSelect={(asset) => {
                        // Adapt the asset to ImageAsset type if needed, assuming compatibility for now
                        setSelectedImage({
                            assetType: 'image',
                            title: asset.name || 'Untitled',
                            imageUrl: asset.url,
                            caption: ''
                        });
                        setIsAssetDrawerOpen(false);
                    }}
                />
            )}
        </div>
    );
}
