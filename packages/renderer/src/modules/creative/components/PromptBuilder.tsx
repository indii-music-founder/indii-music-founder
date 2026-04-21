import React, { useState, useMemo, useCallback, memo, useId } from 'react';
import { STUDIO_TAGS } from '@/modules/creative/constants';
import { ChevronDown, ChevronRight, Sparkles, Wand2, Loader2 } from 'lucide-react';
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
    /** Current prompt text from the input field */
    currentPrompt?: string;
    /** Callback to replace the prompt text with the improved version */
    onPromptImproved?: (improvedPrompt: string) => void;
}

// Memoized tag button to prevent re-renders
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

function PromptBuilder({ onAddTag, mode = 'image', sequence = [], setSequence, bpm, setBpm, currentPrompt = '', onPromptImproved }: PromptBuilderProps) {
    const [openCategory, setOpenCategory] = useState<string | null>(null);
    const [isImproving, setIsImproving] = useState(false);
    const [lastReasoning, setLastReasoning] = useState<string | null>(null);
    const brandKit = useStore(useShallow(state => state.userProfile?.brandKit));
    const toast = useToast();

    // Memoize brandTags computation
    const brandTags = useMemo(() => [
        brandKit?.brandDescription,
        brandKit?.releaseDetails?.mood,
        brandKit?.releaseDetails?.themes,
        ...(brandKit?.colors || []).map(c => `Color: ${c}`),
        brandKit?.fonts ? `Font: ${brandKit.fonts}` : null
    ].filter(Boolean) as string[], [brandKit]);

    // Memoize tag click handler
    const handleTagClick = useCallback((tag: string) => {
        onAddTag(tag);
        setOpenCategory(null);
    }, [onAddTag]);

    // Prompt Improve handler
    const handleImprovePrompt = useCallback(async () => {
        if (!currentPrompt.trim() || !onPromptImproved) return;

        setIsImproving(true);
        setLastReasoning(null);

        try {
            const result = await PromptImproverService.improve({
                rawPrompt: currentPrompt,
                mode
            });

            onPromptImproved(result.improved);
            setLastReasoning(result.reasoning);
            toast.success('Prompt improved ✨');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to improve prompt';
            toast.error(message);
        } finally {
            setIsImproving(false);
        }
    }, [currentPrompt, mode, onPromptImproved, toast]);

    return (
        <div className="flex flex-col gap-2 p-2 bg-background/20 border-b border-white/5">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Prompt Engineering</p>
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
            </div>

            {/* Improve Prompt Button */}
            {onPromptImproved && (
                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/5">
                    <button
                        onClick={handleImprovePrompt}
                        disabled={isImproving || !currentPrompt.trim()}
                        data-testid="improve-prompt-btn"
                        className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-400 hover:text-amber-300 hover:border-amber-500/50 hover:shadow-[0_0_16px_rgba(245,158,11,0.2)] active:scale-[0.98]"
                    >
                        {isImproving ? (
                            <>
                                <Loader2 size={14} className="animate-spin" />
                                <span>Improving…</span>
                            </>
                        ) : (
                            <>
                                <Wand2 size={14} />
                                <span>Improve Prompt</span>
                            </>
                        )}
                    </button>

                    <AnimatePresence>
                        {lastReasoning && !isImproving && (
                            <motion.p
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                className="text-[10px] text-amber-500/70 italic flex-1 truncate"
                            >
                                {lastReasoning}
                            </motion.p>
                        )}
                    </AnimatePresence>
                </div>
            )}

            {/* Sequence Builder for Video Mode */}
            {mode === 'video' && setSequence && (
                <div className="mt-4">
                    <SequenceTimeline sequence={sequence} onChange={setSequence} bpm={bpm} onBpmChange={setBpm} />
                </div>
            )}
        </div>
    );
}

export default memo(PromptBuilder);
