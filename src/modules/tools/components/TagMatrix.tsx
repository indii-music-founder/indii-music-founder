import React, { useState } from 'react';
import { Search, Plus, X, Tag as TagIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TagMatrixProps {
    tags: string[];
    onAddTag: (tag: string) => void;
    onRemoveTag: (tag: string) => void;
    suggestions: Record<string, string[]>; // Category -> Tags
}

export const TagMatrix: React.FC<TagMatrixProps> = ({ tags, onAddTag, onRemoveTag, suggestions }) => {
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>('All');
    const [isCustomInput, setIsCustomInput] = useState(false);

    const categories = ['All', ...Object.keys(suggestions)];

    // Flatten suggestions for search
    const allSuggestions = Object.values(suggestions).flat();

    // Filter logic
    const filteredTags = activeCategory === 'All'
        ? allSuggestions
        : suggestions[activeCategory] || [];

    const shownSuggestions = search
        ? allSuggestions.filter(t => t.toLowerCase().includes(search.toLowerCase()))
        : filteredTags;

    const handleAdd = (tag: string) => {
        if (!tags.includes(tag)) {
            onAddTag(tag);
        }
        setSearch('');
    };

    const handleKeypress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && search) {
            handleAdd(search);
        }
    };

    return (
        <div className="flex flex-col h-full bg-black/20 rounded-xl border border-white/5 overflow-hidden">
            {/* Header / Search */}
            <div className="p-4 border-b border-white/5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase tracking-widest">
                    <TagIcon size={12} />
                    <span>Metadata Matrix</span>
                    <span className="bg-primary/20 text-primary px-1.5 rounded ml-auto">{tags.length} Active</span>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-muted-foreground w-4 h-4" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={handleKeypress}
                        placeholder="Search or create tags..."
                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors"
                    />
                </div>

                {/* Categories */}
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`text-[10px] px-3 py-1 rounded-full whitespace-nowrap transition-all border ${activeCategory === cat
                                    ? 'bg-primary/20 border-primary/50 text-white'
                                    : 'bg-white/5 border-transparent text-muted-foreground hover:bg-white/10'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {/* Active Tags Section */}
                {tags.length > 0 && (
                    <div className="mb-6">
                        <div className="text-[10px] text-muted-foreground font-bold mb-2">APPLIED TAGS</div>
                        <div className="flex flex-wrap gap-2">
                            <AnimatePresence>
                                {tags.map(tag => (
                                    <motion.div
                                        key={tag}
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{ scale: 0.8, opacity: 0 }}
                                        className="group flex items-center gap-1.5 pl-3 pr-2 py-1.5 bg-primary/10 border border-primary/20 rounded-md text-xs text-primary-foreground hover:border-primary/50 transition-colors cursor-default"
                                    >
                                        <span>{tag}</span>
                                        <button
                                            onClick={() => onRemoveTag(tag)}
                                            className="p-0.5 hover:bg-black/20 rounded ml-1"
                                        >
                                            <X size={12} />
                                        </button>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </div>
                )}

                {/* Suggestions Grid */}
                <div>
                    <div className="text-[10px] text-muted-foreground font-bold mb-2">
                        {search ? 'SEARCH RESULTS' : `SUGGESTED: ${activeCategory.toUpperCase()}`}
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                        {shownSuggestions.map(tag => {
                            const isActive = tags.includes(tag);
                            return (
                                <button
                                    key={tag}
                                    onClick={() => !isActive && handleAdd(tag)}
                                    disabled={isActive}
                                    className={`text-left px-3 py-2 rounded-md text-xs transition-all flex items-center justify-between group ${isActive
                                            ? 'bg-white/5 text-muted-foreground opacity-50 cursor-default'
                                            : 'bg-secondary/30 hover:bg-secondary text-secondary-foreground hover:pl-4'
                                        }`}
                                >
                                    <span>{tag}</span>
                                    {!isActive && <Plus size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />}
                                </button>
                            );
                        })}
                        {shownSuggestions.length === 0 && (
                            <div className="col-span-full py-8 text-center text-muted-foreground text-xs italic">
                                No matching suggestions. Press Enter to create "{search}".
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
