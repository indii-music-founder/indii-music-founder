import React, { useState, useMemo } from 'react';
import { X, Search, LayoutTemplate, Disc3, MapPin, Tag, Music2, Image as ImageIcon, Share2, FileText, Ticket } from 'lucide-react';
import { templateService, DesignTemplate } from '../templates/DesignTemplates';
import { MerchCard } from './MerchCard';
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-4xl max-h-[85vh] bg-neutral-900 rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-400/20 rounded-lg text-yellow-400">
                            <LayoutTemplate size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Design Templates</h2>
                            <p className="text-xs text-neutral-400">Start with a professionally designed template</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Search & Filters */}
                <div className="p-4 border-b border-white/5 space-y-4">
                    {/* Search Input */}
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search templates..."
                            className="w-full pl-10 pr-4 py-2.5 bg-neutral-800 border border-white/10 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-yellow-400/50"
                        />
                    </div>

                    {/* Category Tabs */}
                    <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                        <button
                            onClick={() => setSelectedCategory('all')}
                            className={cn(
                                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                                selectedCategory === 'all'
                                    ? 'bg-yellow-400 text-black'
                                    : 'bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700'
                            )}
                        >
                            All Templates
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat.category}
                                onClick={() => setSelectedCategory(cat.category)}
                                className={cn(
                                    "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5",
                                    selectedCategory === cat.category
                                        ? 'bg-yellow-400 text-black'
                                        : 'bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700'
                                )}
                            >
                                {categoryIcons[cat.category]}
                                {cat.label}
                                <span className="opacity-60">({cat.count})</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Template Grid */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {filteredTemplates.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center py-12">
                            <LayoutTemplate size={48} className="text-neutral-700 mb-4" />
                            <p className="text-neutral-400 mb-2">No templates found</p>
                            <p className="text-sm text-neutral-600">Try a different search or category</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
                <div className="p-4 border-t border-white/10 flex items-center justify-between">
                    <p className="text-xs text-neutral-500">
                        {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} available
                    </p>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-neutral-400 hover:text-white transition-colors"
                    >
                        Start from Scratch
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
}> = ({ template, onSelect }) => {
    // Generate a preview based on template colors
    const previewStyle = {
        background: template.backgroundColor,
        borderColor: template.colorPalette?.[1] || '#333'
    };

    return (
        <button
            onClick={onSelect}
            className="group relative bg-neutral-800 rounded-xl border border-white/5 overflow-hidden transition-all hover:border-yellow-400/50 hover:shadow-lg hover:shadow-yellow-400/10 focus:outline-none focus:ring-2 focus:ring-yellow-400/50 text-left"
        >
            {/* Preview Area */}
            <div
                className="aspect-square relative overflow-hidden"
                style={previewStyle}
            >
                {/* Template Preview */}
                <div className="absolute inset-4 flex flex-col items-center justify-center">
                    {/* Simplified visual representation */}
                    {template.elements.slice(0, 3).map((element, i) => (
                        <div
                            key={element.id}
                            className="rounded"
                            style={{
                                position: 'absolute',
                                left: `${element.x}%`,
                                top: `${element.y}%`,
                                width: `${element.width}%`,
                                height: `${element.height}%`,
                                backgroundColor: element.type === 'placeholder'
                                    ? 'rgba(255,255,255,0.1)'
                                    : element.fill || 'transparent',
                                opacity: element.opacity,
                                border: element.type === 'placeholder' ? '1px dashed rgba(255,255,255,0.3)' : 'none'
                            }}
                        >
                            {element.type === 'text' && (
                                <div
                                    className="truncate text-center"
                                    style={{
                                        color: element.fill || '#fff',
                                        fontSize: '8px',
                                        fontWeight: element.fontWeight || '400'
                                    }}
                                >
                                    {element.content}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="px-4 py-2 bg-yellow-400 text-black text-xs font-bold rounded-full">
                        Use Template
                    </span>
                </div>

                {/* Category Badge */}
                <div className="absolute top-2 left-2 px-2 py-1 bg-black/50 backdrop-blur-sm rounded-full flex items-center gap-1">
                    {categoryIcons[template.category]}
                    <span className="text-[10px] text-white/80 capitalize">
                        {template.category.replace('-', ' ')}
                    </span>
                </div>
            </div>

            {/* Info */}
            <div className="p-3">
                <h3 className="text-sm font-medium text-white truncate group-hover:text-yellow-400 transition-colors">
                    {template.name}
                </h3>
                <p className="text-xs text-neutral-500 truncate mt-0.5">
                    {template.description}
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-1 mt-2">
                    {template.tags.slice(0, 3).map(tag => (
                        <span
                            key={tag}
                            className="px-1.5 py-0.5 bg-neutral-700 rounded text-[10px] text-neutral-400"
                        >
                            {tag}
                        </span>
                    ))}
                </div>

                {/* Recommended Products */}
                {template.recommendedProducts && template.recommendedProducts.length > 0 && (
                    <p className="text-[10px] text-neutral-600 mt-2">
                        Best for: {template.recommendedProducts.slice(0, 2).join(', ')}
                    </p>
                )}
            </div>
        </button>
    );
};

export default TemplatePicker;
