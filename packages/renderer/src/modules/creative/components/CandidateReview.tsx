import React, { useState, useCallback } from 'react';
import { Check, X, RefreshCw, ChevronUp, ChevronDown, ZoomIn } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface Candidate {
    id: string;
    url: string;
    prompt: string;
    thoughtSignature?: string;
}

interface CandidateReviewProps {
    candidates: Candidate[];
    onApply: (selected: Candidate[]) => void;
    onClose: () => void;
    onRegenerate?: () => void;
}

/**
 * CandidateReview — A 2×2 grid overlay for reviewing up to 4 AI-generated options.
 * Supports multi-select via checkboxes, zoom preview, and batch apply.
 *
 * Replaces the old CandidatesCarousel's single-click-apply behavior with a deliberate
 * review → select → apply workflow per Flowchart 1.
 */
export function CandidateReview({ candidates, onApply, onClose, onRegenerate }: CandidateReviewProps) {
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [previewId, setPreviewId] = useState<string | null>(null);
    const [isCollapsed, setIsCollapsed] = useState(false);

    const toggleSelection = useCallback((id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    const selectAll = useCallback(() => {
        setSelected(new Set(candidates.map(c => c.id)));
    }, [candidates]);

    const deselectAll = useCallback(() => {
        setSelected(new Set());
    }, []);

    const handleApply = useCallback(() => {
        const selectedCandidates = candidates.filter(c => selected.has(c.id));
        if (selectedCandidates.length === 0) return;
        onApply(selectedCandidates);
    }, [candidates, selected, onApply]);

    if (candidates.length === 0) return null;

    const previewCandidate = previewId ? candidates.find(c => c.id === previewId) : null;
    const gridCols = candidates.length <= 2 ? 'grid-cols-2' : 'grid-cols-2';
    const allSelected = selected.size === candidates.length;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: 60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 60, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-[680px]"
                data-testid="candidate-review-panel"
            >
                <div className="bg-[#111111]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.8)] overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
                        <div className="flex items-center gap-3">
                            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                                Review Options
                            </h3>
                            <span className="text-[10px] font-mono text-gray-600">
                                {selected.size}/{candidates.length} selected
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Select All / Deselect All */}
                            <button
                                onClick={allSelected ? deselectAll : selectAll}
                                className="text-[10px] font-bold text-gray-500 hover:text-gray-300 uppercase tracking-wider transition-colors"
                                data-testid="toggle-select-all"
                            >
                                {allSelected ? 'Deselect All' : 'Select All'}
                            </button>

                            {/* Collapse Toggle */}
                            <button
                                onClick={() => setIsCollapsed(!isCollapsed)}
                                className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                                title={isCollapsed ? 'Expand' : 'Collapse'}
                            >
                                {isCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>

                            {/* Close */}
                            <button
                                onClick={onClose}
                                data-testid="candidate-review-close"
                                className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                                aria-label="Close candidates"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Grid — Collapsible */}
                    {!isCollapsed && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <div className={`grid ${gridCols} gap-2 p-3`}>
                                {candidates.map((cand, idx) => {
                                    const isSelected = selected.has(cand.id);

                                    return (
                                        <div
                                            key={cand.id}
                                            className={`relative group rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                                                isSelected
                                                    ? 'border-purple-500 ring-1 ring-purple-500/30 shadow-[0_0_16px_rgba(168,85,247,0.15)]'
                                                    : 'border-white/5 hover:border-white/20'
                                            }`}
                                            onClick={() => toggleSelection(cand.id)}
                                            data-testid={`candidate-card-${idx}`}
                                        >
                                            {/* Image */}
                                            <div className="relative aspect-square bg-black/40">
                                                <img
                                                    src={cand.url}
                                                    alt={`Option ${idx + 1}`}
                                                    className="w-full h-full object-cover"
                                                    loading="lazy"
                                                />

                                                {/* Checkbox Overlay — Top Left */}
                                                <div className={`absolute top-2 left-2 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                                                    isSelected
                                                        ? 'bg-purple-500 border-purple-400'
                                                        : 'bg-black/40 border-white/30 group-hover:border-white/50'
                                                }`}>
                                                    {isSelected && <Check size={12} className="text-white" strokeWidth={3} />}
                                                </div>

                                                {/* Option Label — Top Right */}
                                                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-md px-2 py-0.5">
                                                    <span className="text-[10px] font-bold text-white/80">
                                                        {idx + 1}/{candidates.length}
                                                    </span>
                                                </div>

                                                {/* Zoom Button — Bottom Right */}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setPreviewId(cand.id); }}
                                                    className="absolute bottom-2 right-2 p-1.5 bg-black/60 backdrop-blur-sm rounded-lg text-white/60 hover:text-white hover:bg-black/80 opacity-0 group-hover:opacity-100 transition-all"
                                                    aria-label={`Zoom option ${idx + 1}`}
                                                >
                                                    <ZoomIn size={14} />
                                                </button>

                                                {/* Selection Glow */}
                                                {isSelected && (
                                                    <div className="absolute inset-0 bg-purple-500/5 pointer-events-none" />
                                                )}
                                            </div>

                                            {/* Prompt Snippet */}
                                            <div className="px-2 py-1.5 bg-black/40">
                                                <p className="text-[9px] text-gray-500 truncate leading-tight">
                                                    {cand.prompt}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}

                    {/* Action Bar */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/5 bg-black/20">
                        <div className="flex items-center gap-2">
                            {/* Regenerate */}
                            {onRegenerate && (
                                <button
                                    onClick={onRegenerate}
                                    data-testid="candidate-regenerate-btn"
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold text-gray-400 hover:text-gray-200 border border-white/10 hover:border-white/20 transition-all uppercase tracking-wider"
                                >
                                    <RefreshCw size={12} />
                                    Regenerate
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Cancel */}
                            <button
                                onClick={onClose}
                                className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-gray-500 hover:text-gray-300 border border-transparent hover:border-white/10 transition-all uppercase tracking-wider"
                            >
                                Cancel
                            </button>

                            {/* Apply Selected */}
                            <button
                                onClick={handleApply}
                                disabled={selected.size === 0}
                                data-testid="candidate-apply-btn"
                                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                                    selected.size > 0
                                        ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_12px_rgba(168,85,247,0.3)] hover:shadow-[0_0_20px_rgba(168,85,247,0.4)]'
                                        : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                                }`}
                            >
                                <Check size={12} />
                                Apply{selected.size > 0 ? ` (${selected.size})` : ''}
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Zoom Preview Modal */}
            {previewCandidate && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-9999 bg-black/90 backdrop-blur-xl flex items-center justify-center p-8"
                    onClick={() => setPreviewId(null)}
                    data-testid="candidate-zoom-modal"
                >
                    <div
                        className="relative max-w-3xl max-h-[80vh] flex flex-col items-center gap-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setPreviewId(null)}
                            className="absolute -top-3 -right-3 z-10 p-2 bg-white/10 rounded-full text-white hover:bg-red-500/30 hover:text-red-300 transition-all"
                            aria-label="Close zoom"
                        >
                            <X size={16} />
                        </button>
                        <img
                            src={previewCandidate.url}
                            alt="Zoomed candidate"
                            className="max-h-[70vh] w-auto rounded-xl border border-white/10 shadow-2xl shadow-black/80 object-contain"
                        />
                        <p className="text-xs text-gray-400 max-w-md text-center truncate">
                            {previewCandidate.prompt}
                        </p>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
