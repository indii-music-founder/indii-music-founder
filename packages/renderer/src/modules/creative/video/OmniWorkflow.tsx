import React, { useState } from 'react';
import { 
    Video, Film, Music, Shield, Sliders, Play, 
    Sparkles, RefreshCw, Upload, Languages, Eye
} from 'lucide-react';

interface StoryboardFrame {
    id: string;
    timestamp: number;
    previewUrl: string;
    prompt: string;
}

export default function OmniWorkflow() {
    // Reference Video Upload
    const [refVideo, setRefVideo] = useState<File | null>(null);
    const [refPreview, setRefPreview] = useState<string | null>(null);
    const [isRemixing, setIsRemixing] = useState(false);
    
    // Storyboard Sequencer
    const [storyboard] = useState<StoryboardFrame[]>([
        { id: '1', timestamp: 0, previewUrl: 'MOCK_PREVIEW_1', prompt: 'Establishing wide shot of the band' },
        { id: '2', timestamp: 3.5, previewUrl: 'MOCK_PREVIEW_2', prompt: 'Close up on the lead singer under magenta neon' },
        { id: '3', timestamp: 7.2, previewUrl: 'MOCK_PREVIEW_3', prompt: 'Dynamic zoom out during guitar solo' },
    ]);

    // Active Controls
    const [posePreservation, setPosePreservation] = useState(0.8);
    const [beatPulse, setBeatPulse] = useState(0.5);
    const [characterXRay, setCharacterXRay] = useState(true);
    const [synthIdEnabled, setSynthIdEnabled] = useState(true);
    const [selectedLanguage, setSelectedLanguage] = useState('es');

    const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setRefVideo(file);
            setRefPreview(URL.createObjectURL(file));
        }
    };

    const handleStartRemix = () => {
        setIsRemixing(true);
        setTimeout(() => {
            setIsRemixing(false);
        }, 3000);
    };

    return (
        <div className="flex-1 flex overflow-hidden h-full bg-[#0a0a0c] text-white select-none">
            {/* Left Panel: Video Dropzone & Live Preview */}
            <div className="flex-1 flex flex-col p-6 min-w-0 border-r border-white/5 relative">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
                        <Video size={16} />
                        Gemini Omni Stage
                    </h2>
                    {refVideo && (
                        <button 
                            onClick={() => { setRefVideo(null); setRefPreview(null); }}
                            className="text-xs text-gray-500 hover:text-red-400 uppercase font-bold"
                        >
                            Reset Source
                        </button>
                    )}
                </div>

                {/* Dropzone Area */}
                <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-white/15 hover:border-purple-500/30 rounded-2xl bg-white/5 transition-all overflow-hidden relative group">
                    {refPreview ? (
                        <div className="absolute inset-0 flex flex-col justify-between p-4 z-10">
                            {/* Overlay Badge */}
                            <div className="flex items-center gap-2 self-start px-2 py-1 bg-black/60 rounded-lg border border-white/10 backdrop-blur-md">
                                <Film size={12} className="text-purple-400" />
                                <span className="text-[10px] font-bold uppercase font-mono">Base Performance Active</span>
                            </div>
                            
                            {/* Pose X-ray skeleton mock overlay */}
                            {characterXRay && (
                                <div className="absolute inset-0 border border-emerald-500/20 bg-emerald-500/5 animate-pulse flex items-center justify-center">
                                    <div className="text-[10px] font-mono text-emerald-400 uppercase font-bold px-3 py-1 bg-black/80 rounded-md border border-emerald-500/30 flex items-center gap-1.5">
                                        <Eye size={12} /> Character X-Ray Mesh Locked
                                    </div>
                                </div>
                            )}

                            {/* Controls Overlay */}
                            <button className="self-center p-4 bg-purple-600/90 hover:bg-purple-600 rounded-full border border-purple-400/50 shadow-xl shadow-purple-500/20 hover:scale-105 transition-all text-white">
                                <Play size={20} fill="white" />
                            </button>

                            <div className="flex items-center justify-between mt-auto">
                                <span className="text-[10px] font-mono text-gray-400">{refVideo?.name}</span>
                                <span className="text-[10px] font-mono text-purple-400 font-bold uppercase">UHD H.264</span>
                            </div>
                        </div>
                    ) : (
                        <label className="flex flex-col items-center justify-center p-8 cursor-pointer select-none">
                            <div className="p-4 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 mb-4 group-hover:scale-110 transition-transform">
                                <Upload size={24} />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider text-white">Upload Artist Base Performance</span>
                            <span className="text-[10px] text-gray-500 mt-1 uppercase tracking-tight">Drag and drop `.mp4` or click to browse</span>
                            <input type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" />
                        </label>
                    )}
                </div>

                {/* Bottom Sequencer Panel */}
                <div className="h-44 mt-6 border-t border-white/5 pt-4 flex flex-col gap-2 shrink-0">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Storyboard Sequences (Flow Builder)</span>
                    <div className="flex-1 flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                        {storyboard.map((frame, i) => (
                            <div key={frame.id} className="w-48 bg-white/5 rounded-xl border border-white/10 p-2 flex flex-col justify-between shrink-0 relative hover:border-purple-500/25 transition-all">
                                <div className="h-20 bg-black/40 rounded-lg flex items-center justify-center overflow-hidden border border-white/5 relative">
                                    <span className="text-[9px] font-mono text-gray-600">Block {i + 1} ({frame.timestamp}s)</span>
                                </div>
                                <span className="text-[9px] text-gray-400 line-clamp-2 mt-1 select-text leading-relaxed">{frame.prompt}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Panel: Omni Controller & Dubbing */}
            <div className="w-80 border-l border-white/5 flex flex-col bg-[#0d0d10] p-4 shrink-0 overflow-y-auto custom-scrollbar">
                <h3 className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-4 flex items-center gap-2">
                    <Sliders size={14} />
                    Omni Controls
                </h3>

                <div className="space-y-6">
                    {/* Character X-ray */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-white uppercase tracking-wide">Character X-Ray</span>
                            <span className="text-[9px] text-gray-500 mt-0.5">Pose matching & posture locking</span>
                        </div>
                        <button 
                            onClick={() => setCharacterXRay(!characterXRay)}
                            className={`w-8 h-4 rounded-full relative transition-all ${characterXRay ? 'bg-purple-600 shadow-[0_0_8px_rgba(147,51,234,0.4)]' : 'bg-gray-800'}`}
                        >
                            <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${characterXRay ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                    </div>

                    {/* Sliders */}
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase">
                                <span>Pose Preservation</span>
                                <span className="font-mono text-purple-400">{(posePreservation * 100).toFixed(0)}%</span>
                            </div>
                            <input 
                                type="range" min="0" max="1" step="0.05"
                                value={posePreservation} onChange={(e) => setPosePreservation(parseFloat(e.target.value))}
                                className="w-full accent-purple-500 bg-black/40 h-1.5 rounded-full outline-none"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase">
                                <span>Beat Motion Pulse</span>
                                <span className="font-mono text-purple-400">{(beatPulse * 100).toFixed(0)}%</span>
                            </div>
                            <input 
                                type="range" min="0" max="1" step="0.05"
                                value={beatPulse} onChange={(e) => setBeatPulse(parseFloat(e.target.value))}
                                className="w-full accent-purple-500 bg-black/40 h-1.5 rounded-full outline-none"
                            />
                        </div>
                    </div>

                    {/* Dubbing & Lip-Sync */}
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-3">
                        <span className="text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                            <Languages size={12} className="text-purple-400" />
                            Multilingual Lip-Sync
                        </span>
                        
                        <div className="relative">
                            <select 
                                value={selectedLanguage}
                                onChange={(e) => setSelectedLanguage(e.target.value)}
                                className="w-full bg-black/40 text-xs p-2 rounded-lg border border-white/10 outline-none text-white appearance-none"
                            >
                                <option value="es">Spanish Dub (Perfect Lip-Sync)</option>
                                <option value="ja">Japanese Dub (Perfect Lip-Sync)</option>
                                <option value="fr">French Dub (Perfect Lip-Sync)</option>
                            </select>
                        </div>
                        
                        <button className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg text-[10px] font-bold uppercase transition-colors">
                            <Music size={12} /> Upload localized audio dub
                        </button>
                    </div>

                    {/* Synth ID */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-white uppercase tracking-wide flex items-center gap-1">
                                <Shield size={12} className="text-emerald-400" /> Synth ID Watermark
                            </span>
                            <span className="text-[9px] text-gray-500 mt-0.5">Secure, imperceptible digital mark</span>
                        </div>
                        <button 
                            onClick={() => setSynthIdEnabled(!synthIdEnabled)}
                            className={`w-8 h-4 rounded-full relative transition-all ${synthIdEnabled ? 'bg-emerald-600 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-gray-800'}`}
                        >
                            <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${synthIdEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                    </div>
                </div>

                {/* Remix Button */}
                <button 
                    onClick={handleStartRemix}
                    disabled={!refVideo || isRemixing}
                    className="w-full mt-auto py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-purple-500/10 transition-colors shrink-0"
                >
                    {isRemixing ? (
                        <>
                            <RefreshCw size={14} className="animate-spin" />
                            Synthesizing Remix...
                        </>
                    ) : (
                        <>
                            <Sparkles size={14} fill="white" />
                            Synthesize Omni Remix
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
