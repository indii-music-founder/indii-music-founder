/**
 * StreamView — The Music Library for Mobile Remote
 * Displays uploaded tracks and provides local streaming via TransportBar.
 */

import { useEffect, useState, useMemo } from 'react';
import type { HistoryItem } from '@/core/types/history';
import { StorageService } from '@/services/StorageService';
import TransportBar from './TransportBar';
import { motion } from 'motion/react';
import { Music, Play, Loader2, Cloud } from 'lucide-react';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '../haptics';
import { logger } from '@/utils/logger';

export default function StreamView() {
    const [tracks, setTracks] = useState<HistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTrackId, setActiveTrackId] = useState<string | null>(null);

    useEffect(() => {
        let active = true;

        const fetchTracks = async () => {
            try {
                // Fetch user's history and filter for audio
                const items = await StorageService.loadHistory(100);
                if (active) {
                    const audioItems = items.filter(item => item.type === 'music');
                    setTracks(audioItems);
                    setIsLoading(false);
                }
            } catch (err) {
                logger.error('[StreamView] Failed to load tracks:', err);
                if (active) setIsLoading(false);
            }
        };

        fetchTracks();
        return () => { active = false; };
    }, []);

    const activeTrack = useMemo(() => {
        return tracks.find(t => t.id === activeTrackId) || null;
    }, [tracks, activeTrackId]);

    const handlePlayTrack = (track: HistoryItem) => {
        triggerHaptic(30);
        setActiveTrackId(track.id);
    };

    const handleNext = () => {
        if (!activeTrackId || tracks.length <= 1) return;
        const currentIndex = tracks.findIndex(t => t.id === activeTrackId);
        if (currentIndex === -1) return;
        const nextIndex = (currentIndex + 1) % tracks.length;
        setActiveTrackId(tracks[nextIndex].id);
    };

    return (
        <div className="flex flex-col space-y-6 pt-4 min-h-[60vh]">
            <div className="flex items-center justify-between px-2">
                <div>
                    <h2 className="text-xl font-bold font-display text-white tracking-tight">Cloud Vault</h2>
                    <p className="text-[11px] font-bold font-mono uppercase tracking-widest text-[#8e8e93] mt-1 flex items-center gap-1.5">
                        <Cloud className="w-3 h-3 text-[#3BEAF0]" /> Secure Stream
                    </p>
                </div>
            </div>

            <div className="flex-1 bg-[#1a1512]/80 backdrop-blur-md border border-white/10 rounded-3xl p-4 min-h-[300px] shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full text-[#8e8e93] space-y-4 py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-[#00ff66]" />
                        <p className="text-xs font-bold font-mono uppercase tracking-widest">Decrypting Vault...</p>
                    </div>
                ) : tracks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-[#8e8e93] space-y-4 py-12">
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                            <Music className="w-8 h-8 text-white/20" />
                        </div>
                        <p className="text-xs font-bold font-mono uppercase tracking-widest">No Tracks Available</p>
                    </div>
                ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                        {tracks.map((track) => {
                            const isPlaying = activeTrackId === track.id;
                            const title = track.prompt || track.subject || track.id;
                            return (
                                <motion.button
                                    key={track.id}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handlePlayTrack(track)}
                                    className={cn(
                                        "w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition-all cursor-pointer",
                                        isPlaying 
                                            ? "bg-[#00ff66]/10 border-[#00ff66]/30 shadow-[0_0_15px_rgba(0,255,102,0.1)]"
                                            : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10"
                                    )}
                                >
                                    <div className={cn(
                                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                                        isPlaying ? "bg-[#00ff66] text-black shadow-md shadow-[#00ff66]/20" : "bg-white/5 text-white/40"
                                    )}>
                                        {isPlaying ? (
                                            <div className="flex gap-0.5 h-3">
                                                <div className="w-1 bg-black animate-pulse" />
                                                <div className="w-1 bg-black animate-pulse delay-75" />
                                                <div className="w-1 bg-black animate-pulse delay-150" />
                                            </div>
                                        ) : (
                                            <Play className="w-4 h-4 ml-0.5" />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h4 className={cn(
                                            "text-sm font-bold truncate font-sans",
                                            isPlaying ? "text-[#00ff66]" : "text-white"
                                        )}>
                                            {title}
                                        </h4>
                                        <p className="text-[10px] text-[#8e8e93] font-bold font-mono uppercase tracking-wider mt-0.5">
                                            {new Date(track.timestamp).toLocaleDateString('en-US')}
                                        </p>
                                    </div>
                                </motion.button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Always mount TransportBar, pass track if active */}
            <TransportBar 
                track={activeTrack} 
                onNext={tracks.length > 1 ? handleNext : undefined} 
            />
        </div>
    );
}
