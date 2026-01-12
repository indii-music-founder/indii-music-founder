import React from 'react';

export interface Candidate {
    id: string;
    url: string;
    prompt: string;
}

interface CandidatesCarouselProps {
    candidates: Candidate[];
    onSelect: (candidate: Candidate, index: number) => void;
    onClose: () => void;
}

export function CandidatesCarousel({ candidates, onSelect, onClose }: CandidatesCarouselProps) {
    if (candidates.length === 0) return null;

    return (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-gray-700 p-4 rounded-xl shadow-2xl z-50 flex gap-4 max-w-[90%] overflow-x-auto">
            {candidates.map((cand, idx) => (
                <div key={cand.id} className="relative group min-w-[150px] w-[150px]">
                    <img
                        src={cand.url}
                        alt={`Candidate ${idx + 1}`}
                        className="w-full h-auto rounded border border-gray-800"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1 text-[10px] text-center truncate text-white">
                        {cand.prompt}
                    </div>
                    <button
                        onClick={() => onSelect(cand, idx)}
                        data-testid={`candidate-select-btn-${idx}`}
                        aria-label={`Select candidate ${idx + 1}: ${cand.prompt}`}
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 flex items-center justify-center transition-opacity focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                    >
                        <span className="bg-purple-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                            Select
                        </span>
                    </button>
                </div>
            ))}
            <button
                onClick={onClose}
                data-testid="carousel-close-btn"
                aria-label="Close candidates"
                className="w-8 h-8 rounded-full bg-gray-800 text-gray-400 hover:text-white flex items-center justify-center self-center focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
            >
                <span className="text-xl" aria-hidden="true">&times;</span>
            </button>
        </div>
    );
}
