import React, { useState, useEffect } from 'react';
import { judgeTopImageVariationCandidate } from '@/config/typesafeJudgments';

export interface Candidate {
    id: string;
    url: string;
    prompt: string;
    thoughtSignature?: string;
    storageUri?: string;
}

interface CandidatesCarouselProps {
    candidates: Candidate[];
    onSelect: (candidate: Candidate, index: number) => void;
    onClose: () => void;
}

export function CandidatesCarousel({ candidates, onSelect, onClose }: CandidatesCarouselProps) {
    const [recommendedId, setRecommendedId] = useState<string | null>(null);

    // Fast Jev System One pre-selection recommendation
    useEffect(() => {
        if (!candidates || candidates.length <= 1) return;
        let active = true;
        const prompt = candidates[0]?.prompt || '';

        const candidateItems = candidates.map(c => ({
            id: c.id,
            promptAlignmentSummary: c.prompt,
        }));

        judgeTopImageVariationCandidate(prompt, candidateItems)
            .then((res) => {
                if (!active || !res) return;
                setRecommendedId(res.topCandidateId);
            })
            .catch(() => {});

        return () => {
            active = false;
        };
    }, [candidates]);

    if (candidates.length === 0) return null;

    return (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-gray-700 p-4 rounded-xl shadow-2xl z-50 flex gap-4 max-w-[90%] overflow-x-auto">
            {candidates.map((cand, idx) => {
                const isRecommended = cand.id === recommendedId;
                return (
                    <div
                        key={cand.id}
                        className={`relative group min-w-[150px] w-[150px] rounded border transition-all ${
                            isRecommended
                                ? 'border-amber-400/90 ring-2 ring-amber-400/50 shadow-amber-500/20 shadow-lg'
                                : 'border-gray-800'
                        }`}
                    >
                        {isRecommended && (
                            <div
                                data-testid="jev-recommended-badge"
                                className="absolute top-1.5 left-1.5 bg-gradient-to-r from-amber-400 to-yellow-300 text-black text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shadow flex items-center gap-1 z-10 pointer-events-none"
                            >
                                ⭐ Jev Pick
                            </div>
                        )}
                        <img
                            src={cand.url}
                            alt={`Candidate ${idx + 1}`}
                            className="w-full h-auto rounded"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1 text-[10px] text-center truncate text-white">
                            {cand.prompt}
                        </div>
                        <button
                            onClick={() => onSelect(cand, idx)}
                            data-testid={`candidate-select-btn-${idx}`}
                            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 flex items-center justify-center transition-opacity focus-visible:ring-2 focus-visible:ring-white outline-none"
                            aria-label={`Select candidate ${idx + 1}: ${cand.prompt}${isRecommended ? ' (Jev Recommended Pick)' : ''}`}
                        >
                            <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-lg group-focus-within:ring-2 group-focus-within:ring-white text-white ${
                                isRecommended ? 'bg-amber-500 hover:bg-amber-400 text-black' : 'bg-green-600 hover:bg-green-500'
                            }`}>
                                {isRecommended ? 'Select Pick' : 'Select'}
                            </span>
                        </button>
                    </div>
                );
            })}
            <button
                onClick={onClose}
                data-testid="carousel-close-btn"
                className="w-8 h-8 rounded-full bg-gray-800 text-gray-400 hover:text-white flex items-center justify-center self-center focus-visible:ring-2 focus-visible:ring-white outline-none shrink-0"
                aria-label="Close candidates"
            >
                <span className="text-xl" aria-hidden="true">&times;</span>
            </button>
        </div>
    );
}

