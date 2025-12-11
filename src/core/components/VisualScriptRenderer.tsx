
import React from 'react';
import { Play, Camera, Music, Clapperboard } from 'lucide-react';
import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';

interface VisualScriptBeat {
    beat: number;
    name: string;
    camera: string;
    action: string;
    sound: string;
}

interface VisualScriptData {
    title: string;
    synopsis: string;
    beats: VisualScriptBeat[];
}

interface VisualScriptRendererProps {
    data: VisualScriptData | string;
}

export default function VisualScriptRenderer({ data }: VisualScriptRendererProps) {
    const { setPrompt, setGenerationMode } = useStore();
    const toast = useToast();

    const script: VisualScriptData | null = typeof data === 'string' ? (() => {
        try {
            return JSON.parse(data);
        } catch (e) {
            return null;
        }
    })() : data;

    if (!script || !script.beats) return null;

    const handleGenerate = (beat: VisualScriptBeat) => {
        // Construct a rich prompt for the filmmaking engine
        const cinematicPrompt = `Cinematic Shot: ${beat.action}. Camera: ${beat.camera}. Audio Atmosphere: ${beat.sound}. Style: Photorealistic, 8k, highly detailed.`;
        setPrompt(cinematicPrompt);
        setGenerationMode('image'); // Switch to image mode for the grid
        toast.success(`Loaded Beat ${beat.beat}: ${beat.name}`);

        // In a real scenario, this might auto-trigger generation or open a specific mode
    };

    return (
        <div className="bg-[#1a1a1a] rounded-xl border border-gray-800 overflow-hidden my-4 shadow-2xl">
            <div className="bg-gradient-to-r from-purple-900/50 to-gray-900/50 p-4 border-b border-gray-700 flex items-center gap-3">
                <div className="p-2 bg-purple-600 rounded-lg">
                    <Clapperboard size={20} className="text-white" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">{script.title || "Visual Script"}</h3>
                    <p className="text-xs text-gray-400 line-clamp-1">{script.synopsis}</p>
                </div>
            </div>

            <div className="divide-y divide-gray-800">
                {script.beats.map((beat) => (
                    <div key={beat.beat} className="p-4 hover:bg-white/5 transition-colors group">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-purple-400 bg-purple-900/20 px-1.5 py-0.5 rounded">Beat {beat.beat}</span>
                                    <span className="text-sm font-semibold text-gray-200">{beat.name}</span>
                                </div>
                                <p className="text-sm text-gray-300 leading-relaxed">{beat.action}</p>
                                <div className="flex flex-wrap gap-2 pt-1">
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-black/30 px-2 py-1 rounded">
                                        <Camera size={12} /> {beat.camera}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-black/30 px-2 py-1 rounded">
                                        <Music size={12} /> {beat.sound}
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => handleGenerate(beat)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 shadow-lg"
                                title="Generate Cinematic Grid for this Beat"
                            >
                                <Play size={16} fill="currentColor" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
