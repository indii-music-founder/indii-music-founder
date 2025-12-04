import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { Play, Activity, Music } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';

export default function MusicStudio() {
    const [isStarted, setIsStarted] = useState(false);
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

            // Initialize Synth (still needed for Tone context to start properly?)
            // Actually Tone.start() is enough for context. 
            // We can keep the synth init if we plan to use it for analysis feedback later, 
            // but for now let's keep it minimal.

            toast.success("Audio Engine Started");
        } catch (error) {
            console.error("Failed to start audio engine:", error);
            toast.error("Failed to start audio engine");
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
                    {/* Audio Analysis Placeholder */}
                    <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
                        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                            <Activity size={18} className="text-blue-400" />
                            Audio Analysis
                        </h3>
                        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                            <p>Upload an audio file to analyze BPM, Key, and Energy.</p>
                            <p className="text-sm mt-2 text-gray-600">(Use the Agent to analyze files)</p>
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
