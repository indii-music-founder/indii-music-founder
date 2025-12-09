import React from 'react';
import { PHYSICAL_MEDIA_TEMPLATES, PrintTemplate } from '../../../services/design/templates';
import { Disc, Square, RectangleHorizontal, StickyNote } from 'lucide-react';

interface TemplateSelectorProps {
    onSelect: (template: PrintTemplate) => void;
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({ onSelect }) => {
    const getIcon = (id: string) => {
        if (id.includes('cd')) return <Disc className="w-8 h-8 mb-2 text-neutral-400" />;
        if (id.includes('vinyl')) return <Disc className="w-12 h-12 mb-2 text-neutral-200" />; // Larger disc for vinyl
        if (id.includes('cassette')) return <RectangleHorizontal className="w-8 h-8 mb-2 text-neutral-400" />;
        return <StickyNote className="w-8 h-8 mb-2 text-neutral-400" />;
    };

    return (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {Object.values(PHYSICAL_MEDIA_TEMPLATES).map((template) => (
                <button
                    key={template.id}
                    onClick={() => onSelect(template)}
                    className="flex flex-col items-center justify-center p-6 bg-neutral-900 border border-neutral-800 rounded-lg hover:bg-neutral-800 hover:border-neutral-600 transition-all group"
                >
                    {getIcon(template.id)}
                    <span className="text-sm font-medium text-neutral-300 group-hover:text-white text-center">
                        {template.name}
                    </span>
                    <span className="text-xs text-neutral-600 mt-1">
                        {template.totalWidth}x{template.totalHeight}px
                    </span>
                </button>
            ))}
        </div>
    );
};
