import React, { useRef, useEffect, useState, useCallback, useMemo, useId, memo } from 'react';
import { createPortal } from 'react-dom';
import { Video, Image as ImageIcon, Sparkles, X, ChevronDown, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '@/core/context/ToastContext';
import { PromptImproverService } from '@/services/creative/PromptImproverService';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { STUDIO_TAGS } from '@/modules/creative/constants';

const TagButton = memo(({ tag, onClick, variant = 'creative' }: { tag: string; onClick: () => void; variant?: 'creative' | 'royalties' }) => (
    <button
        onClick={onClick}
        role="menuitem"
        data-testid={`tag-${tag}-btn`}
        className={`px-2 py-1 text-[10px] bg-background/40 hover:${variant === 'royalties' ? 'bg-dept-royalties/20' : 'bg-purple-500/20'} text-gray-300 hover:text-white rounded border border-white/5 hover:border-${variant === 'royalties' ? 'dept-royalties' : 'purple-500'}/50 transition-colors text-left backdrop-blur-sm`}
    >
        {tag}
    </button>
));
TagButton.displayName = 'TagButton';

const CategoryDropdown = memo(({ category, values, isOpen, onToggle, onTagClick, variant = 'creative' }: {
    category: string;
    values: string[] | Record<string, string[]>;
    isOpen: boolean;
    onToggle: () => void;
    onTagClick: (tag: string) => void;
    variant?: 'creative' | 'royalties';
}) => {
    const dropdownId = useId();
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

    useEffect(() => {
        if (isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            // Show above the input bar
            setMenuPos({ top: rect.top - 6, left: rect.left });
        }
    }, [isOpen]);

    return (
        <div className="relative">
            <button
                ref={triggerRef}
                onClick={(e) => { e.stopPropagation(); onToggle(); }}
                aria-expanded={isOpen}
                aria-haspopup="true"
                aria-controls={dropdownId}
                data-testid={`category-${category}-trigger`}
                className={`px-3 py-1.5 text-xs rounded-full border transition-all flex items-center gap-1 ${isOpen
                    ? variant === 'royalties' ? 'bg-dept-royalties/20 border-dept-royalties/50 text-dept-royalties' : 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                    : 'bg-background/40 border-white/10 text-gray-400 hover:border-white/30 backdrop-blur-md'
                    }`}
            >
                {category === 'Brand' && <Sparkles size={10} />}
                {category}
                {isOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            </button>

            {isOpen && menuPos && createPortal(
                <AnimatePresence>
                    <motion.div
                        id={dropdownId}
                        role="menu"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="fixed w-64 max-h-60 overflow-y-auto bg-[#1a1a1a] border border-gray-700 rounded-xl shadow-2xl p-2 custom-scrollbar origin-bottom"
                        style={{ zIndex: 9999, top: menuPos.top, left: menuPos.left, transform: 'translateY(-100%)' }}
                    >
                        {Array.isArray(values) ? (
                            <div className="flex flex-wrap gap-1">
                                {values.length > 0 ? values.map((tag) => (
                                    <TagButton key={tag} tag={tag} onClick={() => onTagClick(tag)} variant={variant} />
                                )) : (
                                    <p className="text-[10px] text-gray-500 italic p-2">No tags available.</p>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {Object.entries(values).map(([subCat, tags]) => (
                                    <div key={subCat}>
                                        <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">{subCat}</p>
                                        <div className="flex flex-wrap gap-1">
                                            {tags.map((tag) => (
                                                <TagButton key={tag} tag={tag} onClick={() => onTagClick(tag)} variant={variant} />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
});
CategoryDropdown.displayName = 'CategoryDropdown';

interface VideoPromptBuilderProps {
    prompt: string;
    onChange: (val: string) => void;
    onGenerate: () => void;
    disabled?: boolean;
    mode?: 'image' | 'video';
    children?: React.ReactNode;
    showBuilder?: boolean;
}

export function VideoPromptBuilder({ prompt, onChange, onGenerate, disabled, mode = 'video', children, showBuilder = false }: VideoPromptBuilderProps) {
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

    const [openCategory, setOpenCategory] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const brandKit = useStore(useShallow(state => state.userProfile?.brandKit));
    const brandTags = useMemo(() => [
        brandKit?.brandDescription,
        brandKit?.releaseDetails?.mood,
        brandKit?.releaseDetails?.themes,
        ...(brandKit?.colors || []).map(c => `Color: ${c}`),
        brandKit?.fonts ? `Font: ${brandKit.fonts}` : null
    ].filter(Boolean) as string[], [brandKit]);

    useEffect(() => {
        if (!openCategory) return;
        const handlePointerDown = (e: MouseEvent) => {
            const target = e.target as Element;
            if (containerRef.current && containerRef.current.contains(target)) return;
            if (target.closest?.('[role="menu"]')) return;
            setOpenCategory(null);
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpenCategory(null);
        };
        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [openCategory]);

    const handleTagClick = useCallback((tag: string) => {
        const newPrompt = prompt ? `${prompt}, ${tag}` : tag;
        onChange(newPrompt);
        setBuilderTags(prev => [...prev, tag]);
    }, [prompt, onChange]);

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
        <div ref={containerRef} className="flex flex-col gap-2 w-full">
            {showBuilder && (
                <div className="flex flex-wrap gap-2 mb-2 p-2 bg-background/40 border border-white/5 rounded-xl">
                    <CategoryDropdown
                        category="Brand"
                        values={brandTags}
                        isOpen={openCategory === 'Brand'}
                        onToggle={() => setOpenCategory(openCategory === 'Brand' ? null : 'Brand')}
                        onTagClick={handleTagClick}
                        variant="royalties"
                    />
                    {Object.entries(STUDIO_TAGS).map(([category, values]) => (
                        <CategoryDropdown
                            key={category}
                            category={category}
                            values={values}
                            isOpen={openCategory === category}
                            onToggle={() => setOpenCategory(openCategory === category ? null : category)}
                            onTagClick={handleTagClick}
                        />
                    ))}
                </div>
            )}
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
