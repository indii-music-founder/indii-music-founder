import React, { memo } from 'react';
import { Move, MousePointer2, ImagePlus, Eraser, Layers, Crop, ZoomIn, ZoomOut, ScanSearch, Undo2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface InfiniteCanvasHUDProps {
    tool: 'pan' | 'select' | 'generate' | 'crop';
    setTool: (tool: 'pan' | 'select' | 'generate' | 'crop') => void;
    selectedCanvasImageId: string | null;
    removeCanvasImage: (id: string) => void;
    onFlatten?: () => void;
    onUndoFlatten?: () => void;
    canUndoFlatten?: boolean;
    onGenerateVariations?: () => void;
    onRetryFailedVariations?: () => void;
    failedVariationCount?: number;
    onZoomIn?: () => void;
    onZoomOut?: () => void;
    onDetectObjects?: () => void;
}

// Optimized with React.memo to prevent re-renders when parent's local state (e.g., offset/drag) changes
// during high-frequency events like panning or dragging.
export const InfiniteCanvasHUD: React.FC<InfiniteCanvasHUDProps> = memo(({
    tool,
    setTool,
    selectedCanvasImageId,
    removeCanvasImage,
    onFlatten,
    onUndoFlatten,
    canUndoFlatten,
    onGenerateVariations,
    onRetryFailedVariations,
    failedVariationCount,
    onZoomIn,
    onZoomOut,
    onDetectObjects
}) => {
    return (
        <TooltipProvider delayDuration={200}>
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-background/60 backdrop-blur-xl border border-white/10 rounded-full px-4 py-2 flex items-center gap-2 shadow-2xl z-50">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            title="Pan Tool"
                            onClick={() => setTool('pan')}
                            className={`p-2 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-dept-distribution/40 focus-visible:outline-none ${tool === 'pan' ? 'bg-dept-distribution text-white' : 'text-gray-400 hover:text-white'}`}
                            aria-label="Pan Tool"
                            aria-pressed={tool === 'pan'}
                        >
                            <Move size={18} />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-[#1a1a1a] text-white border-white/10 z-50">Pan Tool</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            title="Select/Move Tool"
                            onClick={() => setTool('select')}
                            className={`p-2 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-dept-distribution/40 focus-visible:outline-none ${tool === 'select' ? 'bg-dept-distribution text-white' : 'text-gray-400 hover:text-white'}`}
                            aria-label="Select/Move Tool"
                            aria-pressed={tool === 'select'}
                        >
                            <MousePointer2 size={18} />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-[#1a1a1a] text-white border-white/10 z-50">Select/Move Tool</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            title="Generate/Outpaint Tool"
                            onClick={() => setTool('generate')}
                            className={`p-2 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-dept-creative/40 focus-visible:outline-none ${tool === 'generate' ? 'bg-dept-creative text-white' : 'text-gray-400 hover:text-white'}`}
                            aria-label="Generate/Outpaint Tool"
                            aria-pressed={tool === 'generate'}
                        >
                            <ImagePlus size={18} />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-[#1a1a1a] text-white border-white/10 z-50">Generate/Outpaint Tool</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            title="Adaptive Crop & Fill"
                            onClick={() => setTool('crop')}
                            className={`p-2 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-orange-500/40 focus-visible:outline-none ${tool === 'crop' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}
                            aria-label="Adaptive Crop & Fill"
                            aria-pressed={tool === 'crop'}
                        >
                            <Crop size={18} />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-[#1a1a1a] text-white border-white/10 z-50">Adaptive Crop & Fill</TooltipContent>
                </Tooltip>

                <div className="w-px h-6 bg-white/10 mx-1"></div>

                {onDetectObjects && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                title="Detect Objects (ID)"
                                onClick={onDetectObjects}
                                className="p-2 rounded-full text-indigo-400 hover:text-white hover:bg-indigo-900/30 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
                                aria-label="Detect Objects"
                            >
                                <ScanSearch size={18} />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-[#1a1a1a] text-white border-white/10 z-50">Detect Objects (ID)</TooltipContent>
                    </Tooltip>
                )}

                {onZoomOut && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                title="Zoom Out"
                                onClick={onZoomOut}
                                className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"
                                aria-label="Zoom Out"
                            >
                                <ZoomOut size={18} />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-[#1a1a1a] text-white border-white/10 z-50">Zoom Out</TooltipContent>
                    </Tooltip>
                )}

                {onZoomIn && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                title="Zoom In"
                                onClick={onZoomIn}
                                className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"
                                aria-label="Zoom In"
                            >
                                <ZoomIn size={18} />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-[#1a1a1a] text-white border-white/10 z-50">Zoom In</TooltipContent>
                    </Tooltip>
                )}

                <div className="w-px h-6 bg-white/10 mx-1"></div>

                {onFlatten && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                title="Flatten Canvas"
                                onClick={onFlatten}
                                className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"
                                aria-label="Flatten Canvas"
                            >
                                <Layers size={18} />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-[#1a1a1a] text-white border-white/10 z-50">Flatten Canvas</TooltipContent>
                    </Tooltip>
                )}

                {onUndoFlatten && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                title="Undo Flatten"
                                onClick={onUndoFlatten}
                                disabled={!canUndoFlatten}
                                className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"
                                aria-label="Undo Flatten"
                            >
                                <Undo2 size={18} />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-[#1a1a1a] text-white border-white/10 z-50">Restore layers from last flatten</TooltipContent>
                    </Tooltip>
                )}

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            title="Delete Selected"
                            onClick={() => selectedCanvasImageId && removeCanvasImage(selectedCanvasImageId)}
                            disabled={!selectedCanvasImageId}
                            className="p-2 rounded-full text-red-400 hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none"
                            aria-label="Delete Selected"
                        >
                            <Eraser size={18} />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-[#1a1a1a] text-white border-white/10 z-50">Delete Selected</TooltipContent>
                </Tooltip>

                {onGenerateVariations && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                title="Generate Variations"
                                onClick={onGenerateVariations}
                                disabled={!selectedCanvasImageId}
                                className="px-3 py-1.5 rounded-full text-sm font-medium bg-dept-creative text-white hover:bg-dept-creative/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:ring-2 focus-visible:ring-dept-creative/40 focus-visible:outline-none flex items-center gap-1"
                                aria-label="Generate Variations"
                            >
                                Variations
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-[#1a1a1a] text-white border-white/10 z-50">Generate Variations</TooltipContent>
                    </Tooltip>
                )}

                {onRetryFailedVariations && failedVariationCount && failedVariationCount > 0 ? (
                    <button
                        title="Retry Failed Variations"
                        onClick={onRetryFailedVariations}
                        className="px-3 py-1.5 rounded-full text-sm font-medium border border-amber-400/50 text-amber-200 hover:bg-amber-400/10 transition-colors"
                        aria-label="Retry Failed Variations"
                    >
                        Retry {failedVariationCount} failed
                    </button>
                ) : null}
            </div>
        </TooltipProvider>
    );
});

InfiniteCanvasHUD.displayName = 'InfiniteCanvasHUD';
