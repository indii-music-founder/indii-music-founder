import React from 'react';
import { Wand2 } from 'lucide-react';
import { HistoryItem } from '@/core/store';
import { CandidatesCarousel, Candidate } from './CandidatesCarousel';
import { EndFrameSelector } from './EndFrameSelector';
import { CreativeColor } from '../constants';

interface CanvasViewportProps {
    item: HistoryItem;
    canvasRef: React.RefObject<HTMLCanvasElement>;
    isMagicFillMode: boolean;
    activeColor: CreativeColor;
    generatedCandidates: Candidate[];
    onCandidateSelect: (candidate: Candidate, index: number) => void;
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
    onCandidateSelect,
    onCloseCandidates,
    isSelectingEndFrame,
    setIsSelectingEndFrame,
    generatedHistory,
    onEndFrameSelect
}: CanvasViewportProps) {
    return (
        <main className="flex-1 relative bg-[#050505] flex items-center justify-center overflow-hidden p-12">
            {item.type === 'video' && !item.url.startsWith('data:image') ? (
                <video src={item.url} controls className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" />
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
                        <div className="absolute top-4 left-4 bg-purple-600/90 text-white text-xs font-bold px-3 py-1 rounded-md backdrop-blur-sm shadow-lg border border-white/20 pointer-events-none">
                            STORYBOARD PREVIEW
                        </div>
                    )}
                </div>
            )}

            {/* Floating Interaction Status */}
            {isMagicFillMode && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-blue-600/20 border border-blue-500/50 text-blue-400 px-4 py-1 rounded-full text-xs font-bold backdrop-blur-md flex items-center gap-2">
                    <Wand2 size={12} />
                    Magic Edit Mode: {activeColor.name}
                </div>
            )}

            {/* Candidates Overlay */}
            <CandidatesCarousel
                candidates={generatedCandidates}
                onSelect={onCandidateSelect}
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
