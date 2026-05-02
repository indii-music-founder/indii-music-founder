import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Video, Image as ImageIcon, Sparkles, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useToast } from '@/core/context/ToastContext';
import { PromptImproverService } from '@/services/creative/PromptImproverService';

interface VideoPromptBuilderProps {
    prompt: string;
    onChange: (val: string) => void;
    onGenerate: () => void;
    disabled?: boolean;
    mode?: 'image' | 'video';
    children?: React.ReactNode;
}

export function VideoPromptBuilder({ prompt, onChange, onGenerate, disabled, mode = 'video', children }: VideoPromptBuilderProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const toast = useToast();
    const [isImproving, setIsImproving] = useState(false);
    const [builderTags, setBuilderTags] = useState<string[]>([]);

    // Auto-resize logic
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
    }, [prompt]);

    const handleImprove = useCallback(async () => {
        if (!prompt.trim() || disabled) return;

        setIsImproving(true);
        try {
            const result = await PromptImproverService.improve({
                rawPrompt: prompt,
                mode: mode
            });
            onChange(result.improved);
            setBuilderTags([]);
            toast.success(`Prompt improved: ${result.reasoning}`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to improve prompt');
        } finally {
            setIsImproving(false);
        }
    }, [prompt, mode, onChange, toast, disabled]);

    const handleRemoveBuilderTag = useCallback((index: number) => {
        const tagToRemove = builderTags[index];
        if (!tagToRemove) return;
        setBuilderTags(prev => prev.filter((_, i) => i !== index));
        const escaped = tagToRemove.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`,?\\s*${escaped}`, 'i');
        const next = prompt.replace(regex, '').replace(/^,\s*/, '').trim();
        onChange(next);
    }, [builderTags, prompt, onChange]);

    return (
        <div className="flex flex-col gap-2 w-full">
            {builderTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-1">
                    {builderTags.map((tag, index) => (
                        <span
                            key={`${tag}-${index}`}
                            className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 text-[10px] bg-purple-500/15 text-purple-300 border border-purple-500/30 rounded-md"
                        >
                            <span>{tag}</span>
                            <button
                                onClick={() => handleRemoveBuilderTag(index)}
                                disabled={disabled}
                                className="rounded-md hover:bg-purple-500/30 p-0.5 transition-colors shrink-0 disabled:opacity-50"
                            >
                                <X size={10} />
                            </button>
                        </span>
                    ))}
                </div>
            )}
            
            <div className="relative w-full group">
            <div className={`absolute inset-0 bg-gradient-to-r ${mode === 'image' ? 'from-dept-creative/10 to-dept-marketing/10' : 'from-purple-500/10 to-pink-500/10'} rounded-xl blur-sm opacity-0 group-focus-within:opacity-100 transition-opacity`} />
            <div className={`relative bg-white/5 border border-white/10 rounded-xl flex items-start gap-1 focus-within:border-${mode === 'image' ? 'dept-creative' : 'purple-500'}/50 focus-within:ring-1 focus-within:ring-${mode === 'image' ? 'dept-creative' : 'purple-500'}/20 transition-all z-10 p-2`}>
                <div className="pt-2 pl-1 text-muted-foreground flex-shrink-0">
                    {mode === 'image' ? <ImageIcon size={16} /> : <Video size={16} />}
                </div>
                <textarea
                    ref={textareaRef}
                    data-testid="direct-prompt-input"
                    value={prompt}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (!disabled && prompt.trim()) {
                                onGenerate();
                            }
                        }
                    }}
                    placeholder={mode === 'image' ? "Describe your image..." : "Describe your video... (Be detailed about cinematic motion, subjects, and style)"}
                    disabled={disabled}
                    className="flex-1 bg-transparent border-none text-sm px-2 py-2 focus:outline-none resize-none min-h-[44px] max-h-[200px]"
                    rows={1}
                />
                {children && (
                    <div className="flex items-center gap-2 pr-2 pt-1 flex-shrink-0">
                        <button
                            onClick={handleImprove}
                            disabled={isImproving || !prompt.trim() || disabled}
                            title="Improve with AI"
                            className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-purple-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isImproving ? (
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                >
                                    <Sparkles size={16} />
                                </motion.div>
                            ) : (
                                <Sparkles size={16} />
                            )}
                        </button>
                        {children}
                    </div>
                )}
            </div>
        </div>
        </div>
    );
}
