import React, { useState, useMemo } from 'react';
import { X, Search, LayoutTemplate, Disc3, MapPin, Tag, Music2, Image as ImageIcon, Share2, FileText, Ticket } from 'lucide-react';
import { templateService, DesignTemplate } from '../templates/DesignTemplates';
import { cn } from '@/lib/utils';

interface TemplatePickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectTemplate: (template: DesignTemplate) => void;
}

const categoryIcons: Record<DesignTemplate['category'], React.ReactNode> = {
    'album-art': <Disc3 size={14} />,
    'tour-poster': <MapPin size={14} />,
    'band-logo': <Tag size={14} />,
    'vinyl-packaging': <Disc3 size={14} />,
    'cd-packaging': <Disc3 size={14} />,
    'cassette-packaging': <Music2 size={14} />,
    'merch-graphic': <ImageIcon size={14} />,
    'social-media': <Share2 size={14} />,
    'flyer': <FileText size={14} />,
    'ticket': <Ticket size={14} />
};

export const TemplatePicker: React.FC<TemplatePickerProps> = ({
    isOpen,
    onClose,
    onSelectTemplate
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<DesignTemplate['category'] | 'all'>('all');

    // Get categories with counts
    const categories = useMemo(() => templateService.getCategories(), []);

    // Filter templates based on search and category
    const filteredTemplates = useMemo(() => {
        let templates = templateService.getAll();

        if (selectedCategory !== 'all') {
            templates = templates.filter(t => t.category === selectedCategory);
        }

        if (searchQuery.trim()) {
            templates = templateService.search(searchQuery);
            if (selectedCategory !== 'all') {
                templates = templates.filter(t => t.category === selectedCategory);
            }
        }

        return templates;
    }, [searchQuery, selectedCategory]);

    if (!isOpen) return null;

    const handleSelect = (template: DesignTemplate) => {
        onSelectTemplate(template);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 md:p-6 animate-in fade-in duration-200">
            <div className="w-full max-w-4xl h-[90vh] max-h-[850px] bg-neutral-900/95 rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-[#FFE135]/15 text-[#FFE135] rounded-xl border border-[#FFE135]/20">
                            <LayoutTemplate size={22} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white tracking-tight">Design Templates</h2>
                            <p className="text-xs text-neutral-400">Start with a curated artist layout or customize from scratch</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        aria-label="Close templates modal"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Search & Filters */}
                <div className="p-4 border-b border-white/5 space-y-3 shrink-0 bg-black/20">
                    {/* Search Input */}
                    <div className="relative">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by keyword, style, or product..."
                            className="w-full pl-10 pr-4 py-2 bg-neutral-800/90 border border-white/10 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#FFE135]/60 focus:ring-1 focus:ring-[#FFE135]/40 transition-all"
                        />
                    </div>

                    {/* Category Tabs */}
                    <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                        <button
                            onClick={() => setSelectedCategory('all')}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all",
                                selectedCategory === 'all'
                                    ? 'bg-[#FFE135] text-black shadow-md shadow-[#FFE135]/20'
                                    : 'bg-neutral-800/80 text-neutral-400 hover:text-white hover:bg-neutral-700'
                            )}
                        >
                            All Templates
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat.category}
                                onClick={() => setSelectedCategory(cat.category)}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5",
                                    selectedCategory === cat.category
                                        ? 'bg-[#FFE135] text-black shadow-md shadow-[#FFE135]/20'
                                        : 'bg-neutral-800/80 text-neutral-400 hover:text-white hover:bg-neutral-700'
                                )}
                            >
                                {categoryIcons[cat.category]}
                                {cat.label}
                                <span className={cn("text-[10px]", selectedCategory === cat.category ? "text-black/70" : "text-neutral-500")}>
                                    ({cat.count})
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Template Grid */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar min-h-0 bg-black/10">
                    {filteredTemplates.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center py-16">
                            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4 border border-white/10">
                                <LayoutTemplate size={32} className="text-neutral-500" />
                            </div>
                            <p className="text-sm font-semibold text-neutral-300 mb-1">No matching templates found</p>
                            <p className="text-xs text-neutral-500 max-w-xs">Try selecting a different category or clearing your search filters.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredTemplates.map(template => (
                                <TemplateCard
                                    key={template.id}
                                    template={template}
                                    onSelect={() => handleSelect(template)}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between shrink-0 bg-neutral-900/90">
                    <p className="text-xs font-medium text-neutral-400">
                        Showing <span className="text-white font-bold">{filteredTemplates.length}</span> template{filteredTemplates.length !== 1 ? 's' : ''}
                    </p>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-bold text-neutral-300 hover:text-white hover:bg-white/5 border border-white/10 rounded-xl transition-all"
                    >
                        Start with Blank Canvas
                    </button>
                </div>
            </div>
        </div>
    );
};

// Template Card Component
const TemplateCard: React.FC<{
    template: DesignTemplate;
    onSelect: () => void;
    key?: React.Key;
}> = ({ template, onSelect }) => {
    return (
        <button
            onClick={onSelect}
            className="group relative bg-neutral-850/80 rounded-2xl border border-white/10 overflow-hidden transition-all duration-300 hover:border-[#FFE135]/60 hover:shadow-xl hover:shadow-[#FFE135]/5 focus:outline-none focus:ring-2 focus:ring-[#FFE135]/50 text-left flex flex-col"
        >
            {/* Preview Area */}
            <div
                className="aspect-square w-full relative overflow-hidden flex items-center justify-center border-b border-white/5"
                style={{
                    background: template.backgroundColor || '#0a0a0a'
                }}
            >
                {/* Subtle Grid / Texture for backdrop */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 pointer-events-none" />

                {/* Structured Template Elements Preview */}
                <div className="absolute inset-4 rounded-lg overflow-hidden border border-white/10 bg-white/[0.02]">
                    {template.elements.slice(0, 4).map((element) => {
                        const isText = element.type === 'text';
                        const isPlaceholder = element.type === 'placeholder' || element.type === 'image';

                        return (
                            <div
                                key={element.id}
                                className={cn(
                                    "rounded flex items-center justify-center p-1 overflow-hidden",
                                    isPlaceholder && "border border-dashed border-white/30 bg-white/5"
                                )}
                                style={{
                                    position: 'absolute',
                                    left: `${element.x}%`,
                                    top: `${element.y}%`,
                                    width: `${element.width}%`,
                                    height: `${element.height}%`,
                                    backgroundColor: isPlaceholder ? 'rgba(255,255,255,0.06)' : (element.fill || 'transparent'),
                                    opacity: element.opacity ?? 1
                                }}
                            >
                                {isText && (
                                    <span
                                        className="font-bold tracking-wider leading-none text-center truncate select-none"
                                        style={{
                                            color: element.fill || '#ffffff',
                                            fontSize: '9px',
                                            fontFamily: element.fontFamily || 'sans-serif'
                                        }}
                                    >
                                        {element.content || element.name}
                                    </span>
                                )}
                                {isPlaceholder && (
                                    <div className="flex flex-col items-center justify-center gap-0.5 opacity-60">
                                        <ImageIcon size={12} className="text-white/60" />
                                        <span className="text-[7px] text-white/50 uppercase tracking-widest font-mono">ART</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Hover Action Overlay */}
                <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center z-20">
                    <span className="px-4 py-2 bg-[#FFE135] text-black text-xs font-black rounded-xl shadow-lg shadow-[#FFE135]/30 transform translate-y-2 group-hover:translate-y-0 transition-transform">
                        Use Template
                    </span>
                </div>

                {/* Category Pill */}
                <div className="absolute top-3 left-3 px-2 py-1 bg-black/70 backdrop-blur-md rounded-lg flex items-center gap-1.5 border border-white/10 z-10">
                    {categoryIcons[template.category]}
                    <span className="text-[10px] font-medium text-white/90 capitalize">
                        {template.category.replace('-', ' ')}
                    </span>
                </div>
            </div>

            {/* Info Section */}
            <div className="p-3.5 flex-1 flex flex-col justify-between bg-neutral-900/60">
                <div>
                    <h3 className="text-sm font-bold text-white truncate group-hover:text-[#FFE135] transition-colors">
                        {template.name}
                    </h3>
                    <p className="text-xs text-neutral-400 line-clamp-2 mt-1 leading-relaxed">
                        {template.description}
                    </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between gap-2">
                    {/* Tags */}
                    <div className="flex flex-wrap gap-1 overflow-hidden max-h-5">
                        {template.tags.slice(0, 2).map(tag => (
                            <span
                                key={tag}
                                className="px-1.5 py-0.5 bg-neutral-800 border border-white/5 rounded text-[9px] font-mono text-neutral-400"
                            >
                                #{tag}
                            </span>
                        ))}
                    </div>

                    {template.recommendedProducts && template.recommendedProducts.length > 0 && (
                        <span className="text-[9px] text-neutral-500 font-medium truncate shrink-0">
                            {template.recommendedProducts[0]}
                        </span>
                    )}
                </div>
            </div>
        </button>
    );
};

export default TemplatePicker;
