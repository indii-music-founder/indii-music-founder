'use client';

import { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

export default function AudioManager() {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [hasInteracted, setHasInteracted] = useState(false);

    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        // Create audio element
        const audio = new Audio('/audio/tech-house-loop.mp3');
        audio.loop = true;
        audio.volume = 0.7;
        audioRef.current = audio;

        // Event listeners
        audio.addEventListener('canplaythrough', () => {
            setIsReady(true);
        });

        audio.addEventListener('error', (e) => {
            console.error("Audio error:", e);
        });

        // Try to auto-play (will likely fail, but worth a shot)
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => {
                // Autoplay prevented, waiting for user interaction
            });
        }

        return () => {
            audio.pause();
            audioRef.current = null;
        };
    }, []);

    const togglePlay = () => {
        if (!audioRef.current) return;

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch(e => console.error("Audio play failed on click:", e));
            }
        }
        setIsPlaying(!isPlaying);
        setHasInteracted(true);
    };

    return (
        <div className="fixed bottom-8 left-8 z-50 flex items-center gap-4">
            <button
                onClick={togglePlay}
                disabled={!isReady}
                className={`p-3 rounded-full backdrop-blur-md border transition-all group ${isPlaying
                    ? 'bg-neon-blue/20 border-neon-blue text-neon-blue shadow-[0_0_15px_rgba(0,243,255,0.3)]'
                    : 'bg-black/50 border-white/10 text-white hover:bg-white/10'
                    } ${!isReady ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                {isPlaying ? (
                    <Volume2 className="w-6 h-6" />
                ) : (
                    <VolumeX className="w-6 h-6 text-white/50 group-hover:text-white transition-colors" />
                )}
            </button>

            {!hasInteracted && !isPlaying && isReady && (
                <div className="bg-black/60 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full animate-pulse cursor-pointer" onClick={togglePlay}>
                    <span className="text-xs text-white font-bold uppercase tracking-widest flex items-center gap-2">
                        <span className="w-2 h-2 bg-neon-blue rounded-full animate-ping"></span>
                        Click for Sound
                    </span>
                </div>
            )}
            {!isReady && (
                <div className="bg-black/60 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full">
                    <span className="text-xs text-white/50 font-bold uppercase tracking-widest">
                        Loading Audio...
                    </span>
                </div>
            )}
        </div>
    );
}
