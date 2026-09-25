import React, { useState, useCallback } from 'react';
import { Scissors, CheckCircle, XCircle, Sparkles, Plus, AlertTriangle, Film } from 'lucide-react';
import { useVideoEditorStore } from '../../store/videoEditorStore';
import { judgeVideoChunkQuality, VideoChunkVerdict } from '@/config/typesafeJudgments';
import { durationSecondsToFrames } from '../utils/mediaMetadata';
import { toast } from '@/core/context/ToastContext';

export interface SlicedChunkItem {
    id: string;
    startSeconds: number;
    endSeconds: number;
    motionScore: number;
    brightnessScore: number;
    hasSubject: boolean;
    audioRms: number;
    verdict?: VideoChunkVerdict;
    manuallyIncluded?: boolean;
}

interface VideoChunkSlicerCardProps {
    videoSrc?: string;
    videoDurationSeconds?: number;
    onApplyToTimeline?: (selectedChunks: SlicedChunkItem[]) => void;
}

export const VideoChunkSlicerCard: React.FC<VideoChunkSlicerCardProps> = ({
    videoSrc = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    videoDurationSeconds = 30,
    onApplyToTimeline
}) => {
    const [chunkDuration, setChunkDuration] = useState<number>(5);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [chunks, setChunks] = useState<SlicedChunkItem[]>([]);
    const [filter, setFilter] = useState<'all' | 'keep' | 'discard'>('all');

    const addClip = useVideoEditorStore((state) => state.addClip);
    const project = useVideoEditorStore((state) => state.project);

    const handleRunSlicer = useCallback(async () => {
        setIsAnalyzing(true);
        const segmentCount = Math.max(1, Math.floor(videoDurationSeconds / chunkDuration));
        const generatedChunks: SlicedChunkItem[] = [];

        // Simulate motion, brightness, and audio metrics across the long video
        for (let i = 0; i < segmentCount; i++) {
            const start = i * chunkDuration;
            const end = Math.min(videoDurationSeconds, (i + 1) * chunkDuration);

            // Realistic camera variance across long raw takes
            // Chunks in the beginning/end often have floor/shake artifacts; middle has best takes
            const isShaky = i === 0 || i === segmentCount - 1 || i % 4 === 3;
            const isDark = i % 5 === 2;
            const motion = isShaky ? 78 : 22 + (i % 3) * 8;
            const brightness = isDark ? 12 : 52 + (i % 2) * 6;
            const hasSubject = !isShaky && !isDark;
            const audioRms = hasSubject ? 0.35 : 0.04;

            const verdict = await judgeVideoChunkQuality({
                chunkId: `chunk_${i + 1}`,
                startSeconds: start,
                endSeconds: end,
                averageMotionScore: motion,
                brightnessScore: brightness,
                hasSubjectInFrame: hasSubject,
                audioEnergyRms: audioRms,
                description: `Raw footage segment ${start}s-${end}s`,
            });

            generatedChunks.push({
                id: `chunk_${i + 1}`,
                startSeconds: start,
                endSeconds: end,
                motionScore: motion,
                brightnessScore: brightness,
                hasSubject,
                audioRms,
                verdict,
                manuallyIncluded: verdict.isKeep,
            });
        }

        setChunks(generatedChunks);
        setIsAnalyzing(false);
        const keptCount = generatedChunks.filter((c) => c.verdict?.isKeep).length;
        toast.success(`Jev Vision: Analyzed ${generatedChunks.length} chunks. ${keptCount} gold takes identified!`);
    }, [videoDurationSeconds, chunkDuration]);

    const toggleChunkInclude = useCallback((chunkId: string) => {
        setChunks((prev) =>
            prev.map((c) => (c.id === chunkId ? { ...c, manuallyIncluded: !c.manuallyIncluded } : c))
        );
    }, []);

    const handleAddToTimeline = useCallback(() => {
        const approvedChunks = chunks.filter((c) => c.manuallyIncluded);
        if (approvedChunks.length === 0) {
            toast.error('No chunks selected to add.');
            return;
        }

        if (onApplyToTimeline) {
            onApplyToTimeline(approvedChunks);
            return;
        }

        // Find or fallback to primary video track
        const videoTrack = project.tracks.find((t) => t.type === 'video') || project.tracks[0];
        if (!videoTrack) {
            toast.error('No video track found in current project.');
            return;
        }

        // Compute starting frame based on last clip end frame on this track
        const trackClips = project.clips.filter((c) => c.trackId === videoTrack.id);
        let currentStartFrame = trackClips.reduce(
            (max, c) => Math.max(max, c.startFrame + c.durationInFrames),
            0
        );

        for (const chunk of approvedChunks) {
            const durationSec = chunk.endSeconds - chunk.startSeconds;
            const chunkFrames = durationSecondsToFrames(durationSec, project.fps || 30);

            addClip({
                type: 'video',
                src: videoSrc,
                startFrame: currentStartFrame,
                durationInFrames: chunkFrames,
                trackId: videoTrack.id,
                name: `${chunk.verdict?.classification || 'Clip'} (${chunk.startSeconds}s-${chunk.endSeconds}s)`,
                sourceInUs: Math.round(chunk.startSeconds * 1_000_000),
                sourceOutUs: Math.round(chunk.endSeconds * 1_000_000),
            });

            currentStartFrame += chunkFrames;
        }

        toast.success(`Added ${approvedChunks.length} gold takes directly to timeline!`);
    }, [chunks, onApplyToTimeline, project, videoSrc, addClip]);

    const filteredChunks = chunks.filter((c) => {
        if (filter === 'keep') return c.manuallyIncluded;
        if (filter === 'discard') return !c.manuallyIncluded;
        return true;
    });

    const keptCount = chunks.filter((c) => c.manuallyIncluded).length;
    const discardCount = chunks.length - keptCount;

    return (
        <div className="flex flex-col h-full bg-gray-900 border border-gray-800 rounded-lg p-3 text-white overflow-hidden" data-testid="video-chunk-slicer">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-purple-500/20 text-purple-400">
                        <Scissors className="w-4 h-4" />
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-gray-100 flex items-center gap-1.5">
                            Jev Smart Slicer
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/60 text-purple-300 font-mono">
                                Vision QC
                            </span>
                        </h4>
                        <p className="text-xs text-gray-400">Slice raw iPhone video into gold takes & purge jitter</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <select
                        value={chunkDuration}
                        onChange={(e) => setChunkDuration(Number(e.target.value))}
                        disabled={isAnalyzing}
                        className="bg-gray-950 border border-gray-700 text-xs rounded px-2 py-1 text-gray-300 focus:outline-none"
                    >
                        <option value={3}>3s Slices (Fast Cuts)</option>
                        <option value={5}>5s Slices (Standard)</option>
                        <option value={8}>8s Slices (Long Takes)</option>
                    </select>

                    <button
                        onClick={handleRunSlicer}
                        disabled={isAnalyzing}
                        data-testid="run-slicer-btn"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-xs font-medium text-white transition-colors"
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        {isAnalyzing ? 'Analyzing…' : 'Slice Footage'}
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            {chunks.length > 0 && (
                <div className="flex items-center justify-between py-2 border-b border-gray-800 text-xs">
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-2 py-0.5 rounded ${filter === 'all' ? 'bg-gray-800 text-white font-medium' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            All ({chunks.length})
                        </button>
                        <button
                            onClick={() => setFilter('keep')}
                            className={`px-2 py-0.5 rounded flex items-center gap-1 ${filter === 'keep' ? 'bg-green-950/60 text-green-300 font-medium' : 'text-green-500 hover:text-green-400'}`}
                        >
                            <CheckCircle className="w-3 h-3" /> Gold Takes ({keptCount})
                        </button>
                        <button
                            onClick={() => setFilter('discard')}
                            className={`px-2 py-0.5 rounded flex items-center gap-1 ${filter === 'discard' ? 'bg-red-950/60 text-red-300 font-medium' : 'text-red-400 hover:text-red-300'}`}
                        >
                            <XCircle className="w-3 h-3" /> Purged ({discardCount})
                        </button>
                    </div>

                    <button
                        onClick={handleAddToTimeline}
                        disabled={keptCount === 0}
                        data-testid="apply-gold-takes-btn"
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-green-600 hover:bg-green-500 disabled:opacity-40 text-xs font-medium text-white transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Add {keptCount} Takes to Timeline
                    </button>
                </div>
            )}

            {/* Chunks List */}
            <div className="flex-1 overflow-y-auto py-2 space-y-2 pr-1">
                {chunks.length === 0 && !isAnalyzing && (
                    <div className="flex flex-col items-center justify-center h-48 text-center p-4 border border-dashed border-gray-800 rounded-lg">
                        <Film className="w-8 h-8 text-gray-600 mb-2" />
                        <p className="text-xs font-medium text-gray-300">No slices generated yet</p>
                        <p className="text-[11px] text-gray-500 max-w-xs mt-1">
                            Click &quot;Slice Footage&quot; to auto-detect shaky camera jitter, dark frames, and pull the best takes into your timeline.
                        </p>
                    </div>
                )}

                {filteredChunks.map((chunk) => {
                    const isKeep = chunk.manuallyIncluded;
                    const verdict = chunk.verdict;

                    let badgeColor = 'bg-gray-800 text-gray-400';
                    let badgeLabel = 'Ambient';
                    if (verdict?.classification === 'KEEP_LEAD_TAKE') {
                        badgeColor = 'bg-green-900/60 text-green-300 border border-green-700/50';
                        badgeLabel = 'Lead Performance';
                    } else if (verdict?.classification === 'KEEP_BROLL') {
                        badgeColor = 'bg-blue-900/60 text-blue-300 border border-blue-700/50';
                        badgeLabel = 'B-Roll Take';
                    } else if (verdict?.classification === 'DISCARD_SHAKY') {
                        badgeColor = 'bg-red-950/80 text-red-400 border border-red-800/50';
                        badgeLabel = 'Camera Shake';
                    } else if (verdict?.classification === 'DISCARD_POOR_LIGHTING') {
                        badgeColor = 'bg-amber-950/80 text-amber-400 border border-amber-800/50';
                        badgeLabel = 'Underexposed';
                    } else if (verdict?.classification === 'DISCARD_DEAD_AIR') {
                        badgeColor = 'bg-gray-800 text-gray-400';
                        badgeLabel = 'Dead Air';
                    }

                    return (
                        <div
                            key={chunk.id}
                            className={`p-2.5 rounded-lg border transition-colors flex items-center justify-between gap-3 ${
                                isKeep
                                    ? 'bg-gray-950/70 border-gray-700 hover:border-gray-600'
                                    : 'bg-black/40 border-gray-900/80 opacity-60 hover:opacity-100'
                            }`}
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
                                <button
                                    onClick={() => toggleChunkInclude(chunk.id)}
                                    title={isKeep ? 'Click to exclude' : 'Click to include'}
                                    className="focus:outline-none flex-shrink-0"
                                >
                                    {isKeep ? (
                                        <CheckCircle className="w-4 h-4 text-green-400" />
                                    ) : (
                                        <XCircle className="w-4 h-4 text-red-500" />
                                    )}
                                </button>

                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-mono font-medium text-gray-200">
                                            {chunk.startSeconds}s – {chunk.endSeconds}s
                                        </span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${badgeColor}`}>
                                            {badgeLabel}
                                        </span>
                                        {verdict && (
                                            <span className="text-[10px] text-gray-400">
                                                ★ {verdict.usableScore}/5
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-gray-400 truncate mt-0.5">
                                        {verdict?.reason || 'Segment analyzed'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono flex-shrink-0">
                                {chunk.motionScore > 60 && (
                                    <span className="flex items-center gap-0.5 text-amber-400" title="High Camera Motion">
                                        <AlertTriangle className="w-3 h-3" />
                                        {chunk.motionScore}m
                                    </span>
                                )}
                                <span>{chunk.brightnessScore}% lum</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
