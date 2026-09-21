import { useTranslation } from 'react-i18next';
import React, { useState, useId } from 'react';
import { X, Calendar, Image as ImageIcon, Wand2, Loader2, ChevronDown } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { ScheduledPost, CampaignStatus, ImageAsset } from '../types';
import { SOCIAL_TOOLS } from '../tools';
import BrandAssetsDrawer from '../../creative/components/BrandAssetsDrawer';
import { ScheduledPostSchema } from '../schemas';
import { useModalAccessibility } from '@/hooks/useModalAccessibility';
import { buildInstagramFeedPayload, instagramCaptionLength, isPublishableMediaUrl } from '../instagramComposer';
import { resolveStorageUrl } from '@/services/storage/resolveStorageUrl';

const PLATFORM_LIMITS = {
    Twitter: 280,
    Instagram: 2200
};

function measureImage(url: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => reject(new Error('Could not read the selected image dimensions.'));
        image.src = url;
    });
}

interface CreatePostModalProps {
    onClose: () => void;
    onSave: (post: ScheduledPost) => Promise<boolean>;
    initialScheduledDate?: string;
}

export default function CreatePostModal({ onClose, onSave, initialScheduledDate }: CreatePostModalProps) {
    const dialogRef = useModalAccessibility(true, onClose);
    const { t } = useTranslation();
    const toast = useToast();
    const defaultFutureTime = () => {
        const d = new Date(Date.now() + 60 * 60 * 1000);
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(Math.floor(d.getMinutes() / 5) * 5).padStart(2, '0');
        return `${hours}:${minutes}`;
    };

    const [platform, setPlatform] = useState<'Twitter' | 'Instagram'>('Twitter');
    const [copy, setCopy] = useState('');
    const [hashtagInput, setHashtagInput] = useState('');
    const [selectedImage, setSelectedImage] = useState<ImageAsset | null>(null);
    const [imageUrlInput, setImageUrlInput] = useState('');
    const [showUrlInput, setShowUrlInput] = useState(false);
    const [scheduledDate, setScheduledDate] = useState<string>(initialScheduledDate || new Date().toLocaleDateString('sv-SE'));
    const [scheduledTime, setScheduledTime] = useState<string>(defaultFutureTime);

    const [isGenerating, setIsGenerating] = useState(false);
    const [isAssetDrawerOpen, setIsAssetDrawerOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // IDs for accessibility
    const copyInputId = useId();
    const characterCountId = useId();
    const dateInputId = useId();
    const timeInputId = useId();
    const modalTitleId = useId();
    const platformLabelId = useId();

    const charLimit = PLATFORM_LIMITS[platform];
    const currentLength = platform === 'Instagram' ? instagramCaptionLength(copy, hashtagInput) : copy.length;
    const isOverLimit = currentLength > charLimit;
    const isApproachingLimit = currentLength > charLimit * 0.9;

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
        } catch (_error: unknown) {
            toast.error("Failed to generate copy");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleApplyUrl = async () => {
        const trimmed = imageUrlInput.trim();
        if (!trimmed) return;
        try {
            new URL(trimmed);
            const dimensions = await measureImage(trimmed);
            setSelectedImage({
                assetType: 'image',
                title: 'Attached Media',
                imageUrl: trimmed,
                caption: '',
                ...dimensions,
            });
            setImageUrlInput('');
            setShowUrlInput(false);
        } catch {
            toast.error('Please enter a valid image URL with readable dimensions');
        }
    };

    const handleSave = async () => {
        if (isOverLimit) {
            toast.error(`Post exceeds character limit for ${platform}`);
            return;
        }

        if (platform === 'Instagram' && (!selectedImage?.imageUrl || !selectedImage.width || !selectedImage.height)) {
            toast.error('Instagram posts require an image with verified dimensions');
            return;
        }

        const timestamp = new Date(`${scheduledDate}T${scheduledTime}`).getTime();

        // Validate timestamp is finite and in future
        if (!Number.isFinite(timestamp)) {
            toast.error('Invalid date or time selected');
            return;
        }

        if (timestamp <= Date.now()) {
            toast.error('Post must be scheduled for a future time');
            return;
        }

        let instagramPayload: import('@indii/shared').InstagramPublishingPayload | undefined;
        if (platform === 'Instagram') {
            try {
                instagramPayload = buildInstagramFeedPayload(copy, hashtagInput, {
                    publishUrl: selectedImage!.imageUrl,
                    width: selectedImage!.width!,
                    height: selectedImage!.height!,
                });
            } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Instagram publishing details are invalid.');
                return;
            }
        }

        const newPostData = {
            id: crypto.randomUUID(),
            platform,
            copy,
            imageAsset: selectedImage || undefined,
            day: new Date(scheduledDate).getDate(),
            scheduledTime: timestamp,
            status: CampaignStatus.PENDING,
            authorId: 'client-pending', // Will be overwritten by service
            instagramPayload
        };

        // Zod Validation (Client-Side)
        const validation = ScheduledPostSchema.safeParse(newPostData);

        if (!validation.success) {
            const errorMsg = validation.error.issues[0]!.message;
            toast.error(errorMsg);
            return;
        }

        // Pass validated data
        setIsSaving(true);
        try {
            if (await onSave(validation.data as unknown as ScheduledPost)) onClose();
            else toast.error('Could not schedule this post. Your draft is still available.');
        } catch {
            toast.error('Could not schedule this post. Your draft is still available.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div
            ref={dialogRef}
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
                            {(['Twitter', 'Instagram'] as const).map((p) => (
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

                    {platform === 'Instagram' && (
                        <div className="space-y-2">
                            <label htmlFor="instagram-hashtags" className="block text-sm font-medium text-gray-400">
                                Feed hashtags <span className="text-amber-400 font-normal text-xs">(3–5 specific tags)</span>
                            </label>
                            <input
                                id="instagram-hashtags"
                                value={hashtagInput}
                                onChange={(event) => setHashtagInput(event.target.value)}
                                placeholder="#detroitindie #synthpop #newrelease"
                                className="w-full bg-bg-dark border border-gray-700 rounded-lg p-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                            />
                            <p className="text-xs text-gray-500">These are validated and appended at the end of the published caption.</p>
                        </div>
                    )}

                    {/* Copy Section */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label htmlFor={copyInputId} className="block text-sm font-medium text-gray-400">Post Copy</label>
                            <button
                                onClick={handleGenerateCopy}
                                disabled={isGenerating}
                                className="text-xs flex items-center gap-1.5 text-green-400 hover:text-green-300 transition-colors disabled:opacity-50"
                            >
                                {isGenerating ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Wand2 size={12} aria-hidden="true" />}
                                {isGenerating ? 'Generating...' : 'Generate with AI'}
                            </button>
                        </div>
                        <textarea
                            id={copyInputId}
                            value={copy}
                            onChange={(e) => setCopy(e.target.value)}
                            placeholder={t('social.hints.social_post_desc')}
                            aria-describedby={characterCountId}
                            className={`w-full h-32 bg-bg-dark border rounded-lg p-3 text-white placeholder-gray-600 focus:outline-none transition-colors resize-none ${isOverLimit
                                ? 'border-red-500 focus:border-red-500'
                                : 'border-gray-700 focus:border-blue-500'
                                }`}
                        />
                        <div className="flex justify-end">
                            <span
                                id={characterCountId}
                                className={`text-xs font-medium transition-colors ${isOverLimit
                                    ? 'text-red-500'
                                    : isApproachingLimit
                                        ? 'text-yellow-500'
                                        : 'text-gray-500'
                                    }`}
                                aria-live="polite"
                            >
                                {currentLength} / {charLimit} characters
                            </span>
                        </div>
                    </div>

                    {/* Media Section */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="block text-sm font-medium text-gray-400">
                                Media {platform === 'Instagram' && <span className="text-amber-400 font-normal text-xs">(Required for Instagram)</span>}
                            </span>
                            {!selectedImage && (
                                <button
                                    type="button"
                                    onClick={() => setShowUrlInput(!showUrlInput)}
                                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                    {showUrlInput ? 'Pick from Assets' : 'Paste Image URL'}
                                </button>
                            )}
                        </div>

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
                        ) : showUrlInput ? (
                            <div className="flex gap-2">
                                <input
                                    type="url"
                                    value={imageUrlInput}
                                    onChange={(e) => setImageUrlInput(e.target.value)}
                                    placeholder="https://.../image.jpg"
                                    className="flex-1 bg-bg-dark border border-gray-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleApplyUrl(); } }}
                                />
                                <button
                                    type="button"
                                    onClick={handleApplyUrl}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-colors"
                                >
                                    Attach
                                </button>
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
                        disabled={isOverLimit || isSaving}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg transition-colors shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Schedule Post
                    </button>
                </div>
            </div>

            {/* Brand Assets Drawer Integration */}
            {isAssetDrawerOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
                    <BrandAssetsDrawer
                        className="relative w-full max-w-md bg-[#1a1a1a] border border-gray-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in duration-150"
                        onClose={() => setIsAssetDrawerOpen(false)}
                        onSelect={async (asset) => {
                            // Adapt the asset to ImageAsset type if needed, assuming compatibility for now
                            try {
                                const publishUrl = await resolveStorageUrl(asset.storageUri || asset.url);
                                if (!isPublishableMediaUrl(publishUrl)) {
                                    throw new Error('This asset has not finished syncing to publishable storage.');
                                }
                                const dimensions = await measureImage(publishUrl);
                                setSelectedImage({
                                    assetType: 'image',
                                    title: asset.description || 'Untitled',
                                    imageUrl: publishUrl,
                                    storageUri: asset.storageUri,
                                    caption: '',
                                    ...dimensions,
                                });
                                setIsAssetDrawerOpen(false);
                            } catch (error) {
                                toast.error(error instanceof Error ? error.message : 'Could not read the selected image dimensions.');
                            }
                        }}
                    />
                </div>
            )}
        </div>
    );
}
