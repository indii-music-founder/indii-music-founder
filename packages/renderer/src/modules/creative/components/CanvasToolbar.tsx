import React from 'react';
import { Square, Circle as CircleIcon, Type, Wand2, Scan, Eraser, Crop, Trash2, MousePointer2, Minus, Pentagon, Undo2, Redo2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CanvasToolbarProps {
    addRectangle: () => void;
    addCircle: () => void;
    addText: () => void;
    setTool: (tool: 'select' | 'line' | 'polygon' | 'text' | 'brush') => void;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    activeTool: 'select' | 'line' | 'polygon' | 'text' | 'brush';
    handleDetectObjects: () => void;
    handleClearDetections: () => void;
}

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
    addRectangle,
    addCircle,
    addText,
    setTool,
    undo,
    redo,
    canUndo,
    canRedo,
    activeTool,
    handleDetectObjects,
    handleClearDetections,
}) => {
    const baseButtonClass = "p-2 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-dept-creative/40 focus-visible:outline-none";
    const getActiveButtonClass = (tool: string) => `p-2 rounded transition-colors focus-visible:ring-2 focus-visible:ring-dept-creative/40 focus-visible:outline-none ${activeTool === tool ? 'bg-dept-creative text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'hover:bg-gray-800 text-gray-400 hover:text-white'}`;

    return (
        <TooltipProvider delayDuration={200}>
            <div className="w-16 bg-[#0a0a0a] border-r border-gray-800 flex flex-col items-center py-4 gap-2">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button onClick={() => setTool('select')} className={getActiveButtonClass('select')} aria-label="Select Tool">
                            <MousePointer2 size={20} />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Selection Tool</TooltipContent>
                </Tooltip>

                <div className="w-8 h-px bg-gray-800 my-1" />

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button onClick={() => setTool('brush')} className={getActiveButtonClass('brush')} aria-label="Magic Fill">
                            <Wand2 size={20} />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Magic Fill (Drawing)</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button onClick={() => setTool('line')} className={getActiveButtonClass('line')} aria-label="Line Tool">
                            <Minus size={20} />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Line Tool (Shift for angles)</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button onClick={() => setTool('polygon')} className={getActiveButtonClass('polygon')} aria-label="Polygon Tool">
                            <Pentagon size={20} />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Polygon Tool (Double click to finish)</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button onClick={addRectangle} className={baseButtonClass} aria-label="Add Rectangle">
                            <Square size={20} />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Add Rectangle</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button onClick={addCircle} className={baseButtonClass} aria-label="Add Circle">
                            <CircleIcon size={20} />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Add Circle</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button onClick={() => setTool('text')} className={getActiveButtonClass('text')} aria-label="Add Text">
                            <Type size={20} />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Add Text</TooltipContent>
                </Tooltip>

                <div className="w-8 h-px bg-gray-800 my-1" />

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button onClick={handleDetectObjects} className={baseButtonClass} aria-label="Detect Objects">
                            <Scan size={20} />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">AI Object Detection</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button onClick={handleClearDetections} className={baseButtonClass} aria-label="Clear All">
                            <Trash2 size={20} />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Clear All Detections</TooltipContent>
                </Tooltip>

                <div className="w-8 h-px bg-gray-800 my-1" />

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button onClick={undo} disabled={!canUndo} className={`${baseButtonClass} disabled:opacity-30 disabled:cursor-not-allowed`} aria-label="Undo">
                            <Undo2 size={20} />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Undo</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button onClick={redo} disabled={!canRedo} className={`${baseButtonClass} disabled:opacity-30 disabled:cursor-not-allowed`} aria-label="Redo">
                            <Redo2 size={20} />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Redo</TooltipContent>
                </Tooltip>
            </div>
        </TooltipProvider>
    );
};
