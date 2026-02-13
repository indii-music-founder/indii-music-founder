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
    const baseButtonClass = "p-2 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-dept-creative/40 focus-visible:outline-none";

    return (
        <div className="w-full md:w-16 h-16 md:h-auto bg-background md:border-r border-gray-800 flex flex-row md:flex-col items-center justify-center md:justify-start py-2 md:py-4 px-4 md:px-0 gap-4 shrink-0">
            <button
                onClick={addRectangle}
                data-testid="add-rect-btn"
                className={baseButtonClass}
                title="Add Rectangle"
                aria-label="Add Rectangle"
            >
                <Square size={20} aria-hidden="true" />
            </button>
            <button
                onClick={addCircle}
                data-testid="add-circle-btn"
                className={baseButtonClass}
                title="Add Circle"
                aria-label="Add Circle"
            >
                <CircleIcon size={20} aria-hidden="true" />
            </button>
            <button
                onClick={addText}
                data-testid="add-text-btn"
                className={baseButtonClass}
                title="Add Text"
                aria-label="Add Text"
            >
                <Type size={20} aria-hidden="true" />
            </button>
            <div className="w-8 h-px bg-gray-800 my-2" role="separator" />
            <button
                onClick={toggleMagicFill}
                data-testid="magic-fill-toggle"
                className={`p-2 rounded transition-colors focus-visible:ring-2 focus-visible:ring-dept-creative/40 focus-visible:outline-none ${isMagicFillMode ? 'bg-dept-creative text-white shadow-[0_0_15px_var(--color-dept-creative-glow)]' : 'hover:bg-gray-800 text-gray-400 hover:text-white'}`}
                title="Magic Fill"
                aria-label="Magic Fill"
                aria-pressed={isMagicFillMode}
            >
                <Wand2 size={20} aria-hidden="true" />
            </button>
        </div>
    );
};
