import React, { useCallback, useEffect, useState } from 'react';
import { Sparkles, UserCheck, AlertCircle, RefreshCw, Layers, CheckCircle2, XCircle, ArrowUpRight } from 'lucide-react';
import { LikenessService, type LikenessImage } from '@/services/image/LikenessService';
import {
    fuseLikeness,
    IDENTITY_SIMILARITY_THRESHOLD,
    type FusionResult
} from '@/services/identity/LikenessFusionService';
import { createDocFromImage } from '@/services/canvas/CanvasDoc';
import { resolveStorageUrl } from '@/services/storage/resolveStorageUrl';
import { useStore } from '@/core/store';
import { logger } from '@/utils/logger';

interface LikenessFusionPanelProps {
    targetImageUrl?: string;
    onFusionComplete?: (result: FusionResult) => void;
}

export default function LikenessFusionPanel({
    targetImageUrl,
    onFusionComplete,
}: LikenessFusionPanelProps): React.ReactElement {
    const selectedItem = useStore(state => state.selectedItem);
    const addToHistory = useStore(state => state.addToHistory);
    const currentProjectId = useStore(state => state.currentProjectId);
    const openDoc = useStore(state => state.openDoc);

    const [headshots, setHeadshots] = useState<LikenessImage[]>([]);
    const [selectedHeadshotId, setSelectedHeadshotId] = useState<string>('');
    const [maxAttempts, setMaxAttempts] = useState<number>(3);
    const [preservePromptNote, setPreservePromptNote] = useState<string>('');
    const [isLoadingHeadshots, setIsLoadingHeadshots] = useState<boolean>(true);
    const [isFusing, setIsFusing] = useState<boolean>(false);
    const [fusionResult, setFusionResult] = useState<FusionResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const activeTarget = targetImageUrl || (selectedItem?.type === 'image' ? selectedItem.url : '');

    const loadHeadshots = useCallback(async () => {
        setIsLoadingHeadshots(true);
        setError(null);
        try {
            const list = await LikenessService.getAll();
            setHeadshots(list || []);
            if (list && list.length > 0) {
                setSelectedHeadshotId(prev => prev || list[0].id);
            }
        } catch (err) {
            logger.error('[LikenessFusionPanel] Failed to load headshots:', err);
            setError(err instanceof Error ? err.message : 'Failed to load likeness selfies.');
        } finally {
            setIsLoadingHeadshots(false);
        }
    }, []);

    useEffect(() => {
        loadHeadshots();
    }, [loadHeadshots]);

    const handleFuse = async () => {
        if (!activeTarget) {
            setError('Please select or provide a target image to fuse onto.');
            return;
        }

        setIsFusing(true);
        setError(null);
        setFusionResult(null);

        try {
            const resolvedTarget = await resolveStorageUrl(activeTarget);
            const result = await fuseLikeness({
                targetDataUrl: resolvedTarget,
                headshotId: selectedHeadshotId || undefined,
                maxAttempts,
                preservePromptNote: preservePromptNote.trim() || undefined,
            });

            setFusionResult(result);
            onFusionComplete?.(result);

            // Record to history
            if (addToHistory && result.dataUrl) {
                addToHistory({
                    id: `fusion_${Date.now()}`,
                    projectId: currentProjectId || 'default',
                    type: 'image',
                    url: result.dataUrl,
                    prompt: `Likeness fusion (similarity: ${result.similarity.toFixed(3)})`,
                    timestamp: Date.now(),
                    meta: JSON.stringify({
                        type: 'likeness_fusion',
                        similarity: result.similarity,
                        headshotId: selectedHeadshotId || 'newest',
                        passedThreshold: result.passedThreshold,
                        attemptsCount: result.attempts.length,
                    }),
                    origin: 'editor',
                });
            }
        } catch (err) {
            logger.error('[LikenessFusionPanel] Fusion execution failed:', err);
            setError(err instanceof Error ? err.message : 'Likeness fusion failed.');
        } finally {
            setIsFusing(false);
        }
    };

    const handleOpenInLayerEditor = () => {
        if (!fusionResult?.dataUrl) return;
        try {
            const doc = createDocFromImage(fusionResult.dataUrl, currentProjectId || 'default');
            openDoc?.(doc);
        } catch (err) {
            logger.error('[LikenessFusionPanel] Failed to open in layer editor:', err);
            setError('Failed to open document in Layer Editor.');
        }
    };

    return (
        <div data-testid="likeness-fusion-panel" className="flex flex-col gap-4 text-xs text-gray-300">
            {/* Header info */}
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <div className="flex items-center gap-2">
                    <UserCheck size={16} className="text-green-400" />
                    <span className="font-semibold text-white">Direct Likeness Fusion</span>
                </div>
                <span className="text-[10px] text-gray-500 font-mono">Biometric Loop</span>
            </div>

            {/* Error Notification */}
            {error && (
                <div
                    data-testid="fusion-error-banner"
                    className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-2"
                >
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    <div className="flex-1 text-[11px] leading-relaxed">{error}</div>
                </div>
            )}

            {/* Verified Headshot Selection */}
            <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                    <label className="text-[11px] font-medium text-gray-300">Verified Headshot (Source)</label>
                    <button
                        type="button"
                        onClick={loadHeadshots}
                        className="p-1 hover:text-white transition-colors text-gray-500"
                        title="Reload Headshots"
                    >
                        <RefreshCw size={12} className={isLoadingHeadshots ? 'animate-spin' : ''} />
                    </button>
                </div>

                {isLoadingHeadshots ? (
                    <div className="p-3 bg-white/5 rounded-lg text-center text-gray-500 animate-pulse">
                        Loading verified selfies...
                    </div>
                ) : headshots.length === 0 ? (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex flex-col gap-2">
                        <span className="text-amber-300 font-medium">No verified headshots found</span>
                        <p className="text-[10px] text-gray-400">
                            Likeness fusion requires a verified selfie uploaded in My Likeness to ensure biometric authenticity.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-2">
                        {headshots.map(h => {
                            const isSelected = h.id === selectedHeadshotId;
                            return (
                                <button
                                    key={h.id}
                                    type="button"
                                    onClick={() => setSelectedHeadshotId(h.id)}
                                    data-testid={`headshot-card-${h.id}`}
                                    className={`relative rounded-lg overflow-hidden border aspect-square transition-all ${
                                        isSelected
                                            ? 'border-green-500 ring-2 ring-green-500/30'
                                            : 'border-white/10 hover:border-white/25 opacity-70 hover:opacity-100'
                                    }`}
                                >
                                    <img
                                        src={h.url}
                                        alt={`Headshot ${h.id}`}
                                        className="w-full h-full object-cover"
                                    />
                                    <span
                                        className={`absolute bottom-1 right-1 text-[8px] px-1 py-0.5 rounded font-mono ${
                                            h.qualityScore === 'good'
                                                ? 'bg-green-500/80 text-black'
                                                : 'bg-black/60 text-gray-300'
                                        }`}
                                    >
                                        {h.qualityScore}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Target Subject Preview */}
            <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-gray-300">Target Image (Destination)</label>
                {activeTarget ? (
                    <div className="relative rounded-lg overflow-hidden border border-white/10 aspect-video bg-black/40 flex items-center justify-center">
                        <img
                            src={activeTarget}
                            alt="Target visual"
                            className="max-h-full max-w-full object-contain"
                        />
                        <span className="absolute top-1.5 left-1.5 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[9px] text-gray-300">
                            Active Target
                        </span>
                    </div>
                ) : (
                    <div className="p-4 border border-dashed border-white/10 rounded-lg text-center text-gray-500">
                        Select an image in Creative Studio or Gallery to fuse likeness onto.
                    </div>
                )}
            </div>

            {/* Fusion Parameters */}
            <div className="grid grid-cols-2 gap-2 bg-white/[0.02] p-2.5 rounded-lg border border-white/5">
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-gray-400">Max Retry Attempts</label>
                    <input
                        type="number"
                        min={1}
                        max={5}
                        value={maxAttempts}
                        onChange={e => setMaxAttempts(Math.min(5, Math.max(1, Number(e.target.value) || 1)))}
                        data-testid="fusion-max-attempts-input"
                        className="bg-black/40 border border-white/10 rounded px-2 py-1 text-white text-xs"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-gray-400">Score Threshold</label>
                    <div className="bg-black/40 border border-white/5 rounded px-2 py-1 text-green-400 font-mono text-xs">
                        ≥ {IDENTITY_SIMILARITY_THRESHOLD.toFixed(2)} (Locked)
                    </div>
                </div>
            </div>

            {/* Steering Note */}
            <div className="flex flex-col gap-1">
                <label className="text-[10px] text-gray-400">Optional Steering Note</label>
                <input
                    type="text"
                    placeholder="e.g. emphasize cheekbones, dramatic lighting"
                    value={preservePromptNote}
                    onChange={e => setPreservePromptNote(e.target.value)}
                    data-testid="fusion-steering-note"
                    className="bg-black/40 border border-white/10 rounded px-2.5 py-1.5 text-white text-xs focus:border-green-500/50 outline-none"
                />
            </div>

            {/* Execute Button */}
            <button
                type="button"
                onClick={handleFuse}
                disabled={isFusing || !activeTarget || (headshots.length === 0 && !selectedHeadshotId)}
                data-testid="fuse-likeness-btn"
                className="w-full py-2 px-3 rounded-lg bg-green-600 hover:bg-green-500 disabled:bg-gray-800 disabled:text-gray-600 font-medium text-white transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
                {isFusing ? (
                    <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Measuring & Fusing Likeness...</span>
                    </>
                ) : (
                    <>
                        <Sparkles size={14} />
                        <span>Fuse Likeness onto Image</span>
                    </>
                )}
            </button>

            {/* Results Section */}
            {fusionResult && (
                <div
                    data-testid="fusion-results-section"
                    className="flex flex-col gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10 mt-1"
                >
                    <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">Fusion Result</span>
                        {fusionResult.passedThreshold ? (
                            <span className="flex items-center gap-1 text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20 font-medium">
                                <CheckCircle2 size={12} />
                                Passed Threshold
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 font-medium">
                                <XCircle size={12} />
                                Below Threshold
                            </span>
                        )}
                    </div>

                    <div className="relative rounded-lg overflow-hidden border border-white/10 aspect-square bg-black/60 flex items-center justify-center">
                        <img
                            src={fusionResult.dataUrl}
                            alt="Fused Output"
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-2 left-2 right-2 p-2 bg-black/80 backdrop-blur-md rounded-lg flex items-center justify-between border border-white/10">
                            <div>
                                <span className="text-[9px] text-gray-400 block">Identity Similarity</span>
                                <span
                                    data-testid="similarity-score-readout"
                                    className={`text-sm font-bold font-mono ${
                                        fusionResult.passedThreshold ? 'text-green-400' : 'text-amber-400'
                                    }`}
                                >
                                    {(fusionResult.similarity * 100).toFixed(1)}%
                                </span>
                            </div>
                            <div className="text-right">
                                <span className="text-[9px] text-gray-400 block">Attempts</span>
                                <span className="text-xs text-gray-200 font-mono">
                                    {fusionResult.attempts.length} run(s)
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={handleOpenInLayerEditor}
                            data-testid="open-in-layer-editor-btn"
                            className="flex-1 py-1.5 px-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                            <Layers size={13} />
                            <span>Layer Editor</span>
                        </button>
                        <a
                            href={fusionResult.dataUrl}
                            download={`likeness-fusion-${Date.now()}.png`}
                            className="flex-1 py-1.5 px-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                        >
                            <ArrowUpRight size={13} />
                            <span>Download</span>
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}
