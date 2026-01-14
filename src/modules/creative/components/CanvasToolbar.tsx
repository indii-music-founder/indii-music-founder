import React from 'react';
import { Square, Circle as CircleIcon, Type, Wand2 } from 'lucide-react';

interface CanvasToolbarProps {
    addRectangle: () => void;
    addCircle: () => void;
    addText: () => void;
    toggleMagicFill: () => void;
    isMagicFillMode: boolean;
}

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
    addRectangle,
    addCircle,
    addText,
    toggleMagicFill,
    isMagicFillMode
}) => {
    return (
        <div className="w-16 bg-[#1a1a1a] border-r border-gray-800 flex flex-col items-center py-4 gap-4">
            <button onClick={addRectangle} data-testid="add-rect-btn" className="p-2 hover:bg-gray-800 rounded text-gray-400 hover:text-white" title="Add Rectangle">
                <Square size={20} />
            </button>
            <button onClick={addCircle} data-testid="add-circle-btn" className="p-2 hover:bg-gray-800 rounded text-gray-400 hover:text-white" title="Add Circle">
                <CircleIcon size={20} />
            </button>
            <button onClick={addText} data-testid="add-text-btn" className="p-2 hover:bg-gray-800 rounded text-gray-400 hover:text-white" title="Add Text">
                <Type size={20} />
            </button>
            <div className="w-8 h-px bg-gray-800 my-2" />
            <button
                onClick={toggleMagicFill}
                data-testid="magic-fill-toggle"
                className={`p-2 rounded transition-colors ${isMagicFillMode ? 'bg-purple-600 text-white' : 'hover:bg-gray-800 text-gray-400 hover:text-white'}`}
                title="Magic Fill"
            >
                <Wand2 size={20} />
            </button>
        </div>
    );
};
