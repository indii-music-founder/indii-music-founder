import { useState } from 'react';
import { Wand2, History, ChevronRight, ChevronDown, Sliders, Zap, Brain, Layers, Video } from 'lucide-react';
import CreativeGallery from '../../../modules/creative/components/CreativeGallery';
import { useStore } from '../../store';
import { useShallow } from 'zustand/react/shallow';
import { StoreState } from '../../store';
import { useToast } from '@/core/context/ToastContext';
import { z } from 'zod';
import { AspectRatioSchema, VideoResolutionSchema } from '@/modules/video/schemas';
import { WhiskDropZone } from '@/modules/creative/components/whisk/WhiskDropZone';
import WhiskPresetStyles from '@/modules/creative/components/whisk/WhiskPresetStyles';
import { Sparkles, Image as ImageIcon, Film, ImagePlay } from 'lucide-react';
import { motion } from 'motion/react';

type AspectRatio = z.infer<typeof AspectRatioSchema>;
type VideoResolution = z.infer<typeof VideoResolutionSchema>;

interface CreativePanelProps {
    toggleRightPanel: () => void;
}

const SectionCard = ({ title, icon, children, isOpen, onToggle }: { title: React.ReactNode, icon: React.ReactNode, children: React.ReactNode, isOpen: boolean, onToggle: () => void }) => {
    return (
        <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden mb-3">
            <button 
                onClick={onToggle}
                className="w-full p-3 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-2 text-[11px] font-bold text-white tracking-wide uppercase">
                    {icon}
                    {title}
                </div>
                <ChevronDown size={14} className={`text-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            <motion.div
                initial={false}
                animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden"
            >
                <div className="p-3 pt-0 mt-1">
                    {children}
                </div>
            </motion.div>
        </div>
    );
};

export default function CreativePanel({ toggleRightPanel }: CreativePanelProps) {
    const [activeTab, setActiveTab] = useState('create');
    const {
        studioControls, setStudioControls,
        whiskState, addWhiskItem, removeWhiskItem, toggleWhiskItem, updateWhiskItem, setPreciseReference, setTargetMedia,
        videoInputs, setVideoInput
    } = useStore(useShallow((state: StoreState) => ({
        studioControls: state.studioControls,
        setStudioControls: state.setStudioControls,
        whiskState: state.whiskState,
        addWhiskItem: state.addWhiskItem,
        removeWhiskItem: state.removeWhiskItem,
        toggleWhiskItem: state.toggleWhiskItem,
        updateWhiskItem: state.updateWhiskItem,
        setPreciseReference: state.setPreciseReference,
        setTargetMedia: state.setTargetMedia,
        videoInputs: state.videoInputs,
        setVideoInput: state.setVideoInput
    })));
    const toast = useToast();



    const [expandedSection, setExpandedSection] = useState<string>('mixer');

    return (
        <div className="flex flex-col h-full bg-linear-to-b from-bg-dark to-bg-dark/90">
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
                <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
                    <SectionCard
                        isOpen={expandedSection === 'mixer'}
                        onToggle={() => setExpandedSection(expandedSection === 'mixer' ? '' : 'mixer')}
                        title={<div className="flex items-center justify-between w-full">
                            <span>Reference Mixer</span>
                            {((whiskState.subjects?.filter(i => i.checked).length || 0) +
                                (whiskState.scenes?.filter(i => i.checked).length || 0) +
                                (whiskState.styles?.filter(i => i.checked).length || 0) +
                                (whiskState.motion?.filter(i => i.checked).length || 0)) > 0 && (
                                    <span className="text-[9px] text-purple-400 normal-case ml-2">
                                        {(whiskState.subjects?.filter(i => i.checked).length || 0) +
                                            (whiskState.scenes?.filter(i => i.checked).length || 0) +
                                            (whiskState.styles?.filter(i => i.checked).length || 0) +
                                            (whiskState.motion?.filter(i => i.checked).length || 0)} locked
                                    </span>
                                )}
                        </div>}
                        icon={<Sparkles className="text-purple-400" size={14} />}
                    >
                        <div className="space-y-4">
                            <div className="flex items-center justify-end mb-2">
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

                            <div className="flex items-center gap-1 p-1 bg-black/40 rounded-lg mb-2">
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
                                        ? 'bg-linear-to-r from-purple-500/30 to-blue-500/30 text-white shadow-[0_0_8px_rgba(147,51,234,0.2)]'
                                        : 'text-gray-500 hover:text-gray-300'
                                        }`}
                                >
                                    <ImagePlay size={12} />
                                    Both
                                </button>
                            </div>

                            {whiskState.targetMedia !== 'image' && (
                                <div className="flex bg-black/40 p-1 rounded-lg">
                                    <button
                                        onClick={() => setStudioControls({ isTransitionMode: false })}
                                        className={`flex-1 text-[10px] py-1 text-center rounded ${!studioControls.isTransitionMode ? 'text-white bg-white/10' : 'text-gray-400'}`}
                                    >
                                        Standard
                                    </button>
                                    <button
                                        onClick={() => setStudioControls({ isTransitionMode: true })}
                                        className={`flex-1 text-[10px] py-1 text-center rounded ${studioControls.isTransitionMode ? 'text-blue-400 bg-blue-500/10' : 'text-gray-400'}`}
                                    >
                                        Interpolation Setup
                                    </button>
                                </div>
                            )}

                            <div className="space-y-2 mt-2">
                                {studioControls.isTransitionMode ? (
                                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-300">
                                        <div className="bg-blue-500/5 rounded-xl border border-blue-500/20 p-3 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] font-bold text-blue-400 tracking-wider flex items-center gap-2">
                                                    <Video size={12} /> TRANSITION KEYFRAMES
                                                </label>
                                                <button
                                                    onClick={() => { setVideoInput('firstFrame', null); setVideoInput('lastFrame', null); }}
                                                    className="text-[9px] text-gray-600 hover:text-gray-400 uppercase font-bold"
                                                >
                                                    Clear All
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-2">
                                                    <span className="text-[9px] text-gray-500 uppercase font-bold">Start Frame</span>
                                                    <WhiskDropZone
                                                        title=""
                                                        category="subject"
                                                        items={videoInputs.firstFrame ? [{ id: 'ff', type: 'image', content: videoInputs.firstFrame.url, checked: true, category: 'subject' }] : []}
                                                        onAdd={(type, content) => setVideoInput('firstFrame', { id: `ff_${Date.now()}`, type: 'image', url: content, prompt: 'Start frame', timestamp: Date.now(), projectId: '' })}
                                                        onRemove={() => setVideoInput('firstFrame', null)}
                                                        onToggle={() => { }}
                                                        onUpdate={() => { }}
                                                        description="Drop start"
                                                        compact={true}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <span className="text-[9px] text-gray-500 uppercase font-bold">End Frame</span>
                                                    <WhiskDropZone
                                                        title=""
                                                        category="subject"
                                                        items={videoInputs.lastFrame ? [{ id: 'lf', type: 'image', content: videoInputs.lastFrame.url, checked: true, category: 'subject' }] : []}
                                                        onAdd={(type, content) => setVideoInput('lastFrame', { id: `lf_${Date.now()}`, type: 'image', url: content, prompt: 'End frame', timestamp: Date.now(), projectId: '' })}
                                                        onRemove={() => setVideoInput('lastFrame', null)}
                                                        onToggle={() => { }}
                                                        onUpdate={() => { }}
                                                        description="Drop end"
                                                        compact={true}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <>
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
                                    </>
                                )}
                            </div>
                            <div className="pt-2 border-t border-white/10">
                                <WhiskPresetStyles onSelectPreset={(preset) => {
                                    const exists = whiskState.styles.some(s => s.content === preset.prompt);
                                    if (exists) {
                                        const item = whiskState.styles.find(s => s.content === preset.prompt);
                                        if (item) toggleWhiskItem('style', item.id);
                                    } else {
                                        addWhiskItem('style', 'text', preset.prompt, preset.label);
                                    }
                                    if (preset.aspectRatio) setStudioControls({ aspectRatio: preset.aspectRatio as AspectRatio });
                                    if (preset.duration) setStudioControls({ duration: preset.duration });
                                    toast.success(`Style: ${preset.label}`);
                                }} />
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard
                        isOpen={expandedSection === 'advanced'}
                        onToggle={() => setExpandedSection(expandedSection === 'advanced' ? '' : 'advanced')}
                        title="Model & Constraints"
                        icon={<Zap className="text-yellow-400" size={14} />}
                    >
                        <div className="space-y-4">
                            <div className="flex items-center justify-between mt-1 mb-2">
                                <span className="text-[10px] font-bold text-gray-400 tracking-wider">THINKING MODE</span>
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setStudioControls({ thinkingLevel: studioControls.thinkingLevel === 'none' ? 'high' : 'none' })}
                                    className={`relative flex items-center gap-2 px-3 py-1 bg-black/40 rounded-full text-[10px] font-bold tracking-wide transition-all border ${studioControls.thinkingLevel !== 'none'
                                        ? 'border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.3)] text-purple-200'
                                        : 'border-white/5 text-gray-500 hover:border-white/20 hover:text-gray-300'
                                        }`}
                                >
                                    <Brain size={12} className={studioControls.thinkingLevel !== 'none' ? "text-purple-300 animate-pulse" : ""} />
                                    {studioControls.thinkingLevel !== 'none' ? 'HIGH' : 'OFF'}
                                </motion.button>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-black/60 p-1 rounded-xl flex relative h-9 border border-white/5">
                                    <motion.div
                                        className="absolute top-1 bottom-1 rounded-lg bg-white/10 border border-white/10 shadow-sm"
                                        initial={false}
                                        animate={{ left: studioControls.model === 'fast' ? '4px' : '50%', width: 'calc(50% - 4px)' }}
                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                    />
                                    <button
                                        onClick={() => setStudioControls({ model: 'fast' })}
                                        className={`flex-1 relative z-10 text-[10px] font-bold uppercase transition-colors ${studioControls.model === 'fast' ? 'text-white' : 'text-gray-500'}`}
                                    >
                                        Flash
                                    </button>
                                    <button
                                        onClick={() => setStudioControls({ model: 'pro' })}
                                        className={`flex-1 relative z-10 text-[10px] font-bold uppercase transition-colors ${studioControls.model === 'pro' ? 'text-purple-300' : 'text-gray-500'}`}
                                    >
                                        Pro
                                    </button>
                                </div>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none z-20">
                                        <Layers size={12} className={`transition-colors ${studioControls.mediaResolution === 'high' ? 'text-blue-400' : 'text-gray-500'}`} />
                                    </div>
                                    <select
                                        value={studioControls.mediaResolution || 'medium'}
                                        onChange={(e) => setStudioControls({ mediaResolution: e.target.value as 'low' | 'medium' | 'high' })}
                                        className="w-full h-9 bg-black/60 text-white text-[10px] pl-9 pr-8 rounded-xl border border-white/5 outline-none appearance-none hover:bg-black/80 font-medium"
                                    >
                                        <option value="low">Low Res (Fast)</option>
                                        <option value="medium">Standard</option>
                                        <option value="high">High Res (Quality)</option>
                                    </select>
                                    <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
                                </div>
                            </div>
                            
                            <div className="space-y-2 mt-2">
                                <label className="text-[10px] font-bold text-gray-500 tracking-wider">NEGATIVE PROMPT</label>
                                <textarea
                                    value={studioControls.negativePrompt}
                                    onChange={(e) => setStudioControls({ negativePrompt: e.target.value })}
                                    className="w-full bg-black/40 text-white text-sm p-3 rounded-xl border border-white/10 outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 h-20 resize-none placeholder:text-gray-600"
                                    placeholder="Elements to exclude..."
                                />
                            </div>

                            {whiskState.targetMedia !== 'image' && (
                                <motion.button
                                    onClick={() => setStudioControls({ generateAudio: !studioControls.generateAudio })}
                                    className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${studioControls.generateAudio
                                        ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                                        : 'bg-black/40 text-gray-500 border border-transparent hover:bg-black/60'
                                        }`}
                                >
                                    <div className={`w-2 h-2 rounded-full ${studioControls.generateAudio ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
                                    Generate Soundtrack
                                </motion.button>
                            )}
                        </div>
                    </SectionCard>

                    <SectionCard
                        isOpen={expandedSection === 'settings'}
                        onToggle={() => setExpandedSection(expandedSection === 'settings' ? '' : 'settings')}
                        title="Output Settings"
                        icon={<Sliders className="text-blue-400" size={14} />}
                    >
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-500 tracking-wider">ASPECT RATIO</label>
                                <div className="relative group">
                                    <select
                                        value={studioControls.aspectRatio}
                                        onChange={(e) => setStudioControls({ aspectRatio: e.target.value as AspectRatio })}
                                        className="w-full bg-black/40 text-white text-xs p-2.5 rounded-xl border border-white/10 outline-none appearance-none hover:bg-black/60"
                                    >
                                        <option value="16:9">16:9 Landscape</option>
                                        <option value="16:10">16:10 Widescreen</option>
                                        <option value="21:9">21:9 Cinematic</option>
                                        <option value="1:1">1:1 Square</option>
                                        <option value="9:16">9:16 Portrait</option>
                                    </select>
                                    <ChevronDown size={12} className="absolute right-3 top-3 text-gray-500 pointer-events-none" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-500 tracking-wider">RESOLUTION</label>
                                <div className="relative group">
                                    <select
                                        value={studioControls.resolution || '1024x1024'}
                                        onChange={(e) => setStudioControls({ resolution: e.target.value as VideoResolution })}
                                        className="w-full bg-black/40 text-white text-xs p-2.5 rounded-xl border border-white/10 outline-none appearance-none hover:bg-black/60"
                                    >
                                        <option value="1280x720">HD (720p)</option>
                                        <option value="1920x1080">FHD (1080p)</option>
                                        <option value="4k">UHD (4K)</option>
                                    </select>
                                    <ChevronDown size={12} className="absolute right-3 top-3 text-gray-500 pointer-events-none" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-500 tracking-wider">DURATION</label>
                                <div className="relative group">
                                    <select
                                        value={studioControls.duration}
                                        onChange={(e) => setStudioControls({ duration: parseInt(e.target.value) })}
                                        className="w-full bg-black/40 text-white text-xs p-2.5 rounded-xl border border-white/10 outline-none appearance-none hover:bg-black/60"
                                    >
                                        <option value={4}>4 seconds</option>
                                        <option value={6}>6 seconds</option>
                                        <option value={8}>8 seconds</option>
                                    </select>
                                    <ChevronDown size={12} className="absolute right-3 top-3 text-gray-500 pointer-events-none" />
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
                                    className="w-full bg-black/40 text-white text-xs p-2.5 rounded-xl border border-white/10 outline-none focus:border-purple-500/50 placeholder:text-gray-600"
                                />
                            </div>
                        </div>
                    </SectionCard>
                </div>
            )}
        </div>
    );
}
