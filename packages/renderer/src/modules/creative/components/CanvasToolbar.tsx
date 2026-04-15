import React from 'react';
import { Square, Circle as CircleIcon, Type, Wand2, Scan } from 'lucide-react';

interface CanvasToolbarProps {
    addRectangle: () => void;
    addCircle: () => void;
    addText: () => void;
    toggleMagicFill: () => void;
    handleDetectObjects: () => void;
    handleClearDetections: () => void;
    isMagicFillMode: boolean;
}

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
    addRectangle,
    addCircle,
    addText,
    toggleMagicFill,
    handleDetectObjects,
    handleClearDetections,
    isMagicFillMode
}) => {
    const baseButtonClass = "p-2 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-dept-creative/40 focus-visible:outline-none";

    return (
        <div className="w-16 bg-background border-r border-gray-800 flex flex-col items-center py-4 gap-4">
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
                onClick={handleDetectObjects}
                data-testid="detect-objects-btn"
                className={baseButtonClass}
                title="Detect Objects via Gemini Vision"
                aria-label="Detect Objects"
            >
                <Scan size={20} aria-hidden="true" />
            </button>
            <button
                onClick={handleClearDetections}
                data-testid="clear-detections-btn"
                className={baseButtonClass}
                title="Clear AI Detections"
                aria-label="Clear AI Detections"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
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
