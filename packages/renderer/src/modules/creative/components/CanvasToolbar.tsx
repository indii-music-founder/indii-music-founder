import React from 'react';
import { Square, Circle as CircleIcon, Type, Wand2, Scan, Eraser, Crop, Trash2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
        <TooltipProvider delayDuration={200}>
            <div className="w-16 bg-background border-r border-gray-800 flex flex-col items-center py-4 gap-4">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button title="Rectangle Tool" onClick={addRectangle} data-testid="add-rect-btn" className={baseButtonClass} aria-label="Add Rectangle">
                            <Square size={20} aria-hidden="true" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-[#1a1a1a] text-white border-white/10 z-50">Add Rectangle</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button title="Circle Tool" onClick={addCircle} data-testid="add-circle-btn" className={baseButtonClass} aria-label="Add Circle">
                            <CircleIcon size={20} aria-hidden="true" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-[#1a1a1a] text-white border-white/10 z-50">Add Circle</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button title="Text Tool" onClick={addText} data-testid="add-text-btn" className={baseButtonClass} aria-label="Add Text">
                            <Type size={20} aria-hidden="true" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-[#1a1a1a] text-white border-white/10 z-50">Add Text</TooltipContent>
                </Tooltip>

                <div className="w-8 h-px bg-gray-800 my-2" role="separator" />

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button title="Detect Objects" onClick={handleDetectObjects} data-testid="detect-objects-btn" className={baseButtonClass} aria-label="Detect Objects">
                            <Scan size={20} aria-hidden="true" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-[#1a1a1a] text-white border-white/10 z-50">Detect Objects via AI</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button title="Clear Canvas" onClick={handleClearDetections} data-testid="clear-detections-btn" className={baseButtonClass} aria-label="Clear AI Detections">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-[#1a1a1a] text-white border-white/10 z-50">Clear Canvas</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button title="Magic Fill" onClick={toggleMagicFill} data-testid="magic-fill-toggle" className={`p-2 rounded transition-colors focus-visible:ring-2 focus-visible:ring-dept-creative/40 focus-visible:outline-none ${isMagicFillMode ? 'bg-dept-creative text-white shadow-[0_0_15px_var(--color-dept-creative-glow)]' : 'hover:bg-gray-800 text-gray-400 hover:text-white'}`} aria-label="Magic Fill" aria-pressed={isMagicFillMode}>
                            <Wand2 size={20} aria-hidden="true" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-[#1a1a1a] text-white border-white/10 z-50">Magic Fill mode</TooltipContent>
                </Tooltip>
            </div>
        </TooltipProvider>
    );
};
