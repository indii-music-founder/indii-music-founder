import React, { useState, useMemo, useCallback, useEffect, useRef, memo, useId } from 'react';
import { STUDIO_TAGS } from '@/modules/creative/constants';
import { ChevronDown, ChevronRight, Sparkles, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { PromptImproverService } from '@/services/creative/PromptImproverService';
import { useToast } from '@/core/context/ToastContext';
import { SequenceTimeline, SequenceBlock } from './SequenceTimeline';

interface PromptBuilderProps {
    onAddTag: (tag: string) => void;
    mode?: 'image' | 'video';
    sequence?: SequenceBlock[];
    setSequence?: (seq: SequenceBlock[]) => void;
    bpm?: number;
    setBpm?: (bpm: number) => void;
    /** Current prompt text from the input field. */
    currentPrompt?: string;
    /**
     * Replace the entire prompt. Used by the AI improve action and by chip
     * removal. When omitted, the chip rail and Improve-with-AI button hide.
     */
    onSetPrompt?: (prompt: string) => void;
}

const TAG_SEPARATOR = ', ';

const splitPromptSegments = (prompt: string): string[] =>
    prompt
        .split(',')
        .map(seg => seg.trim())
        .filter(seg => seg.length > 0);

const TagButton = memo(({ tag, onClick, variant = 'creative' }: { tag: string; onClick: () => void; variant?: 'creative' | 'royalties' }) => (
    <button
        onClick={onClick}
        role="menuitem"
        data-testid={`tag-${tag}-btn`}
        className={`px-2 py-1 text-[10px] bg-background/40 hover:${variant === 'royalties' ? 'bg-dept-royalties/20' : 'bg-dept-creative/20'} text-gray-300 hover:text-white rounded border border-white/5 hover:border-${variant === 'royalties' ? 'dept-royalties' : 'dept-creative'}/50 transition-colors text-left backdrop-blur-sm`}
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

    return (
        <div className="relative">
            <button
                onClick={(e) => { e.stopPropagation(); onToggle(); }}
                aria-expanded={isOpen}
                aria-haspopup="true"
                aria-controls={dropdownId}
                data-testid={`category-${category}-trigger`}
                className={`px-3 py-1.5 text-xs rounded-full border transition-all flex items-center gap-1 ${isOpen
                    ? variant === 'royalties' ? 'bg-dept-royalties/20 border-dept-royalties/50 text-dept-royalties' : 'bg-dept-creative/20 border-dept-creative/50 text-dept-creative'
                    : 'bg-background/40 border-white/10 text-gray-400 hover:border-white/30 backdrop-blur-md'
                    }`}
            >
                {category === 'Brand' && <Sparkles size={10} />}
                {category}
                {isOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        id={dropdownId}
                        role="menu"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="absolute top-full left-0 mt-2 w-64 max-h-60 overflow-y-auto bg-[#1a1a1a] border border-gray-700 rounded-xl shadow-2xl z-50 p-2 custom-scrollbar"
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
                )}
            </AnimatePresence>
        </div>
    );
});
CategoryDropdown.displayName = 'CategoryDropdown';

function PromptBuilder({ onAddTag, mode = 'image', sequence = [], setSequence, bpm, setBpm, currentPrompt = '', onSetPrompt }: PromptBuilderProps) {
    const [openCategory, setOpenCategory] = useState<string | null>(null);
    const [isImproving, setIsImproving] = useState(false);
    const brandKit = useStore(useShallow(state => state.userProfile?.brandKit));
    const toast = useToast();
    const containerRef = useRef<HTMLDivElement>(null);

    const brandTags = useMemo(() => [
        brandKit?.brandDescription,
        brandKit?.releaseDetails?.mood,
        brandKit?.releaseDetails?.themes,
        ...(brandKit?.colors || []).map(c => `Color: ${c}`),
        brandKit?.fonts ? `Font: ${brandKit.fonts}` : null
    ].filter(Boolean) as string[], [brandKit]);

    const segments = useMemo(() => splitPromptSegments(currentPrompt), [currentPrompt]);

    // Tag click no longer auto-closes the popover — users can pile on multiple
    // tags from the same category without round-tripping. Esc / outside-click
    // closes it.
    const handleTagClick = useCallback((tag: string) => {
        onAddTag(tag);
    }, [onAddTag]);

    const handleRemoveSegment = useCallback((index: number) => {
        if (!onSetPrompt) return;
        const next = segments.filter((_, i) => i !== index).join(TAG_SEPARATOR);
        onSetPrompt(next);
    }, [segments, onSetPrompt]);

    useEffect(() => {
        if (!openCategory) return;

        const handlePointerDown = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpenCategory(null);
            }
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

    const handleImprove = useCallback(async () => {
        if (!currentPrompt.trim() || !onSetPrompt) return;

        setIsImproving(true);
        try {
            const result = await PromptImproverService.improve({
                rawPrompt: currentPrompt,
                mode: mode as 'image' | 'video'
            });
            onSetPrompt(result.improved);
            toast.success(`Prompt improved: ${result.reasoning}`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to improve prompt');
        } finally {
            setIsImproving(false);
        }
    }, [currentPrompt, mode, onSetPrompt, toast]);

    return (
        <div ref={containerRef} className="flex flex-col gap-2 p-2 bg-background/20 border-b border-white/5">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Prompt Engineering</p>

            {onSetPrompt && segments.length > 0 && (
                <div
                    role="list"
                    aria-label="Selected prompt tags"
                    data-testid="prompt-builder-chip-rail"
                    className="flex flex-wrap gap-1.5 mb-1"
                >
                    {segments.map((segment, index) => (
                        <span
                            key={`${segment}-${index}`}
                            role="listitem"
                            className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 text-[10px] bg-dept-creative/15 text-dept-creative border border-dept-creative/30 rounded-full"
                        >
                            <span>{segment}</span>
                            <button
                                onClick={() => handleRemoveSegment(index)}
                                aria-label={`Remove ${segment}`}
                                data-testid={`chip-remove-${segment}`}
                                className="rounded-full hover:bg-dept-creative/30 p-0.5 transition-colors"
                            >
                                <X size={10} />
                            </button>
                        </span>
                    ))}
                </div>
            )}

            <div className="flex flex-wrap gap-2">
                {/* Brand Category */}
                <CategoryDropdown
                    category="Brand"
                    values={brandTags}
                    isOpen={openCategory === 'Brand'}
                    onToggle={() => setOpenCategory(openCategory === 'Brand' ? null : 'Brand')}
                    onTagClick={handleTagClick}
                    variant="royalties"
                />

                {/* Studio Categories */}
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

                {/* AI Prompt Improver Button */}
                {onSetPrompt && (
                    <button
                        onClick={handleImprove}
                        disabled={isImproving || !currentPrompt.trim()}
                        className="ml-auto px-4 py-1.5 text-xs rounded-full bg-linear-to-r from-dept-creative to-dept-marketing text-white font-bold flex items-center gap-2 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-dept-creative/20"
                    >
                        {isImproving ? (
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            >
                                <Sparkles size={14} />
                            </motion.div>
                        ) : (
                            <Sparkles size={14} />
                        )}
                        <span>Improve with AI</span>
                    </button>
                )}
            </div>

            {mode === 'video' && setSequence && setBpm && (
                <div className="mt-4 pt-4 border-t border-white/5">
                    <SequenceTimeline
                        sequence={sequence}
                        onChange={setSequence}
                        bpm={bpm}
                        onBpmChange={setBpm}
                    />
                </div>
            )}
        </div>
    );
}

export default memo(PromptBuilder);
