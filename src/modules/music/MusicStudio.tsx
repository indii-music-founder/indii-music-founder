import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { Play, Square, Activity, Music, Volume2, VolumeX } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';

export default function MusicStudio() {
    const [isStarted, setIsStarted] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(-10); // dB
    const [isMuted, setIsMuted] = useState(false);
    const synthRef = useRef<Tone.Synth | null>(null);
    const toast = useToast();

    useEffect(() => {
        return () => {
            // Cleanup
            if (synthRef.current) {
                synthRef.current.dispose();
            }
        };
    }, []);

    const startAudioEngine = async () => {
        try {
            await Tone.start();
            setIsStarted(true);

            // Initialize Synth
            synthRef.current = new Tone.Synth().toDestination();
            synthRef.current.volume.value = volume;

            toast.success("Audio Engine Started");
        } catch (error) {
            console.error("Failed to start audio engine:", error);
            toast.error("Failed to start audio engine");
        }
    };

    const playNote = () => {
        if (!synthRef.current) return;

        if (isPlaying) {
            synthRef.current.triggerRelease();
            setIsPlaying(false);
        } else {
            synthRef.current.triggerAttack("C4");
            setIsPlaying(true);
        }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        if (synthRef.current) {
            synthRef.current.volume.value = isMuted ? -Infinity : newVolume;
        }
    };

    const toggleMute = () => {
        setIsMuted(!isMuted);
        if (synthRef.current) {
            synthRef.current.volume.value = !isMuted ? -Infinity : volume;
        }
    };

    return (
        <div className="h-full flex flex-col bg-[#0d1117] text-white p-6 overflow-y-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                    <Music className="text-purple-500" />
                    Music Studio
                </h1>
                <p className="text-gray-400">Create and synthesize audio with Tone.js</p>
            </div>

            {!isStarted ? (
                <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-800 rounded-xl bg-[#161b22]">
                    <Activity size={64} className="text-gray-600 mb-6" />
                    <h2 className="text-xl font-semibold mb-4">Audio Engine Not Started</h2>
                    <p className="text-gray-400 mb-8 text-center max-w-md">
                        To comply with browser policies, you must explicitly start the audio context before playing sound.
                    </p>
                    <button
                        onClick={startAudioEngine}
                        className="px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-colors flex items-center gap-2"
                    >
                        <Play size={20} /> Start Audio Engine
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Synthesizer Controls */}
                    <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
                        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                            <Activity size={18} className="text-blue-400" />
                            Basic Synthesizer
                        </h3>

                        <div className="flex flex-col gap-8">
                            <div className="flex items-center justify-center p-12 bg-[#0d1117] rounded-lg border border-gray-800">
                                <button
                                    data-testid="play-button"
                                    onClick={playNote}
                                    className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-200 ${isPlaying
                                        ? 'bg-red-500 hover:bg-red-400 shadow-[0_0_30px_rgba(239,68,68,0.5)]'
                                        : 'bg-green-600 hover:bg-green-500 shadow-lg'
                                        }`}
                                >
                                    {isPlaying ? <Square size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" />}
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium text-gray-300">Master Volume</label>
                                    <span className="text-xs text-gray-500">{volume.toFixed(0)} dB</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button onClick={toggleMute} className="text-gray-400 hover:text-white">
                                        {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                                    </button>
                                    <input
                                        type="range"
                                        min="-60"
                                        max="0"
                                        step="1"
                                        value={volume}
                                        onChange={handleVolumeChange}
                                        className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Status / Visualizer Placeholder */}
                    <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
                        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                            <Activity size={18} className="text-green-400" />
                            Status
                        </h3>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center p-3 bg-[#0d1117] rounded border border-gray-800">
                                <span className="text-gray-400">Context State</span>
                                <span className="text-green-400 font-mono">Running</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-[#0d1117] rounded border border-gray-800">
                                <span className="text-gray-400">Sample Rate</span>
                                <span className="text-blue-400 font-mono">{Tone.context.sampleRate} Hz</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-[#0d1117] rounded border border-gray-800">
                                <span className="text-gray-400">Look Ahead</span>
                                <span className="text-purple-400 font-mono">{Tone.context.lookAhead.toFixed(2)} s</span>
                            </div>
                        </div>

                        <div className="mt-8 p-4 bg-blue-900/20 border border-blue-800/50 rounded-lg">
                            <p className="text-sm text-blue-200">
                                <strong>Note:</strong> This is a basic implementation. Future updates will include a sequencer, more instruments, and AI-driven generation.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
