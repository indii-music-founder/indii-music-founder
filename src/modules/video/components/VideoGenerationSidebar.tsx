import React from 'react';
import { useStore, ShotItem } from '@/core/store';
import { Settings2, Hash, Maximize, Monitor, Film, Camera, Move, Activity, Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export const VideoGenerationSidebar: React.FC = () => {
    const { studioControls, setStudioControls, prompt } = useStore();

    const updateControl = <K extends keyof typeof studioControls>(key: K, value: (typeof studioControls)[K]) => {
        setStudioControls({ [key]: value });
    };

    const addShot = () => {
        const newShot: ShotItem = {
            id: uuidv4(),
            title: `Shot ${studioControls.shotList.length + 1}`,
            description: '',
            duration: 4.0,
            cameraMovement: 'Static'
        };
        updateControl('shotList', [...studioControls.shotList, newShot]);
    };

    const removeShot = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        updateControl('shotList', studioControls.shotList.filter(s => s.id !== id));
    };

    return (
        <div className="w-80 bg-black/40 backdrop-blur-xl border-l border-white/5 flex flex-col h-full overflow-y-auto custom-scrollbar shadow-2xl">
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
                <h3 className="text-[11px] font-black text-white/90 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Film size={12} className="text-yellow-500" />
                    Video Studio
                </h3>
                <div className="flex gap-1">
                    <button className="p-1.5 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-all">
                        <Settings2 size={12} />
                    </button>
                </div>
            </div>

            <div className="p-5 space-y-8">
                {/* Description Reference */}
                <div className="space-y-3">
                    <label className="text-[10px] font-black text-white/30 uppercase tracking-widest flex items-center gap-2">
                        <Activity size={10} className="text-yellow-500/50" /> Prompt Context
                    </label>
                    <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-xs text-white/60 leading-relaxed min-h-[60px] italic">
                        {prompt || "No prompt provided..."}
                    </div>
                </div>

                {/* Technical Configuration */}
                <div className="space-y-4">
                    <label className="text-[10px] font-black text-white/30 uppercase tracking-widest">Global Specs</label>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <label className="text-[9px] font-bold text-white/20 uppercase tracking-tighter flex items-center gap-1">
                                <Maximize size={8} /> Aspect
                            </label>
                            <select
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-[11px] text-white/80 focus:outline-none focus:border-yellow-500/50 appearance-none transition-all hover:bg-white/10"
                                value={studioControls.aspectRatio}
                                onChange={(e) => updateControl('aspectRatio', e.target.value)}
                            >
                                <option value="16:9">16:9 Landscape</option>
                                <option value="9:16">9:16 Portrait</option>
                                <option value="1:1">1:1 Square</option>
                                <option value="21:9">21:9 Cinema</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[9px] font-bold text-white/20 uppercase tracking-tighter flex items-center gap-1">
                                <Monitor size={8} /> Resolution
                            </label>
                            <select
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-[11px] text-white/80 focus:outline-none focus:border-yellow-500/50 appearance-none transition-all hover:bg-white/10"
                                value={studioControls.resolution}
                                onChange={(e) => updateControl('resolution', e.target.value)}
                            >
                                <option value="1080p">1K HD</option>
                                <option value="4K">2K QHD</option>
                                <option value="8K">4K UHD</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Negative Space */}
                <div className="space-y-3">
                    <label className="text-[10px] font-black text-white/30 uppercase tracking-widest">Negative Prompt</label>
                    <textarea
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white/80 placeholder-white/10 focus:outline-none focus:border-yellow-500/50 transition-all resize-none h-20 hover:bg-white/10"
                        placeholder="Artifacts, distortion, noise..."
                        value={studioControls.negativePrompt}
                        onChange={(e) => updateControl('negativePrompt', e.target.value)}
                    />
                </div>

                {/* AI Cinematic Controls */}
                <div className="space-y-5 pt-4 border-t border-white/5">
                    <label className="text-[10px] font-black text-white/30 uppercase tracking-widest flex items-center gap-2">
                        <Camera size={10} className="text-yellow-500/50" /> Cinematic Engine
                    </label>

                    <div className="space-y-2">
                        <label className="text-[9px] font-bold text-white/20 uppercase tracking-tighter flex items-center gap-1">
                            <Move size={8} /> Camera Path
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {['Static', 'Zoom In', 'Zoom Out', 'Pan Left', 'Pan Right', 'Tilt Up'].map(move => (
                                <button
                                    key={move}
                                    onClick={() => updateControl('cameraMovement', move)}
                                    className={`px-2 py-2 rounded-lg text-[10px] font-medium transition-all border ${studioControls.cameraMovement === move
                                        ? 'bg-yellow-500 text-black border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)]'
                                        : 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10 hover:text-white'
                                        }`}
                                >
                                    {move}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold">
                                <span className="text-white/30 uppercase tracking-tighter">Motion Strength</span>
                                <span className="text-yellow-500">{studioControls.motionStrength.toFixed(1)}</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                                value={studioControls.motionStrength}
                                onChange={(e) => updateControl('motionStrength', parseFloat(e.target.value))}
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold">
                                <span className="text-white/30 uppercase tracking-tighter">FPS Export</span>
                                <span className="text-yellow-500">{studioControls.fps}</span>
                            </div>
                            <input
                                type="range"
                                min="12"
                                max="60"
                                step="12"
                                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                                value={studioControls.fps}
                                onChange={(e) => updateControl('fps', parseInt(e.target.value))}
                            />
                        </div>
                    </div>
                </div>

                {/* Shot Architecture */}
                <div className="space-y-4 pt-6 border-t border-white/5">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-white/30 uppercase tracking-widest">Composition</label>
                        <button
                            onClick={addShot}
                            className="p-1 px-2 bg-yellow-500 hover:bg-yellow-400 text-black rounded text-[9px] font-black uppercase flex items-center gap-1 transition-all"
                        >
                            <Plus size={8} strokeWidth={4} /> Add
                        </button>
                    </div>

                    <div className="space-y-3">
                        {studioControls.shotList.length === 0 ? (
                            <div className="p-6 border border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center gap-2">
                                <p className="text-[10px] text-white/20 font-medium italic text-center">No shots defined. Sequences will be generated as a single stream.</p>
                            </div>
                        ) : (
                            studioControls.shotList.map((shot, idx) => (
                                <div
                                    key={shot.id}
                                    className="bg-white/5 border border-white/5 rounded-2xl p-3 flex gap-4 items-center group hover:bg-white/10 transition-all cursor-pointer relative"
                                >
                                    <div className="w-10 h-10 bg-black/40 rounded-xl flex items-center justify-center text-yellow-500 shadow-inner">
                                        <Film size={14} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-[11px] font-bold text-white/80">{shot.title}</h4>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[9px] text-white/30 font-mono tracking-tighter">{shot.duration}s</span>
                                            <span className="w-1 h-1 bg-white/10 rounded-full" />
                                            <span className="text-[9px] text-yellow-500/60 font-medium uppercase tracking-tighter">{shot.cameraMovement}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => removeShot(shot.id, e)}
                                        className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-500/20 hover:text-red-400 text-white/20 rounded-full transition-all"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Seed Logic */}
                <div className="space-y-3 pt-4 border-t border-white/5">
                    <label className="text-[10px] font-black text-white/30 uppercase tracking-widest flex items-center gap-2">
                        <Hash size={10} className="text-yellow-500/50" /> Entropy
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 placeholder-white/10 focus:outline-none focus:border-yellow-500/50"
                            placeholder="Random Seed"
                            value={studioControls.seed}
                            onChange={(e) => updateControl('seed', e.target.value)}
                        />
                        <button
                            onClick={() => updateControl('seed', Math.floor(Math.random() * 999999999).toString())}
                            className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/40 hover:text-white transition-all"
                        >
                            <Activity size={12} />
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

