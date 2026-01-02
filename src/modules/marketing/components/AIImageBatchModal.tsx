import React, { useState, useEffect } from 'react';
import { X, ImageIcon, Loader2, Check, AlertCircle, RefreshCw, Play, Pause } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { CampaignAI } from '@/services/marketing/CampaignAIService';
import { CampaignAsset, ScheduledPost, BatchImageProgress } from '../types';

interface AIImageBatchModalProps {
    campaign: CampaignAsset;
    onClose: () => void;
    onComplete: (updatedCampaign: CampaignAsset) => void;
}

type PostImageStatus = 'pending' | 'generating' | 'complete' | 'error' | 'skipped';

interface PostImageState {
    post: ScheduledPost;
    status: PostImageStatus;
    imageUrl?: string;
}

export default function AIImageBatchModal({ campaign, onClose, onComplete }: AIImageBatchModalProps) {
    const toast = useToast();

    // State
    const [postStates, setPostStates] = useState<PostImageState[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [progress, setProgress] = useState<BatchImageProgress | null>(null);

    // Initialize post states
    useEffect(() => {
        const states: PostImageState[] = campaign.posts.map(post => ({
            post,
            status: post.imageAsset.imageUrl ? 'skipped' : 'pending',
            imageUrl: post.imageAsset.imageUrl || undefined
        }));
        setPostStates(states);
    }, [campaign]);

    const pendingCount = postStates.filter(s => s.status === 'pending').length;
    const completedCount = postStates.filter(s => s.status === 'complete').length;
    const errorCount = postStates.filter(s => s.status === 'error').length;
    const skippedCount = postStates.filter(s => s.status === 'skipped').length;

    const handleStartGeneration = async () => {
        const postsToGenerate = postStates.filter(s => s.status === 'pending').map(s => s.post);

        if (postsToGenerate.length === 0) {
            toast.info('All posts already have images');
            return;
        }

        setIsGenerating(true);
        setIsPaused(false);

        try {
            const updatedPosts = await CampaignAI.generatePostImages(
                postsToGenerate,
                (progressUpdate) => {
                    setProgress(progressUpdate);
                    setCurrentIndex(progressUpdate.current);

                    // Update individual post status
                    setPostStates(prev => prev.map(state => {
                        if (state.post.id === progressUpdate.currentPostId) {
                            return {
                                ...state,
                                status: progressUpdate.status === 'complete' ? 'complete' : 'generating'
                            };
                        }
                        return state;
                    }));
                }
            );

            // Update states with results
            setPostStates(prev => prev.map(state => {
                const updated = updatedPosts.find(p => p.id === state.post.id);
                if (updated && updated.imageAsset.imageUrl) {
                    return {
                        ...state,
                        status: 'complete',
                        imageUrl: updated.imageAsset.imageUrl
                    };
                }
                if (state.status === 'generating') {
                    return { ...state, status: 'error' };
                }
                return state;
            }));

            toast.success(`Generated ${updatedPosts.filter(p => p.imageAsset.imageUrl).length} images!`);
        } catch (error) {
            console.error('Batch generation failed:', error);
            toast.error('Image generation failed. Some images may not have been generated.');
        } finally {
            setIsGenerating(false);
            setProgress(null);
        }
    };

    const handleRetryFailed = async () => {
        const failedPosts = postStates.filter(s => s.status === 'error').map(s => s.post);

        if (failedPosts.length === 0) return;

        // Reset failed posts to pending
        setPostStates(prev => prev.map(state =>
            state.status === 'error' ? { ...state, status: 'pending' } : state
        ));

        // Start generation again
        handleStartGeneration();
    };

    const handleRegenerate = async (postId: string) => {
        const postState = postStates.find(s => s.post.id === postId);
        if (!postState) return;

        // Set to generating
        setPostStates(prev => prev.map(state =>
            state.post.id === postId ? { ...state, status: 'generating' } : state
        ));

        try {
            const imageUrl = await CampaignAI.generateSingleImage(postState.post);

            setPostStates(prev => prev.map(state =>
                state.post.id === postId
                    ? { ...state, status: imageUrl ? 'complete' : 'error', imageUrl: imageUrl || undefined }
                    : state
            ));

            if (imageUrl) {
                toast.success('Image regenerated!');
            } else {
                toast.error('Failed to regenerate image');
            }
        } catch (error) {
            setPostStates(prev => prev.map(state =>
                state.post.id === postId ? { ...state, status: 'error' } : state
            ));
            toast.error('Failed to regenerate image');
        }
    };

    const handleApply = () => {
        const updatedPosts = campaign.posts.map(post => {
            const state = postStates.find(s => s.post.id === post.id);
            if (state?.imageUrl) {
                return {
                    ...post,
                    imageAsset: {
                        ...post.imageAsset,
                        imageUrl: state.imageUrl
                    }
                };
            }
            return post;
        });

        onComplete({
            ...campaign,
            posts: updatedPosts
        });
        onClose();
    };

    const progressPercent = progress
        ? Math.round((progress.current / progress.total) * 100)
        : 0;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#161b22] border border-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg">
                            <ImageIcon className="text-white" size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Generate Campaign Images</h2>
                            <p className="text-sm text-gray-500">
                                {pendingCount} posts need images
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                        disabled={isGenerating}
                    >
                        <X className="text-gray-400" size={20} />
                    </button>
                </div>

                {/* Progress Bar */}
                {isGenerating && progress && (
                    <div className="px-6 py-3 border-b border-gray-800 bg-[#0d1117]">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-400">
                                Generating {progress.current} of {progress.total}...
                            </span>
                            <span className="text-sm font-mono text-green-400">{progressPercent}%</span>
                        </div>
                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-300"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Stats */}
                <div className="px-6 py-3 border-b border-gray-800 flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gray-600" />
                        <span className="text-gray-400">Pending: {pendingCount}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <span className="text-gray-400">Complete: {completedCount}</span>
                    </div>
                    {errorCount > 0 && (
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500" />
                            <span className="text-gray-400">Failed: {errorCount}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        <span className="text-gray-400">Skipped: {skippedCount}</span>
                    </div>
                </div>

                {/* Content - Post Grid */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {postStates.map((state, index) => (
                            <div
                                key={state.post.id}
                                className={`relative aspect-square bg-[#0d1117] border rounded-lg overflow-hidden group ${state.status === 'complete' || state.status === 'skipped'
                                    ? 'border-gray-700'
                                    : state.status === 'error'
                                        ? 'border-red-500/50'
                                        : state.status === 'generating'
                                            ? 'border-green-500/50'
                                            : 'border-gray-800'
                                    }`}
                            >
                                {/* Image or Placeholder */}
                                {state.imageUrl ? (
                                    <img
                                        src={state.imageUrl}
                                        alt={`Post ${index + 1}`}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        {state.status === 'generating' ? (
                                            <Loader2 className="animate-spin text-green-400" size={24} />
                                        ) : state.status === 'error' ? (
                                            <AlertCircle className="text-red-400" size={24} />
                                        ) : (
                                            <ImageIcon className="text-gray-600" size={24} />
                                        )}
                                    </div>
                                )}

                                {/* Status Badge */}
                                <div className="absolute top-2 left-2">
                                    <span className={`text-xs px-2 py-1 rounded ${state.status === 'complete' ? 'bg-green-900/80 text-green-300' :
                                        state.status === 'skipped' ? 'bg-blue-900/80 text-blue-300' :
                                            state.status === 'error' ? 'bg-red-900/80 text-red-300' :
                                                state.status === 'generating' ? 'bg-green-900/80 text-green-300' :
                                                    'bg-gray-800/80 text-gray-400'
                                        }`}>
                                        {state.status === 'generating' ? 'Generating...' :
                                            state.status === 'skipped' ? 'Has Image' :
                                                state.status.charAt(0).toUpperCase() + state.status.slice(1)}
                                    </span>
                                </div>

                                {/* Platform Badge */}
                                <div className="absolute top-2 right-2">
                                    <span className={`text-xs px-2 py-1 rounded ${state.post.platform === 'Instagram' ? 'bg-pink-900/80 text-pink-300' :
                                        state.post.platform === 'Twitter' ? 'bg-blue-900/80 text-blue-300' :
                                            'bg-indigo-900/80 text-indigo-300'
                                        }`}>
                                        {state.post.platform}
                                    </span>
                                </div>

                                {/* Day Badge */}
                                <div className="absolute bottom-2 left-2">
                                    <span className="text-xs bg-black/60 px-2 py-1 rounded text-gray-300">
                                        Day {state.post.day}
                                    </span>
                                </div>

                                {/* Regenerate Button (on hover) */}
                                {(state.status === 'complete' || state.status === 'error' || state.status === 'skipped') && !isGenerating && (
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <button
                                            onClick={() => handleRegenerate(state.post.id)}
                                            className="p-2 bg-white rounded-full hover:scale-110 transition-transform"
                                        >
                                            <RefreshCw className="text-black" size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t border-gray-800 bg-[#0d1117]">
                    <div className="flex items-center gap-2">
                        {errorCount > 0 && !isGenerating && (
                            <button
                                onClick={handleRetryFailed}
                                className="px-4 py-2 text-red-400 hover:text-red-300 transition-colors flex items-center gap-2"
                            >
                                <RefreshCw size={16} />
                                Retry Failed ({errorCount})
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                            disabled={isGenerating}
                        >
                            Cancel
                        </button>
                        {!isGenerating && pendingCount > 0 && (
                            <button
                                onClick={handleStartGeneration}
                                className="px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold rounded-lg transition-all flex items-center gap-2"
                            >
                                <Play size={16} />
                                Generate {pendingCount} Images
                            </button>
                        )}
                        {(completedCount > 0 || skippedCount > 0) && !isGenerating && (
                            <button
                                onClick={handleApply}
                                className="px-6 py-2 bg-white hover:bg-gray-200 text-black font-bold rounded-lg transition-colors flex items-center gap-2"
                            >
                                <Check size={16} />
                                Apply & Save
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
