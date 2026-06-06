import React from 'react';
import { Film, Image as ImageIcon, Layers, Play, Save, Sparkles, Wand2, X } from 'lucide-react';
import { HistoryItem } from '@/core/store';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CanvasActionRailProps {
    item: HistoryItem;
    endFrameItem: { id: string; url: string; prompt: string; type: 'image' | 'video' } | null;
    setEndFrameItem: (item: { id: string; url: string; prompt: string; type: 'image' | 'video' } | null) => void;
    setIsSelectingEndFrame: (isSelecting: boolean) => void;
    handleAnimate: () => void;
    onClose: () => void;
    onSendToWorkflow?: (type: 'firstFrame' | 'lastFrame', item: HistoryItem) => void;
    onCreateLastFrame?: () => void;
    isProcessing: boolean;
    processingStatus?: string;
    saveCanvas: () => void;
    batchExportDimensions?: () => void;
    flattenCanvas?: () => void;
}

export const CanvasActionRail: React.FC<CanvasActionRailProps> = ({
    item,
    endFrameItem,
    setEndFrameItem,
    setIsSelectingEndFrame,
    handleAnimate,
    onClose,
    onSendToWorkflow,
    onCreateLastFrame,
    isProcessing,
    processingStatus,
    saveCanvas,
    batchExportDimensions,
    flattenCanvas,
}) => {
    const actionButtonClass = "w-11 h-11 rounded-xl border border-white/10 bg-[#0b0d10]/90 text-gray-300 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dept-creative/50 disabled:opacity-40 disabled:cursor-not-allowed";
    const primaryButtonClass = "w-11 h-11 rounded-xl border border-dept-creative/30 bg-dept-creative text-white shadow-[0_0_22px_rgba(0,255,136,0.25)] hover:bg-dept-creative/80 transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dept-creative/60 disabled:opacity-50 disabled:cursor-not-allowed";
    const closeButtonClass = "w-11 h-11 rounded-xl border border-red-500/10 bg-red-950/10 text-gray-400 hover:text-red-300 hover:bg-red-950/40 transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50";
    const capabilityGroups = [
        {
            id: 'exports',
            actions: [
                {
                    id: 'multi-format',
                    label: 'Multi-Format Export',
                    icon: ImageIcon,
                    onClick: batchExportDimensions,
                    disabled: isProcessing || !batchExportDimensions,
                    className: actionButtonClass,
                },
                {
                    id: 'send-video',
                    label: 'Send to Video',
                    icon: Film,
                    onClick: () => onSendToWorkflow?.('firstFrame', item),
                    disabled: isProcessing || !onSendToWorkflow,
                    className: actionButtonClass,
                    testId: 'send-to-video-btn',
                },
                {
                    id: 'flatten',
                    label: 'Flatten Canvas',
                    icon: Layers,
                    onClick: flattenCanvas,
                    disabled: isProcessing || !flattenCanvas,
                    className: actionButtonClass,
                },
            ],
        },
        {
            id: 'commit',
            actions: [
                {
                    id: 'save',
                    label: 'Save Canvas',
                    icon: Save,
                    onClick: saveCanvas,
                    className: primaryButtonClass,
                    testId: 'save-canvas-btn',
                },
            ],
        },
        {
            id: 'generation',
            actions: item.type === 'image'
                ? [
                    {
                        id: 'last-frame',
                        label: processingStatus || 'Create Last Frame',
                        icon: isProcessing && processingStatus ? Wand2 : Sparkles,
                        onClick: onCreateLastFrame || (() => setIsSelectingEndFrame(true)),
                        disabled: isProcessing,
                        className: primaryButtonClass,
                        testId: 'create-last-frame-inline-btn',
                        spin: isProcessing && !!processingStatus,
                    },
                    {
                        id: 'animate',
                        label: 'Animate',
                        icon: Play,
                        onClick: handleAnimate,
                        className: "w-11 h-11 rounded-xl border border-dept-marketing/40 bg-dept-marketing text-white hover:bg-dept-marketing/80 transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dept-marketing/60",
                        testId: 'animate-btn',
                    },
                ]
                : [],
        },
    ].filter(group => group.actions.length > 0);

    return (
        <TooltipProvider delayDuration={200}>
            <aside
                className="pointer-events-auto flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-[#050608]/82 p-2 shadow-[0_18px_48px_rgba(0,0,0,0.48)] backdrop-blur-2xl"
                aria-label="Canvas actions"
            >
                {capabilityGroups.map((group, index) => (
                    <React.Fragment key={group.id}>
                        {index > 0 && <div className="h-px w-8 bg-white/10 my-1" />}
                        {group.id === 'generation' && endFrameItem && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => setEndFrameItem(null)}
                                        aria-label="Remove end frame"
                                        className="relative h-11 w-11 overflow-hidden rounded-xl border border-white/15 bg-white/5"
                                    >
                                        <img src={endFrameItem.url} alt="End Frame" className="h-full w-full object-cover" />
                                        <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-white opacity-0 transition-opacity hover:opacity-100">
                                            <X size={16} />
                                        </span>
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="left">Remove End Frame</TooltipContent>
                            </Tooltip>
                        )}
                        {group.actions
                            .filter(action => !(group.id === 'generation' && endFrameItem && action.id === 'last-frame'))
                            .map((action) => {
                                const Icon = action.icon;
                                return (
                                    <Tooltip key={action.id}>
                                        <TooltipTrigger asChild>
                                            <button
                                                onClick={action.onClick}
                                                data-testid={action.testId}
                                                disabled={action.disabled}
                                                className={action.className}
                                                aria-label={action.label}
                                            >
                                                <Icon size={18} className={action.spin ? 'animate-spin' : undefined} />
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="left">{action.label}</TooltipContent>
                                    </Tooltip>
                                );
                            })}
                    </React.Fragment>
                ))}

                <div className="h-px w-8 bg-white/10 my-1" />

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={onClose}
                            data-testid="canvas-close-btn"
                            aria-label="Close canvas"
                            className={closeButtonClass}
                        >
                            <X size={18} />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="left">Close Canvas</TooltipContent>
                </Tooltip>
            </aside>
        </TooltipProvider>
    );
};
