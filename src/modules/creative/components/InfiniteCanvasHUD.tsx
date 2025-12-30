import React from 'react';
import { Move, MousePointer2, ImagePlus, Eraser } from 'lucide-react';

interface InfiniteCanvasHUDProps {
    tool: 'pan' | 'select' | 'generate';
    setTool: (tool: 'pan' | 'select' | 'generate') => void;
    selectedCanvasImageId: string | null;
    removeCanvasImage: (id: string) => void;
}

export const InfiniteCanvasHUD: React.FC<InfiniteCanvasHUDProps> = ({
    tool,
    setTool,
    selectedCanvasImageId,
    removeCanvasImage
}) => {
    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-gray-700 rounded-full px-4 py-2 flex items-center gap-2 shadow-xl">
            <button
                onClick={() => setTool('pan')}
                className={`p-2 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none ${tool === 'pan' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                title="Pan Tool"
                aria-label="Pan Tool"
                aria-pressed={tool === 'pan'}
            >
                <Move size={18} />
            </button>
            <button
                onClick={() => setTool('select')}
                className={`p-2 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none ${tool === 'select' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                title="Select/Move Tool"
                aria-label="Select/Move Tool"
                aria-pressed={tool === 'select'}
            >
                <MousePointer2 size={18} />
            </button>
            <button
                onClick={() => setTool('generate')}
                className={`p-2 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:outline-none ${tool === 'generate' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                title="Generate/Outpaint Tool"
                aria-label="Generate/Outpaint Tool"
                aria-pressed={tool === 'generate'}
            >
                <ImagePlus size={18} />
            </button>
            <div className="w-px h-6 bg-gray-700 mx-1"></div>
            <button
                onClick={() => selectedCanvasImageId && removeCanvasImage(selectedCanvasImageId)}
                disabled={!selectedCanvasImageId}
                className="p-2 rounded-full text-red-400 hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none"
                title="Delete Selected"
                aria-label="Delete Selected"
            >
                <Eraser size={18} />
            </button>
        </div>
    );
};
