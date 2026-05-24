import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Video, Film, Music, Shield, Sliders, Play, 
    Sparkles, RefreshCw, Upload, Languages, Eye,
    Sparkle, Info, Download, CheckCircle, Volume2
} from 'lucide-react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { useToast } from '@/core/context/ToastContext';

interface StoryboardFrame {
    id: string;
    timestamp: number;
    previewUrl: string;
    prompt: string;
}

export default function OmniWorkflow() {
    const toast = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const audioInputRef = useRef<HTMLInputElement>(null);

    // Global Store State Connection
    const { 
        studioControls, 
        setStudioControls, 
        addToHistory, 
        currentProjectId 
    } = useStore(useShallow((state: any) => ({
        studioControls: state.studioControls,
        setStudioControls: state.setStudioControls,
        addToHistory: state.addToHistory,
        currentProjectId: state.currentProjectId
    })));

    // Local Interactive States
    const [isRemixing, setIsRemixing] = useState(false);
    const [remixPrompt, setRemixPrompt] = useState('Remix performance into a cyberpunk neon concert stage, dramatic volumetric fog');
    const [refVideoFile, setRefVideoFile] = useState<File | null>(null);
    const [audioDubFile, setAudioDubFile] = useState<File | null>(null);
    const [activeFrameIndex, setActiveFrameIndex] = useState(0);
    const [outputVideoUrl, setOutputVideoUrl] = useState<string | null>(null);

    // Flow Storyboard frames
    const [storyboard, setStoryboard] = useState<StoryboardFrame[]>([
        { id: '1', timestamp: 0, previewUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=300&q=80', prompt: 'Artist stands center stage, holding base posture under volumetric backlights' },
        { id: '2', timestamp: 3.5, previewUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=300&q=80', prompt: 'Dynamic zoom in, preserving skeletal alignment while swapping background to neon lights' },
        { id: '3', timestamp: 7.2, previewUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=300&q=80', prompt: 'Volumetric color shift syncs directly with the kick drum beat pulse rate' },
    ]);

    const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setRefVideoFile(file);
            const previewUrl = URL.createObjectURL(file);
            setStudioControls({ omniReferenceVideo: previewUrl });
            toast.success(`Loaded reference performance: ${file.name}`);
        }
    };

    const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAudioDubFile(file);
            toast.success(`Loaded multilingual audio track: ${file.name}`);
        }
    };

    const handleStartRemix = () => {
        if (!studioControls.omniReferenceVideo) {
            toast.error("Please upload an artist base performance video first!");
            return;
        }

        setIsRemixing(true);
        setOutputVideoUrl(null);
        toast.info("Synthesizing Omni Remix: Analyzing skeletal structure and aligning audio...");

        setTimeout(() => {
            setIsRemixing(false);
            const demoVideoUrl = 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
            setOutputVideoUrl(demoVideoUrl);

            // Add generated result to showroom history
            const remixId = `omni_remix_${Date.now()}`;
            addToHistory({
                id: remixId,
                type: 'video',
                url: demoVideoUrl,
                prompt: `Omni Remix: ${remixPrompt}. [X-Ray Lock: ${studioControls.characterXRay ? 'ON' : 'OFF'}, Beat Pulse: ${studioControls.beatPulse * 100}%, Pose preservation: ${studioControls.posePreservation * 100}%]`,
                timestamp: Date.now(),
                projectId: currentProjectId || '',
                origin: 'generated'
            });

            toast.success("Omni performance remix completed! Video added to Showroom.");
        }, 4000);
    };

    const handleDownload = () => {
        if (!outputVideoUrl) return;

        // Custom Electron download bridge check
        if (typeof window !== 'undefined' && 'electron' in window) {
            try {
                (window.electron as any).saveAsset({
                    url: outputVideoUrl,
                    type: 'video',
                    name: `omni_remix_${Date.now()}.mp4`
                });
                toast.success("Saved video to local timeline disk!");
                return;
            } catch (err) {
                console.error("Electron saving failed, falling back to browser download", err);
            }
        }

        // Browser fallback
        const a = document.createElement('a');
        a.href = outputVideoUrl;
        a.download = `omni_remix_${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.success("Downloading video file...");
    };

    return (
        <div className="flex-1 flex overflow-hidden h-full bg-[#070709] text-white select-none">
            {/* Left Panel: Stage & Live Preview */}
            <div className="flex-1 flex flex-col p-6 min-w-0 border-r border-white/5 relative">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
                        <div className="p-1 bg-purple-500/10 rounded-lg">
                            <Video size={14} className="text-purple-400" />
                        </div>
                        Gemini Omni Stage
                    </h2>
                    {studioControls.omniReferenceVideo && (
                        <button 
                            onClick={() => { 
                                setRefVideoFile(null); 
                                setStudioControls({ omniReferenceVideo: null }); 
                                setOutputVideoUrl(null);
                                toast.info("Reference video cleared");
                            }}
                            className="text-[10px] text-gray-500 hover:text-red-400 uppercase font-mono tracking-wider font-bold transition-colors"
                        >
                            Reset Source
                        </button>
                    )}
                </div>

                {/* Main Video Arena */}
                <div className="flex-1 flex flex-col items-center justify-center border border-white/10 rounded-2xl bg-white/[0.02] shadow-2xl relative overflow-hidden group">
                    {/* Background glows */}
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/5 rounded-full blur-[100px] pointer-events-none" />
                    <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-[100px] pointer-events-none" />

                    {outputVideoUrl ? (
                        <div className="absolute inset-0 w-full h-full flex flex-col justify-between p-4 z-10 bg-black">
                            <video 
                                src={outputVideoUrl} 
                                className="w-full h-full object-cover rounded-xl"
                                controls 
                                autoPlay 
                                loop
                            />
                            {/* Synth ID Watermark Overlay Indicator */}
                            {studioControls.synthIdEnabled && (
                                <div className="absolute top-6 right-6 flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-md rounded-full shadow-lg pointer-events-none select-none">
                                    <Shield size={10} className="text-emerald-400" />
                                    <span className="text-[9px] font-bold text-emerald-400 font-mono uppercase tracking-widest">SynthID Protected</span>
                                </div>
                            )}
                            <button 
                                onClick={handleDownload}
                                className="absolute bottom-6 right-6 bg-purple-600 hover:bg-purple-500 text-white p-3 rounded-full shadow-2xl hover:scale-105 transition-all flex items-center justify-center border border-purple-400/30 z-20"
                                title="Download Synthesized Master"
                            >
                                <Download size={16} />
                            </button>
                        </div>
                    ) : studioControls.omniReferenceVideo ? (
                        <div className="absolute inset-0 flex flex-col justify-between p-4 z-10">
                            {/* Overlay Badge */}
                            <div className="flex items-center gap-2 self-start px-2.5 py-1.5 bg-black/60 rounded-lg border border-white/10 backdrop-blur-md">
                                <Film size={12} className="text-purple-400 animate-pulse" />
                                <span className="text-[10px] font-bold uppercase font-mono tracking-wider">Base Performance Active</span>
                            </div>
                            
                            {/* Character X-ray skeleton mock overlay */}
                            {studioControls.characterXRay && (
                                <div className="absolute inset-0 border border-emerald-500/25 bg-emerald-500/[0.02] flex items-center justify-center pointer-events-none">
                                    <motion.div 
                                        initial={{ opacity: 0.3 }}
                                        animate={{ opacity: [0.3, 0.7, 0.3] }}
                                        transition={{ duration: 3, repeat: Infinity }}
                                        className="text-[10px] font-mono text-emerald-400 uppercase font-bold px-3 py-1.5 bg-black/85 rounded-lg border border-emerald-500/30 flex items-center gap-1.5 shadow-xl shadow-emerald-950/20"
                                    >
                                        <Eye size={12} className="animate-pulse" /> Character X-Ray Mesh Locked
                                    </motion.div>
                                </div>
                            )}

                            <div className="w-full h-full flex items-center justify-center opacity-80 pointer-events-none select-none">
                                <Video size={64} className="text-white/10 animate-pulse" />
                            </div>

                            <div className="flex items-center justify-between mt-auto">
                                <span className="text-[10px] font-mono text-gray-500 bg-black/40 px-2 py-1 rounded border border-white/5">{refVideoFile?.name || "base_performance.mp4"}</span>
                                <span className="text-[10px] font-mono text-purple-400 font-bold uppercase tracking-widest">Veo 3.1 V2V Pipeline</span>
                            </div>
                        </div>
                    ) : (
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="flex flex-col items-center justify-center p-12 cursor-pointer select-none text-center hover:bg-white/[0.04] transition-all rounded-xl h-full w-full border border-dashed border-white/10 hover:border-purple-500/40"
                        >
                            <div className="p-4 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 mb-4 group-hover:scale-115 transition-all shadow-inner shadow-purple-500/5">
                                <Upload size={28} />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-widest text-white">Upload Artist Base Performance</span>
                            <span className="text-[10px] text-gray-500 mt-1.5 uppercase tracking-wider font-mono">Drag and drop `.mp4`/`.mov` or click to browse</span>
                            <input 
                                type="file" 
                                ref={fileInputRef}
                                accept="video/*" 
                                onChange={handleVideoUpload} 
                                className="hidden" 
                            />
                        </div>
                    )}
                </div>

                {/* Bottom Storyboard Panel */}
                <div className="h-48 mt-6 border-t border-white/5 pt-4 flex flex-col gap-2 shrink-0">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider font-mono">Storyboard Sequences (Flow Builder)</span>
                        <span className="text-[9px] text-purple-400 uppercase font-mono tracking-widest">3 Scenes Synced</span>
                    </div>
                    <div className="flex-1 flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                        {storyboard.map((frame, i) => (
                            <motion.div 
                                key={frame.id} 
                                whileHover={{ y: -2, borderColor: 'rgba(147, 51, 234, 0.4)' }}
                                onClick={() => setActiveFrameIndex(i)}
                                className={`w-52 bg-white/[0.03] rounded-xl border p-2 flex flex-col justify-between shrink-0 relative cursor-pointer transition-all ${
                                    activeFrameIndex === i ? 'border-purple-500 shadow-[0_0_15px_rgba(147,51,234,0.15)] bg-purple-500/[0.02]' : 'border-white/10'
                                }`}
                            >
                                <div className="h-24 bg-black rounded-lg flex items-center justify-center overflow-hidden border border-white/5 relative">
                                    <img src={frame.previewUrl} alt={frame.prompt} className="w-full h-full object-cover opacity-80" />
                                    <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/75 rounded text-[8px] font-mono text-purple-300 border border-white/10">
                                        Frame {i + 1} ({frame.timestamp}s)
                                    </div>
                                </div>
                                <span className="text-[9px] text-gray-400 line-clamp-2 mt-1.5 select-text leading-relaxed font-mono font-medium">{frame.prompt}</span>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Panel: Omni Controller & Dubbing */}
            <div className="w-80 border-l border-white/5 flex flex-col bg-[#08080a] p-4 shrink-0 overflow-y-auto custom-scrollbar">
                <h3 className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-4 flex items-center gap-2">
                    <Sliders size={14} className="text-purple-400" />
                    Omni Controller
                </h3>

                <div className="space-y-6 flex-1 flex flex-col">
                    {/* Conversational Remix Box */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono flex items-center gap-1.5">
                            <Sparkle size={11} className="text-purple-400" />
                            Remix Style Directives
                        </label>
                        <textarea
                            value={remixPrompt}
                            onChange={(e) => setRemixPrompt(e.target.value)}
                            className="w-full bg-black/60 text-white text-xs p-3 rounded-xl border border-white/10 outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/10 h-24 resize-none placeholder:text-gray-600 transition-all font-mono leading-relaxed"
                            placeholder="Describe how to augment the performance (backgrounds, style, effects)..."
                        />
                    </div>

                    {/* Character X-ray */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-emerald-500/20 transition-all group">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                                <Eye size={12} className={studioControls.characterXRay ? 'text-emerald-400' : 'text-gray-400'} />
                                Character X-Ray
                            </span>
                            <span className="text-[9px] text-gray-500 mt-0.5">Pose matching & posture locking</span>
                        </div>
                        <button 
                            onClick={() => setStudioControls({ characterXRay: !studioControls.characterXRay })}
                            className={`w-9 h-5 rounded-full relative transition-all ${
                                studioControls.characterXRay 
                                    ? 'bg-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.3)]' 
                                    : 'bg-gray-800'
                            }`}
                        >
                            <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                                studioControls.characterXRay ? 'translate-x-4' : 'translate-x-0'
                            }`} />
                        </button>
                    </div>

                    {/* Sliders */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase font-mono tracking-wider">
                                <span>Pose Preservation</span>
                                <span className="font-mono text-purple-400">{(studioControls.posePreservation * 100).toFixed(0)}%</span>
                            </div>
                            <input 
                                type="range" min="0" max="1" step="0.05"
                                value={studioControls.posePreservation} 
                                onChange={(e) => setStudioControls({ posePreservation: parseFloat(e.target.value) })}
                                className="w-full accent-purple-500 bg-black/60 h-1.5 rounded-full outline-none"
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase font-mono tracking-wider">
                                <span>Beat Motion Pulse</span>
                                <span className="font-mono text-purple-400">{(studioControls.beatPulse * 100).toFixed(0)}%</span>
                            </div>
                            <input 
                                type="range" min="0" max="1" step="0.05"
                                value={studioControls.beatPulse} 
                                onChange={(e) => setStudioControls({ beatPulse: parseFloat(e.target.value) })}
                                className="w-full accent-purple-500 bg-black/60 h-1.5 rounded-full outline-none"
                            />
                        </div>
                    </div>

                    {/* Dubbing & Lip-Sync */}
                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
                        <span className="text-[10px] font-bold text-white uppercase tracking-widest font-mono flex items-center gap-1.5">
                            <Languages size={12} className="text-purple-400" />
                            Multilingual Dubbing
                        </span>
                        
                        <div className="relative">
                            <select 
                                value={studioControls.selectedLanguage}
                                onChange={(e) => setStudioControls({ selectedLanguage: e.target.value })}
                                className="w-full bg-black/60 text-[10px] p-2.5 rounded-lg border border-white/10 outline-none text-gray-200 appearance-none font-mono focus:border-purple-500/50"
                            >
                                <option value="es">Spanish Dub (AI Lip-Sync)</option>
                                <option value="ja">Japanese Dub (AI Lip-Sync)</option>
                                <option value="fr">French Dub (AI Lip-Sync)</option>
                                <option value="de">German Dub (AI Lip-Sync)</option>
                            </select>
                            <Volume2 size={12} className="absolute right-3 top-3 text-gray-500 pointer-events-none" />
                        </div>
                        
                        <div className="space-y-2">
                            {audioDubFile ? (
                                <div className="flex items-center justify-between p-2 rounded-lg bg-purple-500/5 border border-purple-500/25">
                                    <span className="text-[9px] font-mono text-purple-300 truncate w-40">{audioDubFile.name}</span>
                                    <CheckCircle size={12} className="text-purple-400 shrink-0" />
                                </div>
                            ) : (
                                <button 
                                    onClick={() => audioInputRef.current?.click()}
                                    className="w-full flex items-center justify-center gap-1.5 py-2 bg-purple-500/10 hover:bg-purple-500/15 border border-purple-500/20 rounded-lg text-[10px] font-bold uppercase transition-colors tracking-widest font-mono text-purple-300"
                                >
                                    <Music size={12} /> Upload translation audio
                                </button>
                            )}
                            <input 
                                type="file"
                                ref={audioInputRef}
                                accept="audio/*"
                                onChange={handleAudioUpload}
                                className="hidden"
                            />
                        </div>
                    </div>

                    {/* Synth ID Watermarking */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-emerald-500/20 transition-all group">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                                <Shield size={12} className={studioControls.synthIdEnabled ? 'text-emerald-400' : 'text-gray-400'} />
                                Synth ID Mark
                            </span>
                            <span className="text-[9px] text-gray-500 mt-0.5">Imperceptible digital watermark</span>
                        </div>
                        <button 
                            onClick={() => setStudioControls({ synthIdEnabled: !studioControls.synthIdEnabled })}
                            className={`w-9 h-5 rounded-full relative transition-all ${
                                studioControls.synthIdEnabled 
                                    ? 'bg-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.3)]' 
                                    : 'bg-gray-800'
                            }`}
                        >
                            <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                                studioControls.synthIdEnabled ? 'translate-x-4' : 'translate-x-0'
                            }`} />
                        </button>
                    </div>

                    {/* Remix Synthesis Button */}
                    <button 
                        onClick={handleStartRemix}
                        disabled={!studioControls.omniReferenceVideo || isRemixing}
                        className="w-full mt-6 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-gray-850 disabled:to-gray-850 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-xs font-bold uppercase tracking-widest font-mono flex items-center justify-center gap-2 shadow-xl shadow-purple-500/10 border border-purple-400/20 hover:scale-[1.01] active:scale-[0.99] transition-all shrink-0 text-white"
                    >
                        {isRemixing ? (
                            <>
                                <RefreshCw size={14} className="animate-spin text-purple-200" />
                                Synthesizing Remix...
                            </>
                        ) : (
                            <>
                                <Sparkles size={14} fill="white" className="text-purple-200 animate-pulse" />
                                Synthesize Omni Remix
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
