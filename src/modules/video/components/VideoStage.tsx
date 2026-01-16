import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Video } from 'lucide-react';
import { HistoryItem } from '@/core/store';
import { CreativeSlice } from '@/core/store/slices/creativeSlice';

interface VideoStageProps {
    jobStatus: 'idle' | 'queued' | 'processing' | 'stitching' | 'completed' | 'failed';
    jobProgress: number;
    activeVideo: HistoryItem | null;
    setVideoInputs: (inputs: Partial<CreativeSlice['videoInputs']>) => void;
}

// ⚡ Bolt Optimization: Memoize this heavy component to prevent re-renders when parent state (like prompt input) changes
export const VideoStage = React.memo<VideoStageProps>(({
    jobStatus,
    jobProgress,
    activeVideo,
    setVideoInputs
}) => {
    return (
        <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-b from-gray-900 to-black relative overflow-hidden">
            {/* Background Grid Ambience */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

            <div className="relative w-full max-w-5xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-white/5 ring-1 ring-white/10 group">
                {jobStatus === 'processing' || jobStatus === 'queued' || jobStatus === 'stitching' ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-20">
                        <div className="w-24 h-24 relative mb-4">
                            <div className="absolute inset-0 rounded-full border-t-2 border-purple-500 animate-spin"></div>
                            <div className="absolute inset-2 rounded-full border-r-2 border-indigo-500 animate-spin flex items-center justify-center">
                                <Sparkles size={24} className="text-purple-400 animate-pulse" />
                            </div>
                        </div>
                        <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600 animate-pulse capitalize">
                            {jobStatus === 'stitching' ? 'Stitching Masterpiece...' : 'Imaginating Scene...'}
                        </h3>
                        <p className="text-gray-500 text-sm mt-2">
                            {jobStatus === 'stitching' ? 'Finalizing your unified video' : `AI Director is rendering your vision (${jobProgress}%)`}
                        </p>
                        {/* Progress Bar */}
                        <div className="w-64 h-1.5 bg-white/5 rounded-full mt-6 overflow-hidden">
                            <motion.div
                                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${jobProgress}%` }}
                                transition={{ duration: 0.5 }}
                            />
                        </div>
                    </div>
                ) : activeVideo ? (
                    <div className="relative w-full h-full flex items-center justify-center">
                        {activeVideo.url.startsWith('data:image') || activeVideo.type === 'image' ? (
                            <img src={activeVideo.url} alt="Preview" className="w-full h-full object-contain" />
                        ) : (
                            <video
                                src={activeVideo.url}
                                controls
                                className="max-h-full max-w-full rounded-lg shadow-2xl border border-white/10"
                                poster={activeVideo.url} // Note: poster expects an image URL. If activeVideo.url is video, this might fail or be ignored.
                                preload="metadata" // ⚡ Bolt Optimization: efficient loading
                            />
                        )}
                        {/* Info Overlay */}
                        <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md p-2 rounded-lg border border-white/10 max-w-md">
                            <p className="text-sm font-medium text-white truncate">{activeVideo.prompt}</p>
                            <div className="flex gap-2 text-[10px] text-gray-400 mt-1">
                                <span>{new Date(activeVideo.timestamp).toLocaleTimeString()}</span>
                                <span>•</span>
                                <span>{activeVideo.id.slice(0, 8)}</span>
                            </div>
                            <div className="flex gap-2 mt-2 pt-2 border-t border-white/10">
                                <button
                                    onClick={() => setVideoInputs({ firstFrame: activeVideo })}
                                    data-testid="set-anchor-btn"
                                    className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-[10px] text-white transition-colors"
                                >
                                    Set Anchor
                                </button>
                                <button
                                    onClick={() => setVideoInputs({ lastFrame: activeVideo })}
                                    data-testid="set-end-frame-btn"
                                    className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-[10px] text-white transition-colors"
                                >
                                    Set End Frame
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400/30">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            className="relative mb-6"
                        >
                            <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full" />
                            <Video size={80} className="relative z-10 text-white/10" strokeWidth={1} />
                        </motion.div>
                        <h3 className="text-xl font-light text-white/40 tracking-[0.2em] uppercase mb-2">Director's Chair</h3>
                        <p className="text-sm font-medium text-white/20 max-w-xs text-center leading-relaxed">
                            Compose your vision above to begin.<br />
                            <span className="text-xs opacity-50">Keyboard Shortcut: <code className="bg-white/10 px-1 rounded text-white/40">⌘E</code> to toggle Editor</span>
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
});

VideoStage.displayName = 'VideoStage';
