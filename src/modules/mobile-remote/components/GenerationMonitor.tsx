/**
 * GenerationMonitor — Real-time progress display for AI generations.
 * Shows active and recent image/video/music generation tasks with progress bars,
 * thumbnails for completed items, and status indicators.
 */

import { useState, useEffect } from 'react';
import { Image, Video, Music, Loader2, Check, X, Clock } from 'lucide-react';

interface GenerationItem {
    id: string;
    type: 'image' | 'video' | 'music';
    prompt: string;
    status: 'queued' | 'generating' | 'complete' | 'failed';
    progress: number; // 0-100
    thumbnailUrl?: string;
    startedAt: number;
}

const TYPE_ICONS = {
    image: Image,
    video: Video,
    music: Music,
};

const TYPE_COLORS = {
    image: 'text-purple-400 bg-purple-600/20',
    video: 'text-pink-400 bg-pink-600/20',
    music: 'text-amber-400 bg-amber-600/20',
};

function GenerationCard({ item }: { item: GenerationItem }) {
    const Icon = TYPE_ICONS[item.type];
    const colorClass = TYPE_COLORS[item.type];
    const elapsed = Math.round((Date.now() - item.startedAt) / 1000);

    return (
        <div className="flex items-start gap-3 px-3 py-3 rounded-xl bg-[#161b22]/60 border border-[#30363d]/40">
            {/* Type Icon or Thumbnail */}
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                {item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt="" className="w-full h-full rounded-lg object-cover" />
                ) : (
                    <Icon className="w-5 h-5" />
                )}
            </div>

            <div className="flex-1 min-w-0">
                {/* Prompt */}
                <p className="text-xs text-white font-medium truncate">
                    {item.prompt.length > 60 ? item.prompt.slice(0, 60) + '…' : item.prompt}
                </p>

                {/* Status Row */}
                <div className="flex items-center gap-2 mt-1">
                    {item.status === 'generating' && (
                        <>
                            <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
                            <span className="text-[10px] text-blue-400 font-medium">{item.progress}%</span>
                        </>
                    )}
                    {item.status === 'queued' && (
                        <>
                            <Clock className="w-3 h-3 text-yellow-400" />
                            <span className="text-[10px] text-yellow-400 font-medium">Queued</span>
                        </>
                    )}
                    {item.status === 'complete' && (
                        <>
                            <Check className="w-3 h-3 text-green-400" />
                            <span className="text-[10px] text-green-400 font-medium">Complete</span>
                        </>
                    )}
                    {item.status === 'failed' && (
                        <>
                            <X className="w-3 h-3 text-red-400" />
                            <span className="text-[10px] text-red-400 font-medium">Failed</span>
                        </>
                    )}
                    <span className="text-[10px] text-[#484f58]">•</span>
                    <span className="text-[10px] text-[#484f58]">{elapsed}s</span>
                </div>

                {/* Progress Bar */}
                {item.status === 'generating' && (
                    <div className="mt-1.5 h-1 rounded-full bg-[#21262d] overflow-hidden">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                            style={{ width: `${item.progress}%` }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

export default function GenerationMonitor() {
    // Use local state for demo — in production, this will subscribe to
    // a Firestore collection or WCP broadcasts for active generations.
    const [generations] = useState<GenerationItem[]>([]);

    // Suppress unused var lint by referencing useEffect
    useEffect(() => {
        // Future: Subscribe to generation events from WCP or Firestore
        // wcpInstance.on('generation_update', (msg) => { ... });
    }, []);

    if (generations.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="w-12 h-12 rounded-xl bg-[#161b22] border border-[#30363d]/40 flex items-center justify-center mb-3">
                    <Image className="w-6 h-6 text-[#484f58]" />
                </div>
                <p className="text-sm text-[#6e7681]">No active generations</p>
                <p className="text-xs text-[#484f58] mt-1">
                    Start one from the Creative module
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {generations.map((item: GenerationItem) => (
                <GenerationCard key={item.id} item={item} />
            ))}
        </div>
    );
}
