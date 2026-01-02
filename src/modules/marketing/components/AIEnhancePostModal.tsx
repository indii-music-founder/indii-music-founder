import React, { useState } from 'react';
import { X, Wand2, Loader2, ArrowRight, Copy, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { CampaignAI } from '@/services/marketing/CampaignAIService';
import { ScheduledPost, PostEnhancement, EnhancementType } from '../types';

interface AIEnhancePostModalProps {
    post: ScheduledPost;
    onClose: () => void;
    onApply: (postId: string, newCopy: string) => void;
}

const ENHANCEMENT_TYPES: { id: EnhancementType; label: string; description: string; icon: string }[] = [
    { id: 'improve', label: 'Improve', description: 'Make it more engaging', icon: '✨' },
    { id: 'shorter', label: 'Shorter', description: 'More concise version', icon: '📝' },
    { id: 'longer', label: 'Longer', description: 'Add more detail', icon: '📖' },
    { id: 'different_tone', label: 'Different Tone', description: 'Fresh perspective', icon: '🎭' }
];

export default function AIEnhancePostModal({ post, onClose, onApply }: AIEnhancePostModalProps) {
    const toast = useToast();

    // State
    const [enhancementType, setEnhancementType] = useState<EnhancementType>('improve');
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [enhancement, setEnhancement] = useState<PostEnhancement | null>(null);
    const [selectedVersion, setSelectedVersion] = useState<'enhanced' | number>('enhanced');
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    const handleEnhance = async () => {
        setIsEnhancing(true);
        setEnhancement(null);
        setSelectedVersion('enhanced');

        try {
            const result = await CampaignAI.enhancePostCopy(post, enhancementType);
            setEnhancement(result);
            toast.success('Post enhanced!');
        } catch (error) {
            console.error('Enhancement failed:', error);
            toast.error('Failed to enhance post. Please try again.');
        } finally {
            setIsEnhancing(false);
        }
    };

    const getSelectedCopy = (): string => {
        if (!enhancement) return post.copy;
        if (selectedVersion === 'enhanced') return enhancement.enhancedCopy;
        return enhancement.alternativeVersions[selectedVersion] || enhancement.enhancedCopy;
    };

    const handleCopy = (text: string, index: number) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        toast.success('Copied to clipboard!');
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const handleApply = () => {
        const newCopy = getSelectedCopy();
        if (enhancement?.suggestedHashtags && enhancement.suggestedHashtags.length > 0) {
            onApply(post.id, newCopy + '\n\n' + enhancement.suggestedHashtags.join(' '));
        } else {
            onApply(post.id, newCopy);
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#161b22] border border-gray-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg">
                            <Wand2 className="text-white" size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Enhance Post Copy</h2>
                            <p className="text-sm text-gray-500">Use AI to improve your post</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <X className="text-gray-400" size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Original Copy */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs text-gray-500 uppercase font-semibold">
                                Original ({post.platform})
                            </label>
                            <span className="text-xs text-gray-600">{post.copy.length} chars</span>
                        </div>
                        <div className="bg-[#0d1117] border border-gray-800 rounded-lg p-4">
                            <p className="text-sm text-gray-400 whitespace-pre-wrap">{post.copy}</p>
                        </div>
                    </div>

                    {/* Enhancement Type Selector */}
                    {!enhancement && (
                        <div>
                            <label className="block text-xs text-gray-500 uppercase font-semibold mb-3">
                                Enhancement Type
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {ENHANCEMENT_TYPES.map(type => (
                                    <button
                                        key={type.id}
                                        onClick={() => setEnhancementType(type.id)}
                                        className={`p-3 rounded-lg text-left transition-all ${enhancementType === type.id
                                            ? 'bg-blue-900/30 border border-blue-500/50'
                                            : 'bg-[#0d1117] border border-gray-800 hover:border-gray-600'
                                            }`}
                                    >
                                        <div className="text-lg mb-1">{type.icon}</div>
                                        <div className={`text-sm font-medium ${enhancementType === type.id ? 'text-blue-200' : 'text-gray-300'}`}>
                                            {type.label}
                                        </div>
                                        <div className="text-xs text-gray-500">{type.description}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Enhanced Copy Preview */}
                    {enhancement && (
                        <>
                            {/* Enhanced Version */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs text-gray-500 uppercase font-semibold flex items-center gap-2">
                                        <ArrowRight size={14} /> Enhanced Version
                                    </label>
                                    <button
                                        onClick={() => handleCopy(enhancement.enhancedCopy, -1)}
                                        className="text-xs text-gray-500 hover:text-white flex items-center gap-1"
                                    >
                                        {copiedIndex === -1 ? <Check size={12} /> : <Copy size={12} />}
                                        Copy
                                    </button>
                                </div>
                                <button
                                    onClick={() => setSelectedVersion('enhanced')}
                                    className={`w-full text-left bg-[#0d1117] border rounded-lg p-4 transition-all ${selectedVersion === 'enhanced'
                                        ? 'border-blue-500/50 ring-1 ring-blue-500/20'
                                        : 'border-gray-800 hover:border-gray-600'
                                        }`}
                                >
                                    <p className="text-sm text-gray-200 whitespace-pre-wrap">{enhancement.enhancedCopy}</p>
                                    <span className="text-xs text-gray-500 mt-2 inline-block">{enhancement.enhancedCopy.length} chars</span>
                                </button>
                            </div>

                            {/* Alternative Versions */}
                            {enhancement.alternativeVersions.length > 0 && (
                                <div>
                                    <label className="block text-xs text-gray-500 uppercase font-semibold mb-2">
                                        Alternative Versions
                                    </label>
                                    <div className="space-y-2">
                                        {enhancement.alternativeVersions.map((alt, index) => (
                                            <button
                                                key={index}
                                                onClick={() => setSelectedVersion(index)}
                                                className={`w-full text-left bg-[#0d1117] border rounded-lg p-4 transition-all ${selectedVersion === index
                                                    ? 'border-blue-500/50 ring-1 ring-blue-500/20'
                                                    : 'border-gray-800 hover:border-gray-600'
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className="text-sm text-gray-300 whitespace-pre-wrap flex-1">{alt}</p>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleCopy(alt, index);
                                                        }}
                                                        className="text-gray-500 hover:text-white flex-shrink-0"
                                                    >
                                                        {copiedIndex === index ? <Check size={14} /> : <Copy size={14} />}
                                                    </button>
                                                </div>
                                                <span className="text-xs text-gray-500 mt-2 inline-block">{alt.length} chars</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Suggested Hashtags */}
                            {enhancement.suggestedHashtags.length > 0 && (
                                <div>
                                    <label className="block text-xs text-gray-500 uppercase font-semibold mb-2">
                                        Suggested Hashtags
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {enhancement.suggestedHashtags.map((tag, index) => (
                                            <span
                                                key={index}
                                                className="text-sm text-blue-400 bg-blue-900/20 px-3 py-1 rounded-full"
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Tone Analysis */}
                            {enhancement.toneAnalysis && (
                                <div className="bg-[#0d1117] border border-gray-800 rounded-lg p-4">
                                    <label className="block text-xs text-gray-500 uppercase font-semibold mb-2">
                                        Tone Analysis
                                    </label>
                                    <p className="text-sm text-gray-400">{enhancement.toneAnalysis}</p>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t border-gray-800 bg-[#0d1117]">
                    {enhancement ? (
                        <>
                            <button
                                onClick={() => {
                                    setEnhancement(null);
                                    setSelectedVersion('enhanced');
                                }}
                                className="px-4 py-2 text-gray-400 hover:text-white transition-colors flex items-center gap-2"
                            >
                                <ChevronLeft size={16} />
                                Try Different Type
                            </button>
                            <button
                                onClick={handleApply}
                                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold rounded-lg transition-all flex items-center gap-2"
                            >
                                <Check size={16} />
                                Apply Selected
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleEnhance}
                                disabled={isEnhancing}
                                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isEnhancing ? (
                                    <>
                                        <Loader2 className="animate-spin" size={16} />
                                        Enhancing...
                                    </>
                                ) : (
                                    <>
                                        <Wand2 size={16} />
                                        Enhance Copy
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
