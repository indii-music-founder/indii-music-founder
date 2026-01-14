import React, { useState } from 'react';
import { X, Sparkles, Loader2 } from 'lucide-react';
import { MerchCard } from './MerchCard';
import { MerchButton } from './MerchButton';
import { ImageGeneration } from '@/services/image/ImageGenerationService';
import { useToast } from '@/core/context/ToastContext';
import { useStore } from '@/core/store';

export interface AIGenerationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onImageGenerated: (url: string, name: string) => void;
}

export const AIGenerationDialog: React.FC<AIGenerationDialogProps> = ({
    isOpen,
    onClose,
    onImageGenerated
}) => {
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const toast = useToast();
    const { currentProjectId, addToHistory } = useStore();

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            toast.error('Please enter a prompt');
            return;
        }

        setIsGenerating(true);
        const loadingId = toast.loading('Generating image with AI...');

        try {
            const result = await ImageGeneration.generateImages({
                prompt: prompt.trim(),
                aspectRatio: '1:1',
                count: 1
            });

            if (result && result.length > 0) {
                const imageUrl = result[0].url;

                // Add to history
                if (currentProjectId) {
                    addToHistory({
                        id: result[0].id,
                        url: imageUrl,
                        prompt: prompt.trim(),
                        type: 'image',
                        timestamp: Date.now(),
                        projectId: currentProjectId
                    });
                }

                // Add to canvas
                onImageGenerated(imageUrl, `AI: ${prompt.substring(0, 30)}...`);

                toast.dismiss(loadingId);
                toast.success('Image generated successfully!');
                setPrompt('');
                onClose();
            } else {
                toast.dismiss(loadingId);
                toast.error('No image generated');
            }
        } catch (error) {
            console.error('AI generation error:', error);
            toast.dismiss(loadingId);
            toast.error('Failed to generate image');
        } finally {
            setIsGenerating(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <MerchCard className="w-full max-w-2xl mx-4 p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#FFE135]/10 flex items-center justify-center">
                            <Sparkles className="text-[#FFE135]" size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">AI Image Generation</h3>
                            <p className="text-xs text-neutral-400">Create custom graphics with AI</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isGenerating}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <X size={20} className="text-neutral-400" />
                    </button>
                </div>

                {/* Prompt Input */}
                <div className="mb-6">
                    <label className="text-sm font-medium text-white block mb-2">
                        Describe what you want to create
                    </label>
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g., A vibrant logo with a sunset theme, geometric patterns, and bold typography"
                        disabled={isGenerating}
                        rows={4}
                        className="w-full bg-neutral-900 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#FFE135] transition-colors resize-none disabled:opacity-50"
                    />
                    <p className="text-xs text-neutral-500 mt-2">
                        Be specific about colors, style, and composition for best results
                    </p>
                </div>

                {/* Examples */}
                <div className="mb-6">
                    <p className="text-xs font-medium text-neutral-400 mb-2">Quick Examples:</p>
                    <div className="flex flex-wrap gap-2">
                        {[
                            'Minimalist logo with mountain silhouette',
                            'Retro 80s style text effect',
                            'Abstract geometric pattern in neon colors',
                            'Hand-drawn vintage badge design'
                        ].map((example) => (
                            <button
                                key={example}
                                onClick={() => setPrompt(example)}
                                disabled={isGenerating}
                                className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-white/10 hover:border-[#FFE135]/50 rounded-full text-xs text-neutral-300 hover:text-white transition-all disabled:opacity-50"
                            >
                                {example}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isGenerating}
                        className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <MerchButton
                        onClick={handleGenerate}
                        disabled={isGenerating || !prompt.trim()}
                        glow={!isGenerating}
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="animate-spin" size={16} />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Sparkles size={16} />
                                Generate
                            </>
                        )}
                    </MerchButton>
                </div>
            </MerchCard>
        </div>
    );
};
