import React, { useState } from 'react';
import { useStore } from '@/core/store';
import { Sparkles } from 'lucide-react';

interface ImageRendererProps {
    src?: string;
    alt?: string;
}

export const ImageRenderer: React.FC<ImageRendererProps> = ({ src, alt }) => {
    const { setModule, setGenerationMode, setViewMode, setSelectedItem, generatedHistory, currentProjectId } = useStore.getState();
    const [isHovered, setIsHovered] = useState(false);

    const handleClick = () => {
        if (!src) return;

        // 1. Try to find the image in history
        const historyItem = generatedHistory.find(h => h.url === src);

        // 2. Prepare item (found or temp)
        const itemToEdit = historyItem || {
            id: crypto.randomUUID(),
            url: src,
            prompt: alt || 'Imported Image',
            type: 'image',
            timestamp: Date.now(),
            projectId: currentProjectId
        };

        // 3. Navigate
        setModule('creative');
        setGenerationMode('image');
        setViewMode('canvas');
        setSelectedItem(itemToEdit);
    };

    return (
        <div
            className="group relative inline-block my-2 cursor-pointer rounded-lg overflow-hidden border border-white/10 shadow-lg transition-transform hover:scale-[1.02]"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={handleClick}
        >
            <img
                src={src}
                alt={alt}
                className="max-w-full h-auto rounded-lg"
                style={{ maxHeight: '400px' }}
            />

            {/* Hover Overlay */}
            <div className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
                <div className="bg-purple-600 text-white px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 shadow-xl transform scale-100 hover:scale-105 transition-transform">
                    <span>✏️ Edit in Studio</span>
                </div>
            </div>
        </div>
    );
};

interface ToolOutputProps {
    toolName: string;
    idx: number;
    url: string;
    prompt?: string;
}

export const ToolImageOutput: React.FC<ToolOutputProps> = ({ toolName, idx, url, prompt }) => {
    const label = toolName === 'generate_image' ? 'GENERATED ASSET' :
        toolName === 'batch_edit_images' ? 'EDITED ASSET' :
            toolName === 'render_cinematic_grid' ? 'CINEMATIC GRID' :
                toolName === 'extract_grid_frame' ? 'EXTRACTED FRAME' :
                    'HIGH-RES ASSET';

    return (
        <div className="bg-black/40 rounded-xl p-4 border border-white/10">
            <div className="text-xs text-purple-300 mb-2 font-mono flex items-center gap-2">
                <Sparkles size={12} />
                {label} {idx + 1}
            </div>
            <ImageRenderer src={url} alt={prompt || `Generated Image ${idx + 1}`} />
        </div>
    );
};
