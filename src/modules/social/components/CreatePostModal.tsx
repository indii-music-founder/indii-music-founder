import React, { useState, useId } from 'react';
import { X, Calendar, Image as ImageIcon, Wand2, Loader2, ChevronDown } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { ScheduledPost, CampaignStatus, ImageAsset } from '../types';
import { SOCIAL_TOOLS } from '../tools';
import BrandAssetsDrawer from '../../creative/components/BrandAssetsDrawer';
import { ScheduledPostSchema } from '../schemas';

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

    // IDs for accessibility
    const copyInputId = useId();
    const dateInputId = useId();
    const timeInputId = useId();
    const modalTitleId = useId();
    const platformLabelId = useId();

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
        const timestamp = new Date(`${scheduledDate}T${scheduledTime}`).getTime();

        const newPostData = {
            id: Math.random().toString(36).substr(2, 9),
            platform,
            copy,
            imageAsset: selectedImage || undefined,
            day: new Date(scheduledDate).getDate(),
            scheduledTime: timestamp,
            status: CampaignStatus.PENDING,
            authorId: 'client-pending' // Will be overwritten by service
        };

        // Zod Validation (Client-Side)
        const validation = ScheduledPostSchema.safeParse(newPostData);

        if (!validation.success) {
            const errorMsg = validation.error.issues[0].message;
            toast.error(errorMsg);
            return;
        }

        // Pass validated data
        onSave(validation.data as ScheduledPost);
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby={modalTitleId}
        >
            <div className="bg-[#161b22] border border-gray-800 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-bg-dark">
                    <h2 id={modalTitleId} className="text-lg font-bold text-white flex items-center gap-2">
                        Create New Post
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 transition-colors"
                        aria-label="Close modal"
                    >
                        <X size={20} aria-hidden="true" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1">

                    {/* Platform Selection */}
                    <div role="group" aria-label="Select Platform">
                        <span className="block text-sm font-medium text-gray-400 mb-2" id={platformLabelId}>Platform</span>
                        <div className="flex gap-3" aria-labelledby={platformLabelId}>
                            {(['Twitter', 'Instagram', 'LinkedIn'] as const).map((p) => (
                                <button
                                    key={p}
                                    onClick={() => setPlatform(p)}
                                    aria-pressed={platform === p}
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
                            <label htmlFor={copyInputId} className="block text-sm font-medium text-gray-400">Post Copy</label>
                            <button
                                onClick={handleGenerateCopy}
                                disabled={isGenerating}
                                className="text-xs flex items-center gap-1.5 text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50"
                            >
                                {isGenerating ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Wand2 size={12} aria-hidden="true" />}
                                {isGenerating ? 'Generating...' : 'Generate with AI'}
                            </button>
                        </div>
                        <textarea
                            id={copyInputId}
                            value={copy}
                            onChange={(e) => setCopy(e.target.value)}
                            placeholder="What's on your mind?"
                            className="w-full h-32 bg-bg-dark border border-gray-700 rounded-lg p-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                        />
                    </div>

                    {/* Media Section */}
                    <div>
                        <span className="block text-sm font-medium text-gray-400 mb-2">Media</span>
                        {selectedImage ? (
                            <div className="relative group rounded-lg overflow-hidden border border-gray-700 inline-block">
                                <img src={selectedImage.imageUrl} alt={selectedImage.title || "Selected image"} className="h-40 w-auto object-cover" />
                                <button
                                    onClick={() => setSelectedImage(null)}
                                    className="absolute top-2 right-2 p-1 bg-black/60 hover:bg-red-500/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all focus:opacity-100"
                                    aria-label="Remove image"
                                >
                                    <X size={14} aria-hidden="true" />
                                </button>
                                <div className="absolute bottom-0 inset-x-0 bg-black/60 p-2 text-xs text-white truncate" aria-hidden="true">
                                    {selectedImage.title}
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsAssetDrawerOpen(true)}
                                className="w-full h-32 border-2 border-dashed border-gray-700 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-gray-500 hover:bg-gray-800/50 transition-all gap-2"
                                aria-label="Select media from Brand Assets"
                            >
                                <ImageIcon size={24} aria-hidden="true" />
                                <span className="text-sm">Select from Brand Assets</span>
                            </button>
                        )}
                    </div>

                    {/* Scheduling */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor={dateInputId} className="block text-sm font-medium text-gray-400 mb-2">Date</label>
                            <div className="relative">
                                <input
                                    id={dateInputId}
                                    type="date"
                                    value={scheduledDate}
                                    onChange={(e) => setScheduledDate(e.target.value)}
                                    className="w-full bg-bg-dark border border-gray-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                />
                                <Calendar className="absolute right-3 top-2.5 text-gray-500 pointer-events-none" size={16} aria-hidden="true" />
                            </div>
                        </div>
                        <div>
                            <label htmlFor={timeInputId} className="block text-sm font-medium text-gray-400 mb-2">Time</label>
                            <div className="relative">
                                <input
                                    id={timeInputId}
                                    type="time"
                                    value={scheduledTime}
                                    onChange={(e) => setScheduledTime(e.target.value)}
                                    className="w-full bg-bg-dark border border-gray-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                />
                                <ChevronDown className="absolute right-3 top-2.5 text-gray-500 pointer-events-none" size={16} aria-hidden="true" />
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
