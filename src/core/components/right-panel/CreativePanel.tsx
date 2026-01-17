import React, { useState } from 'react';
import { Wand2, History, ChevronRight, ChevronDown, Sliders } from 'lucide-react';
import CreativeGallery from '../../../modules/creative/components/CreativeGallery';
import { useStore } from '../../store';
import { useToast } from '@/core/context/ToastContext';
import { z } from 'zod';
import { VideoAspectRatioSchema, VideoResolutionSchema } from '@/modules/video/schemas';
import { WhiskDropZone } from '@/modules/creative/components/whisk/WhiskDropZone';
import WhiskPresetStyles, { STYLE_PRESETS } from '@/modules/creative/components/whisk/WhiskPresetStyles';
import { Sparkles, Lock, Image as ImageIcon, Film, ImagePlay } from 'lucide-react';
import { motion } from 'framer-motion';
import { useCallback } from 'react';

type VideoAspectRatio = z.infer<typeof VideoAspectRatioSchema>;
type VideoResolution = z.infer<typeof VideoResolutionSchema>;

interface CreativePanelProps {
    toggleRightPanel: () => void;
}

export default function CreativePanel({ toggleRightPanel }: CreativePanelProps) {
    const [activeTab, setActiveTab] = useState('create');
    const {
        studioControls, setStudioControls,
        whiskState, addWhiskItem, removeWhiskItem, toggleWhiskItem, updateWhiskItem, setPreciseReference, setTargetMedia
    } = useStore();
    const toast = useToast();



    return (
        <div className="flex flex-col h-full bg-gradient-to-b from-bg-dark to-bg-dark/90">
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5 backdrop-blur-sm">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <div className="p-1.5 bg-purple-500/10 rounded-lg">
                        <Sliders size={14} className="text-purple-400" />
                    </div>
                    Studio Controls
                </h3>
                <div className="flex items-center gap-2">
                    <div className="flex gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
                        <button
                            onClick={() => setActiveTab('create')}
                            className={`p-1.5 rounded-md transition-all ${activeTab === 'create' ? 'bg-purple-500/20 text-purple-400 shadow-sm' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                            title="Create"
                        >
                            <Wand2 size={14} />
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`p-1.5 rounded-md transition-all ${activeTab === 'history' ? 'bg-purple-500/20 text-purple-400 shadow-sm' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                            title="History"
                        >
                            <History size={14} />
                        </button>
                    </div>
                    <button onClick={toggleRightPanel} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            {activeTab === 'history' ? (
                <div className="flex-1 overflow-hidden">
                    <CreativeGallery compact={true} />
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                    {/* REFERENCE MIXER SECTION */}
                    <div className="space-y-4">
                        {/* Reference Mixer Header */}
                        <div className="flex flex-col gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-purple-500/20 rounded-lg">
                                        <Sparkles className="text-purple-400" size={14} />
                                    </div>
                                    <div>
                                        <span className="text-xs font-bold text-white tracking-wide">Reference Mixer</span>
                                        {(whiskState.subjects.filter(i => i.checked).length +
                                            whiskState.scenes.filter(i => i.checked).length +
                                            whiskState.styles.filter(i => i.checked).length +
                                            whiskState.motion.filter(i => i.checked).length) > 0 && (
                                                <p className="text-[9px] text-purple-400">
                                                    {whiskState.subjects.filter(i => i.checked).length +
                                                        whiskState.scenes.filter(i => i.checked).length +
                                                        whiskState.styles.filter(i => i.checked).length +
                                                        whiskState.motion.filter(i => i.checked).length} locked
                                                </p>
                                            )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] text-gray-500 uppercase font-bold">Precise</span>
                                    <button
                                        onClick={() => setPreciseReference(!whiskState.preciseReference)}
                                        className={`w-8 h-4 rounded-full relative transition-all ${whiskState.preciseReference
                                            ? 'bg-purple-600 shadow-[0_0_10px_rgba(147,51,234,0.5)]'
                                            : 'bg-gray-800'
                                            }`}
                                        title={whiskState.preciseReference ? 'Precise: ON' : 'Precise: OFF'}
                                    >
                                        <motion.div
                                            animate={{ x: whiskState.preciseReference ? 16 : 2 }}
                                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                            className={`absolute top-0.5 left-0 w-3 h-3 rounded-full ${whiskState.preciseReference ? 'bg-white' : 'bg-gray-500'}`}
                                        />
                                    </button>
                                </div>
                            </div>

                            {/* Media Type Toggle */}
                            <div className="flex items-center gap-1 p-1 bg-black/40 rounded-lg">
                                <button
                                    onClick={() => setTargetMedia('image')}
                                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-[10px] font-medium uppercase transition-all ${whiskState.targetMedia === 'image'
                                        ? 'bg-purple-500/30 text-purple-300 shadow-[0_0_8px_rgba(147,51,234,0.3)]'
                                        : 'text-gray-500 hover:text-gray-300'
                                        }`}
                                >
                                    <ImageIcon size={12} />
                                    Image
                                </button>
                                <button
                                    onClick={() => setTargetMedia('video')}
                                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-[10px] font-medium uppercase transition-all ${whiskState.targetMedia === 'video'
                                        ? 'bg-blue-500/30 text-blue-300 shadow-[0_0_8px_rgba(59,130,246,0.3)]'
                                        : 'text-gray-500 hover:text-gray-300'
                                        }`}
                                >
                                    <Film size={12} />
                                    Video
                                </button>
                                <button
                                    onClick={() => setTargetMedia('both')}
                                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-[10px] font-medium uppercase transition-all ${whiskState.targetMedia === 'both'
                                        ? 'bg-gradient-to-r from-purple-500/30 to-blue-500/30 text-white shadow-[0_0_8px_rgba(147,51,234,0.2)]'
                                        : 'text-gray-500 hover:text-gray-300'
                                        }`}
                                >
                                    <ImagePlay size={12} />
                                    Both
                                </button>
                            </div>
                        </div>

                        {/* Drop Zones */}
                        <div className="space-y-2">
                            <WhiskDropZone
                                title="Subject"
                                category="subject"
                                items={whiskState.subjects}
                                onAdd={(type, content, cap) => addWhiskItem('subject', type, content, cap)}
                                onRemove={(id) => removeWhiskItem('subject', id)}
                                onToggle={(id) => toggleWhiskItem('subject', id)}
                                onUpdate={(id, updates) => updateWhiskItem('subject', id, updates)}
                                description="Main subject"
                            />

                            <WhiskDropZone
                                title="Scene"
                                category="scene"
                                items={whiskState.scenes}
                                onAdd={(type, content, cap) => addWhiskItem('scene', type, content, cap)}
                                onRemove={(id) => removeWhiskItem('scene', id)}
                                onToggle={(id) => toggleWhiskItem('scene', id)}
                                onUpdate={(id, updates) => updateWhiskItem('scene', id, updates)}
                                description="Background/Setting"
                            />

                            <WhiskDropZone
                                title="Style"
                                category="style"
                                items={whiskState.styles}
                                onAdd={(type, content, cap) => addWhiskItem('style', type, content, cap)}
                                onRemove={(id) => removeWhiskItem('style', id)}
                                onToggle={(id) => toggleWhiskItem('style', id)}
                                onUpdate={(id, updates) => updateWhiskItem('style', id, updates)}
                                description="Aesthetic/Vibe"
                            />

                            {(whiskState.targetMedia === 'video' || whiskState.targetMedia === 'both') && (
                                <WhiskDropZone
                                    title="Motion"
                                    category="motion"
                                    items={whiskState.motion}
                                    onAdd={(type, content, cap) => addWhiskItem('motion', type, content, cap)}
                                    onRemove={(id) => removeWhiskItem('motion', id)}
                                    onToggle={(id) => toggleWhiskItem('motion', id)}
                                    onUpdate={(id, updates) => updateWhiskItem('motion', id, updates)}
                                    description="Camera movement"
                                    accentColor="blue"
                                />
                            )}
                        </div>

                        {/* Presets */}
                        <div className="pt-2 border-t border-white/10">
                            <WhiskPresetStyles onSelectPreset={(preset) => {
                                const exists = whiskState.styles.some(s => s.content === preset.prompt);
                                if (exists) {
                                    const item = whiskState.styles.find(s => s.content === preset.prompt);
                                    if (item) toggleWhiskItem('style', item.id);
                                } else {
                                    addWhiskItem('style', 'text', preset.prompt, preset.label);
                                }
                                toast.success(`Style: ${preset.label}`);
                            }} />
                        </div>
                    </div>

                    <div className="h-px bg-white/10" />

                    {/* Prompt Section */}


                    {/* Negative Prompt */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-bold text-gray-500 tracking-wider">CONSTRAINTS</label>
                        <textarea
                            value={studioControls.negativePrompt}
                            onChange={(e) => setStudioControls({ negativePrompt: e.target.value })}
                            className="w-full bg-black/40 text-white text-sm p-3 rounded-xl border border-white/10 outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all h-20 resize-none placeholder:text-gray-600 shadow-inner"
                            placeholder="Negative prompt: elements to exclude..."
                        />
                    </div>

                    {/* Settings Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-500 tracking-wider">ASPECT RATIO</label>
                            <div className="relative group">
                                <select
                                    value={studioControls.aspectRatio}
                                    onChange={(e) => setStudioControls({ aspectRatio: e.target.value as VideoAspectRatio })}
                                    className="w-full bg-black/40 text-white text-xs p-2.5 rounded-xl border border-white/10 outline-none appearance-none cursor-pointer hover:border-white/20 hover:bg-black/60 transition-all"
                                >
                                    <option value="16:9">16:9 Landscape</option>
                                    <option value="1:1">1:1 Square</option>
                                    <option value="9:16">9:16 Portrait</option>
                                    <option value="4:3">4:3 Standard</option>
                                    <option value="3:4">3:4 Vertical</option>
                                </select>
                                <ChevronDown size={12} className="absolute right-3 top-3 text-gray-500 pointer-events-none group-hover:text-gray-300 transition-colors" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-500 tracking-wider">RESOLUTION</label>
                            <div className="relative group">
                                <select
                                    value={studioControls.resolution || '1024x1024'}
                                    onChange={(e) => setStudioControls({ resolution: e.target.value as VideoResolution })}
                                    className="w-full bg-black/40 text-white text-xs p-2.5 rounded-xl border border-white/10 outline-none appearance-none cursor-pointer hover:border-white/20 hover:bg-black/60 transition-all"
                                >
                                    <option value="1024x1024">1K (Square)</option>
                                    <option value="1280x720">HD (720p)</option>
                                    <option value="1920x1080">FHD (1080p)</option>
                                    <option value="1080x1920">Vertical (1080x1920)</option>
                                    <option value="720x1280">Vertical (720x1280)</option>
                                </select>
                                <ChevronDown size={12} className="absolute right-3 top-3 text-gray-500 pointer-events-none group-hover:text-gray-300 transition-colors" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-500 tracking-wider">STYLE PRESET</label>
                            <div className="relative group">
                                <select className="w-full bg-black/40 text-white text-xs p-2.5 rounded-xl border border-white/10 outline-none appearance-none cursor-pointer hover:border-white/20 hover:bg-black/60 transition-all">
                                    <option>Cinematic</option>
                                    <option>Photorealistic</option>
                                    <option>Anime / Manga</option>
                                    <option>3D Render</option>
                                    <option>Oil Painting</option>
                                </select>
                                <ChevronDown size={12} className="absolute right-3 top-3 text-gray-500 pointer-events-none group-hover:text-gray-300 transition-colors" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-500 tracking-wider">SEED</label>
                            <input
                                type="text"
                                pattern="[0-9]*"
                                value={studioControls.seed || ''}
                                onChange={(e) => setStudioControls({ seed: e.target.value })}
                                placeholder="Random"
                                className="w-full bg-black/40 text-white text-xs p-2.5 rounded-xl border border-white/10 outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all placeholder:text-gray-600"
                            />
                        </div>
                    </div>

                    {/* Advanced Settings Toggle */}

                </div>
            )}
        </div>
    );
}
