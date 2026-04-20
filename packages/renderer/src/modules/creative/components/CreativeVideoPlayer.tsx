import React, { useState, useEffect, useRef } from 'react';
import { db } from '@/services/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { Play, Pause, Volume2, VolumeX, Maximize, Download, AlertTriangle, Loader2, ShieldAlert } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';

interface CreativeVideoPlayerProps {
    jobId?: string;
    url?: string;
    autoPlay?: boolean;
    className?: string;
}

export const CreativeVideoPlayer: React.FC<CreativeVideoPlayerProps> = ({
    jobId,
    url: initialUrl,
    autoPlay = false,
    className = ''
}) => {
    const toast = useToast();
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [status, setStatus] = useState<'processing' | 'completed' | 'failed'>(initialUrl ? 'completed' : 'processing');
    const [videoUrl, setVideoUrl] = useState<string | undefined>(initialUrl);
    const [error, setError] = useState<string | null>(null);

    const [isPlaying, setIsPlaying] = useState(autoPlay);
    const [isMuted, setIsMuted] = useState(true);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isHovering, setIsHovering] = useState(false);

    useEffect(() => {
        if (!jobId) return;

        const jobRef = doc(db, 'videoJobs', jobId);
        const unsubscribe = onSnapshot(jobRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setStatus(data.status);
                
                if (data.status === 'completed' && data.videoUrl) {
                    setVideoUrl(data.videoUrl);
                } else if (data.status === 'failed') {
                    // Map safety ratings or generic error
                    let errorMsg = 'Failed to generate video.';
                    if (data.safety_ratings && data.safety_ratings.length > 0) {
                        errorMsg = 'Video blocked due to safety guidelines.';
                    } else if (data.error) {
                        errorMsg = data.error;
                    }
                    setError(errorMsg);
                }
            }
        });

        return () => unsubscribe();
    }, [jobId]);

    const togglePlay = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play().catch(err => console.warn('Play interrupted', err));
            }
            setIsPlaying(!isPlaying);
        }
    };

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (videoRef.current) {
            videoRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };

    const toggleFullscreen = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (containerRef.current) {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                containerRef.current.requestFullscreen();
            }
        }
    };

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100);
        }
    };

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            setDuration(videoRef.current.duration);
        }
    };

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        if (videoRef.current && duration > 0) {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percentage = x / rect.width;
            videoRef.current.currentTime = percentage * duration;
        }
    };

    const handleDownload = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!videoUrl) return;
        
        try {
            const response = await fetch(videoUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `video-${jobId || 'export'}.mp4`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Download started');
        } catch (_err) {
            toast.error('Failed to download video');
        }
    };

    // Render States
    if (status === 'processing') {
        return (
            <div className={`relative flex flex-col items-center justify-center bg-[#0a0a0a] rounded-xl overflow-hidden border border-white/10 ${className}`}>
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10 animate-pulse" />
                <Loader2 size={48} className="text-white/50 animate-spin mb-4" />
                <p className="text-sm font-medium text-white/70">Generating Video...</p>
                <p className="text-xs text-white/40 mt-2 max-w-[80%] text-center">
                    This can take 2-4 minutes. You can safely leave this page—your result will be saved to history.
                </p>
            </div>
        );
    }

    if (status === 'failed' || !videoUrl) {
        return (
            <div className={`flex flex-col items-center justify-center bg-[#1a0f0f] rounded-xl overflow-hidden border border-red-500/20 p-6 ${className}`}>
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                    {error?.includes('safety') ? (
                        <ShieldAlert size={32} className="text-red-400" />
                    ) : (
                        <AlertTriangle size={32} className="text-red-400" />
                    )}
                </div>
                <p className="text-sm font-bold text-red-200 mb-2 text-center">Generation Failed</p>
                <p className="text-xs text-red-400/80 text-center max-w-[90%]">{error || 'An unexpected error occurred.'}</p>
            </div>
        );
    }

    return (
        <div 
            ref={containerRef}
            className={`group relative bg-black rounded-xl overflow-hidden border border-white/10 flex items-center justify-center ${className}`}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            onClick={togglePlay}
        >
            <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full object-contain"
                autoPlay={autoPlay}
                muted={isMuted}
                loop
                playsInline
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
            />

            {/* Central Play/Pause Indicator (Fades out) */}
            <div className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-300 ${!isPlaying ? 'opacity-100' : 'opacity-0'}`}>
                <div className="w-20 h-20 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10">
                    <Play size={32} className="text-white translate-x-1" />
                </div>
            </div>

            {/* Bottom Controls Bar */}
            <div 
                className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 transition-opacity duration-300 ${isHovering || !isPlaying ? 'opacity-100' : 'opacity-0'}`}
                onClick={e => e.stopPropagation()}
            >
                {/* Progress Bar */}
                <div 
                    className="h-1.5 w-full bg-white/20 rounded-full mb-4 cursor-pointer relative overflow-hidden group/progress"
                    onClick={handleSeek}
                >
                    <div 
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-100 ease-linear"
                        style={{ width: `${progress}%` }}
                    />
                    <div 
                        className="absolute top-0 left-0 h-full bg-white opacity-0 group-hover/progress:opacity-30 transition-opacity"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={togglePlay} className="text-white hover:text-purple-400 transition-colors">
                            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                        </button>
                        <button onClick={toggleMute} className="text-white hover:text-purple-400 transition-colors">
                            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                        </button>
                    </div>

                    <div className="flex items-center gap-4">
                        <button onClick={handleDownload} className="text-white hover:text-purple-400 transition-colors" title="Download">
                            <Download size={20} />
                        </button>
                        <button onClick={toggleFullscreen} className="text-white hover:text-purple-400 transition-colors" title="Fullscreen">
                            <Maximize size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
