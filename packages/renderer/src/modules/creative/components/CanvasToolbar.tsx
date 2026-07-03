import React from 'react';
import { Circle, Layers, PenLine, ScanSearch, Square, Type, Wand2, MousePointer2, Undo2, Redo2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CanvasToolbarProps {
    addRectangle: () => void;
    addCircle: () => void;
    addText: () => void;
    addSketchLayer: () => void;
    setTool: (tool: 'select' | 'line' | 'polygon' | 'text' | 'brush') => void;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    activeTool: 'select' | 'line' | 'polygon' | 'text' | 'brush';
    handleDetectObjects: () => void;
    handleClearDetections: () => void;
    hasDetections: boolean;
    toggleLayersPanel: () => void;
    isLayersPanelOpen: boolean;
    orientation?: 'horizontal' | 'vertical';
}

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    addRectangle,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    addCircle,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    addText,
    addSketchLayer,
    setTool,
    undo,
    redo,
    canUndo,
    canRedo,
    activeTool,
    handleDetectObjects,
    handleClearDetections,
    hasDetections,
    toggleLayersPanel,
    isLayersPanelOpen,
    orientation = 'horizontal',
}) => {
    const isVertical = orientation === 'vertical';
    const buttonFrameClass = "w-9 h-9 flex items-center justify-center";
    const baseButtonClass = `${buttonFrameClass} hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-dept-creative/40 focus-visible:outline-none`;
    const getActiveButtonClass = (tool: string) => `${buttonFrameClass} rounded transition-colors focus-visible:ring-2 focus-visible:ring-dept-creative/40 focus-visible:outline-none ${activeTool === tool ? 'bg-dept-creative text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'hover:bg-gray-800 text-gray-400 hover:text-white'}`;
    const separatorClass = isVertical ? "h-px w-8 bg-white/10 my-1" : "h-5 w-px bg-white/10 mx-1";
    const tooltipSide = isVertical ? 'right' : 'top';

    return (
        <TooltipProvider delayDuration={200}>
            <div className={`flex ${isVertical ? 'flex-col' : 'items-center'} gap-1.5 ${isVertical ? 'py-1' : 'px-2'}`}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button onClick={() => setTool('select')} className={getActiveButtonClass('select')} aria-label="Select Tool">
                            <MousePointer2 size={16} />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side={tooltipSide}>Selection Tool</TooltipContent>
                </Tooltip>

                <div className={separatorClass} />

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button onClick={() => setTool('brush')} className={getActiveButtonClass('brush')} aria-label="Magic Fill">
                            <Wand2 size={16} />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side={tooltipSide}>Magic Fill (Drawing)</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button onClick={() => setTool('text')} className={getActiveButtonClass('text')} aria-label="Add Text">
                            <Type size={16} />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side={tooltipSide}>Add Text</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button onClick={addSketchLayer} className={baseButtonClass} aria-label="Add Sketch Layer">
                            <PenLine size={16} />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side={tooltipSide}>Add Sketch Layer</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button onClick={addRectangle} className={baseButtonClass} aria-label="Add Rectangle Layer">
                            <Square size={16} />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side={tooltipSide}>Add Rectangle Layer</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button onClick={addCircle} className={baseButtonClass} aria-label="Add Circle Layer">
                            <Circle size={16} />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side={tooltipSide}>Add Circle Layer</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={hasDetections ? handleClearDetections : handleDetectObjects}
                            className={`${buttonFrameClass} rounded transition-colors focus-visible:ring-2 focus-visible:ring-dept-creative/40 focus-visible:outline-none ${hasDetections ? 'bg-dept-creative text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'hover:bg-gray-800 text-gray-400 hover:text-white'}`}
                            aria-label={hasDetections ? 'Clear Object Detections' : 'ID Objects'}
                            aria-pressed={hasDetections}
                            data-testid="detect-objects-btn"
                        >
                            <ScanSearch size={16} />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side={tooltipSide}>{hasDetections ? 'Clear Detections' : 'ID Objects'}</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={toggleLayersPanel}
                            className={`${buttonFrameClass} rounded transition-colors focus-visible:ring-2 focus-visible:ring-dept-creative/40 focus-visible:outline-none ${isLayersPanelOpen ? 'bg-dept-creative text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'hover:bg-gray-800 text-gray-400 hover:text-white'}`}
                            aria-label="Layers Panel"
                            aria-pressed={isLayersPanelOpen}
                            data-testid="layers-panel-toggle"
                        >
                            <Layers size={16} />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side={tooltipSide}>Layers Panel</TooltipContent>
                </Tooltip>

                <div className={separatorClass} />

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button onClick={undo} disabled={!canUndo} className={`${baseButtonClass} disabled:opacity-30 disabled:cursor-not-allowed`} aria-label="Undo">
                            <Undo2 size={16} />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side={tooltipSide}>Undo</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button onClick={redo} disabled={!canRedo} className={`${baseButtonClass} disabled:opacity-30 disabled:cursor-not-allowed`} aria-label="Redo">
                            <Redo2 size={16} />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side={tooltipSide}>Redo</TooltipContent>
                </Tooltip>
            </div>
        </TooltipProvider>
    );
};
