import React, { useState, useMemo, useCallback, memo, useId } from 'react';
import { STUDIO_TAGS } from '@/modules/creative/constants';
import { ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/core/store';

interface PromptBuilderProps {
    onAddTag: (tag: string) => void;
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

function PromptBuilder({ onAddTag }: PromptBuilderProps) {
    const [openCategory, setOpenCategory] = useState<string | null>(null);
    const brandKit = useStore(state => state.userProfile?.brandKit);

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
        </div>
    );
}

export default memo(PromptBuilder);
