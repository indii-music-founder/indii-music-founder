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
                className={`p-2 rounded-full transition-colors ${tool === 'pan' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                title="Pan Tool"
            >
                <Move size={18} />
            </button>
            <button
                onClick={() => setTool('select')}
                className={`p-2 rounded-full transition-colors ${tool === 'select' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                title="Select/Move Tool"
            >
                <MousePointer2 size={18} />
            </button>
            <button
                onClick={() => setTool('generate')}
                className={`p-2 rounded-full transition-colors ${tool === 'generate' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                title="Generate/Outpaint Tool"
            >
                <ImagePlus size={18} />
            </button>
            <div className="w-px h-6 bg-gray-700 mx-1"></div>
            <button
                onClick={() => selectedCanvasImageId && removeCanvasImage(selectedCanvasImageId)}
                disabled={!selectedCanvasImageId}
                className="p-2 rounded-full text-red-400 hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Delete Selected"
            >
                <Eraser size={18} />
            </button>
        </div>
    );
};
