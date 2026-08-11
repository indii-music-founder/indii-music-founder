import React from 'react';
import { Wand2 } from 'lucide-react';
import { HistoryItem } from '@/core/store';
import { CandidateReview, Candidate } from './CandidateReview';
import { EndFrameSelector } from './EndFrameSelector';
import { CreativeColor } from '../constants';
import { useResolvedStorageUrl } from '@/hooks/useResolvedStorageUrl';

interface CanvasViewportProps {
    item: HistoryItem;
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    isMagicFillMode: boolean;
    activeColor: CreativeColor;
    generatedCandidates: Candidate[];
    onCandidateApply: (candidates: Candidate[]) => void;
    onCloseCandidates: () => void;
    isSelectingEndFrame: boolean;
    setIsSelectingEndFrame: (open: boolean) => void;
    generatedHistory: HistoryItem[];
    onEndFrameSelect: (item: HistoryItem) => void;
}

export function CanvasViewport({
    item,
    canvasRef,
    isMagicFillMode,
    activeColor,
    generatedCandidates,
    onCandidateApply,
    onCloseCandidates,
    isSelectingEndFrame,
    setIsSelectingEndFrame,
    generatedHistory,
    onEndFrameSelect
}: CanvasViewportProps) {
    const { url: resolvedVideoUrl, isResolving, error: resolveError } = useResolvedStorageUrl(item.type === 'video' ? item.url : null);

    return (
        <main className="flex-1 relative bg-transparent flex items-center justify-center overflow-hidden p-12">
            {item.type === 'video' && !item.url.startsWith('data:image') ? (
                isResolving ? (
                    <div className="flex items-center justify-center rounded-lg border border-white/10 bg-black/70 px-4 py-3 text-sm text-white/60">
                        Resolving playback asset...
                    </div>
                ) : resolveError ? (
                    <div className="flex items-center justify-center rounded-lg border border-red-500/20 bg-[#1a0f0f] px-4 py-3 text-sm text-red-300">
                        Playback asset unavailable.
                    </div>
                ) : (
                    <video src={resolvedVideoUrl} controls className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" />
                )
            ) : (
                <div
                    className="relative w-full h-full flex items-center justify-center group"
                    onClick={(e) => isMagicFillMode && e.stopPropagation()}
                >
                    <canvas
                        ref={canvasRef}
                        className="max-w-full max-h-full object-contain shadow-2xl rounded-lg cursor-crosshair"
                        data-testid="creative-canvas-element"
                    />
                    {item.type === 'video' && item.url.startsWith('data:image') && (
                        <div className="absolute top-4 left-4 bg-green-600/90 text-white text-xs font-bold px-3 py-1 rounded-md backdrop-blur-sm shadow-lg border border-white/20 pointer-events-none">
                            STORYBOARD PREVIEW
                        </div>
                    )}
                </div>
            )}

            {/* Floating Interaction Status */}
            {isMagicFillMode && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-950/80 border border-blue-500/40 text-blue-300 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md flex items-center gap-2 shadow-lg z-30 pointer-events-none">
                    <Wand2 size={12} className="text-blue-400 animate-pulse" />
                    <span>Magic Edit Mode: <strong className="text-white">{activeColor.name}</strong></span>
                </div>
            )}

            {/* Candidates Overlay */}
            <CandidateReview
                candidates={generatedCandidates}
                onApply={onCandidateApply}
                onClose={onCloseCandidates}
            />

            <EndFrameSelector
                isOpen={isSelectingEndFrame}
                onClose={() => setIsSelectingEndFrame(false)}
                generatedHistory={generatedHistory}
                currentItemId={item.id}
                onSelect={onEndFrameSelect}
            />
        </main>
    );
}
