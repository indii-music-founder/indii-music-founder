import { useState, useMemo } from 'react';
import { Wand2, History, ChevronRight, ChevronDown, Sliders, Zap, Brain, Layers, Video, Move, Plus, Settings, Sparkles, Image as ImageIcon, Film, ImagePlay, Loader2 } from 'lucide-react';
import CreativeGallery from '../../../modules/creative/components/CreativeGallery';
import { useStore } from '../../store';
import { useShallow } from 'zustand/react/shallow';
import { StoreState } from '../../store';
import { useToast } from '@/core/context/ToastContext';
import { z } from 'zod';
import { AspectRatioSchema, VideoResolutionSchema } from '@/modules/video/schemas';
import { WhiskDropZone } from '@/modules/creative/components/whisk/WhiskDropZone';
import WhiskPresetStyles from '@/modules/creative/components/whisk/WhiskPresetStyles';
import { motion } from 'motion/react';
import { CharacterLibrary } from '@/modules/creative/components/CharacterLibrary';

type AspectRatio = z.infer<typeof AspectRatioSchema>;
type VideoResolution = z.infer<typeof VideoResolutionSchema>;

interface StudioControlsPanelProps {
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

export default function StudioControlsPanel({ toggleRightPanel }: StudioControlsPanelProps) {
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

    const estimatedCost = useMemo(() => {
        if (whiskState.targetMedia === 'image') return null;
        const is4k = studioControls.resolution === '4k';
        if (studioControls.model === 'fast') return is4k ? 0.15 : 0.08;
        if (studioControls.model === 'pro') return is4k ? 0.80 : 0.50;
        return 0;
    }, [whiskState.targetMedia, studioControls.model, studioControls.resolution]);

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
                                <div className="mb-4">
                                    <CharacterLibrary />
                                </div>
                            )}

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
                        title={
                            <div className="flex items-center justify-between w-full">
                                <span>Model &amp; Constraints</span>
                                {estimatedCost !== null && (
                                    <span className="text-[10px] text-green-400 font-mono font-medium ml-2 bg-green-500/10 px-1.5 py-0.5 rounded">
                                        ~${estimatedCost.toFixed(2)}
                                    </span>
                                )}
                            </div>
                        }
                        icon={<Zap className="text-yellow-400" size={14} />}
                    >
                        <div className="space-y-4">
                            {/* ── Model Tier ─────────────────────────────── */}
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
                                        title="Nano Banana 2 (Gemini 3.1 Flash) — Speed + quality"
                                    >
                                        Flash
                                    </button>
                                    <button
                                        onClick={() => setStudioControls({ model: 'pro' })}
                                        className={`flex-1 relative z-10 text-[10px] font-bold uppercase transition-colors ${studioControls.model === 'pro' ? 'text-purple-300' : 'text-gray-500'}`}
                                        title="Nano Banana Pro (Gemini 3 Pro) — Max quality, 14 refs, 5 chars"
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

                            {/* ── Thinking Level (model-aware) ────────────── */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-gray-400 tracking-wider flex items-center gap-1.5">
                                        <Brain size={11} className={studioControls.model === 'pro' || studioControls.thinkingLevel !== 'none' ? 'text-purple-400 animate-pulse' : 'text-gray-500'} />
                                        THINKING
                                    </span>
                                    {(studioControls.model === 'pro' || studioControls.thinkingLevel !== 'none') && (
                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                            <span className="text-[9px] text-gray-500">Show thoughts</span>
                                            <button
                                                onClick={() => setStudioControls({ includeThoughts: !studioControls.includeThoughts })}
                                                className={`w-6 h-3.5 rounded-full relative transition-all ${studioControls.includeThoughts ? 'bg-purple-600' : 'bg-gray-800'}`}
                                            >
                                                <motion.div
                                                    animate={{ x: studioControls.includeThoughts ? 10 : 2 }}
                                                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                                    className={`absolute top-0.5 left-0 w-2.5 h-2.5 rounded-full ${studioControls.includeThoughts ? 'bg-white' : 'bg-gray-500'}`}
                                                />
                                            </button>
                                        </label>
                                    )}
                                </div>
                                {studioControls.model === 'pro' ? (
                                    /* Pro: Thinking is always on, cannot be disabled */
                                    <div className="flex items-center gap-2 bg-purple-500/10 px-3 py-2 rounded-lg border border-purple-500/20">
                                        <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                                        <span className="text-[10px] text-purple-300 font-medium">Always On — Generates interim thought images</span>
                                    </div>
                                ) : (
                                    /* Flash (NB2): Off / Minimal / High */
                                    <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
                                        {(['none', 'minimal', 'high'] as const).map((level) => (
                                            <button
                                                key={level}
                                                onClick={() => setStudioControls({ thinkingLevel: level })}
                                                className={`flex-1 py-1.5 rounded-md text-[9px] font-bold uppercase tracking-wide transition-all ${
                                                    studioControls.thinkingLevel === level
                                                        ? level === 'none'
                                                            ? 'bg-white/10 text-gray-200'
                                                            : 'bg-purple-500/25 text-purple-200 shadow-[0_0_8px_rgba(168,85,247,0.3)]'
                                                        : 'text-gray-500 hover:text-gray-300'
                                                }`}
                                            >
                                                {level === 'none' ? 'Off' : level === 'minimal' ? 'Min' : 'High'}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* ── Person Generation ──────────────────────── */}
                            <div className="space-y-2">
                                <span className="text-[10px] font-bold text-gray-400 tracking-wider">PEOPLE</span>
                                <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
                                    {([
                                        { value: 'dont_allow' as const, label: 'None', icon: '🚫' },
                                        { value: 'allow_adult' as const, label: 'Adults', icon: '🧑' },
                                        { value: 'allow_all' as const, label: 'All Ages', icon: '👥' },
                                    ]).map((opt) => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setStudioControls({ personGeneration: opt.value })}
                                            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[9px] font-bold uppercase transition-all ${
                                                studioControls.personGeneration === opt.value
                                                    ? 'bg-white/10 text-gray-200'
                                                    : 'text-gray-500 hover:text-gray-300'
                                            }`}
                                        >
                                            <span className="text-[10px]">{opt.icon}</span>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* ── Grounding & Search ─────────────────────── */}
                            <div className="space-y-2">
                                <span className="text-[10px] font-bold text-gray-400 tracking-wider">GROUNDING</span>
                                <div className="flex items-center gap-3">
                                    <label className="flex items-center gap-2 cursor-pointer flex-1">
                                        <button
                                            onClick={() => setStudioControls({ useGrounding: !studioControls.useGrounding, useImageSearch: !studioControls.useGrounding ? studioControls.useImageSearch : false })}
                                            className={`w-8 h-4 rounded-full relative transition-all ${studioControls.useGrounding ? 'bg-blue-600 shadow-[0_0_8px_rgba(59,130,246,0.4)]' : 'bg-gray-800'}`}
                                        >
                                            <motion.div
                                                animate={{ x: studioControls.useGrounding ? 16 : 2 }}
                                                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                                className={`absolute top-0.5 left-0 w-3 h-3 rounded-full ${studioControls.useGrounding ? 'bg-white' : 'bg-gray-500'}`}
                                            />
                                        </button>
                                        <span className="text-[10px] text-gray-400 font-medium">Google Search</span>
                                    </label>
                                    {studioControls.useGrounding && studioControls.model === 'fast' && (
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <button
                                                onClick={() => setStudioControls({ useImageSearch: !studioControls.useImageSearch })}
                                                className={`w-8 h-4 rounded-full relative transition-all ${studioControls.useImageSearch ? 'bg-cyan-600 shadow-[0_0_8px_rgba(6,182,212,0.4)]' : 'bg-gray-800'}`}
                                            >
                                                <motion.div
                                                    animate={{ x: studioControls.useImageSearch ? 16 : 2 }}
                                                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                                    className={`absolute top-0.5 left-0 w-3 h-3 rounded-full ${studioControls.useImageSearch ? 'bg-white' : 'bg-gray-500'}`}
                                                />
                                            </button>
                                            <span className="text-[10px] text-cyan-400 font-medium">+ Images</span>
                                        </label>
                                    )}
                                </div>
                            </div>

                            {/* ── Batch Count & Output Format ─────────────── */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <span className="text-[10px] font-bold text-gray-400 tracking-wider">BATCH</span>
                                    <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
                                        {[1, 2, 3, 4].map((n) => (
                                            <button
                                                key={n}
                                                onClick={() => setStudioControls({ batchCount: n })}
                                                className={`flex-1 py-1 rounded-md text-[10px] font-bold transition-all ${
                                                    studioControls.batchCount === n
                                                        ? 'bg-white/10 text-white'
                                                        : 'text-gray-500 hover:text-gray-300'
                                                }`}
                                            >
                                                {n}×
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <span className="text-[10px] font-bold text-gray-400 tracking-wider">OUTPUT</span>
                                    <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
                                        <button
                                            onClick={() => setStudioControls({ responseFormat: 'image_only' })}
                                            className={`flex-1 py-1 rounded-md text-[9px] font-bold uppercase transition-all ${
                                                studioControls.responseFormat === 'image_only'
                                                    ? 'bg-white/10 text-white'
                                                    : 'text-gray-500 hover:text-gray-300'
                                            }`}
                                        >
                                            Image
                                        </button>
                                        <button
                                            onClick={() => setStudioControls({ responseFormat: 'image_and_text' })}
                                            className={`flex-1 py-1 rounded-md text-[9px] font-bold uppercase transition-all ${
                                                studioControls.responseFormat === 'image_and_text'
                                                    ? 'bg-amber-500/20 text-amber-300'
                                                    : 'text-gray-500 hover:text-gray-300'
                                            }`}
                                            title="Interleaved image + text narration"
                                        >
                                            + Text
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* ── Negative Prompt ──────────────────────── */}
                            <div className="space-y-2 mt-2">
                                <label className="text-[10px] font-bold text-gray-500 tracking-wider">NEGATIVE PROMPT</label>
                                <textarea
                                    value={studioControls.negativePrompt}
                                    onChange={(e) => setStudioControls({ negativePrompt: e.target.value })}
                                    className="w-full bg-black/40 text-white text-sm p-3 rounded-xl border border-white/10 outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 h-20 resize-none placeholder:text-gray-600 transition-all"
                                    placeholder='e.g. "no blurry parts, no extra limbs"'
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
                            {/* ── Aspect Ratio (full 14 API options) ────── */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-500 tracking-wider">ASPECT RATIO</label>
                                <div className="relative group">
                                    <select
                                        value={studioControls.aspectRatio}
                                        onChange={(e) => setStudioControls({ aspectRatio: e.target.value as AspectRatio })}
                                        className="w-full bg-black/40 text-white text-xs p-2.5 rounded-xl border border-white/10 outline-none appearance-none hover:bg-black/60"
                                    >
                                        <optgroup label="Standard">
                                            <option value="1:1">1:1 Square</option>
                                            <option value="4:3">4:3 Classic</option>
                                            <option value="3:2">3:2 Photo</option>
                                            <option value="16:9">16:9 Landscape</option>
                                            <option value="21:9">21:9 Cinematic</option>
                                        </optgroup>
                                        <optgroup label="Portrait">
                                            <option value="3:4">3:4 Classic Portrait</option>
                                            <option value="2:3">2:3 Photo Portrait</option>
                                            <option value="9:16">9:16 Portrait</option>
                                            <option value="4:5">4:5 Social Portrait</option>
                                            <option value="5:4">5:4 Balanced</option>
                                        </optgroup>
                                        {/* Extreme ratios — Flash (NB2) only, not supported by Pro */}
                                        {studioControls.model === 'fast' && (
                                            <optgroup label="Extreme (Flash only)">
                                                <option value="4:1">4:1 Panoramic</option>
                                                <option value="1:4">1:4 Tall Banner</option>
                                                <option value="8:1">8:1 Ultra Wide</option>
                                                <option value="1:8">1:8 Story Strip</option>
                                                <option value="2:1">2:1 Wide</option>
                                            </optgroup>
                                        )}
                                    </select>
                                    <ChevronDown size={12} className="absolute right-3 top-3 text-gray-500 pointer-events-none" />
                                </div>
                            </div>

                            {/* ── Resolution (mode-aware) ────────────────── */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-500 tracking-wider">
                                    {whiskState.targetMedia === 'image' ? 'IMAGE SIZE' : 'RESOLUTION'}
                                </label>
                                <div className="relative group">
                                    {whiskState.targetMedia === 'image' ? (
                                        <select
                                            value={studioControls.imageSize || '2K'}
                                            onChange={(e) => setStudioControls({ imageSize: e.target.value as '0.5K' | '1K' | '2K' | '4K' })}
                                            className="w-full bg-black/40 text-white text-xs p-2.5 rounded-xl border border-white/10 outline-none appearance-none hover:bg-black/60"
                                        >
                                            {studioControls.model === 'fast' && (
                                                <option value="0.5K">0.5K (512px — Mobile)</option>
                                            )}
                                            <option value="1K">1K (Standard)</option>
                                            <option value="2K">2K (Production)</option>
                                            <option value="4K">4K (Max Quality)</option>
                                        </select>
                                    ) : (
                                        <select
                                            value={studioControls.resolution || '720p'}
                                            onChange={(e) => setStudioControls({ resolution: e.target.value as VideoResolution })}
                                            className="w-full bg-black/40 text-white text-xs p-2.5 rounded-xl border border-white/10 outline-none appearance-none hover:bg-black/60"
                                        >
                                            <option value="720p">HD (720p)</option>
                                            <option value="1080p">FHD (1080p)</option>
                                            <option value="4k">UHD (4K)</option>
                                        </select>
                                    )}
                                    <ChevronDown size={12} className="absolute right-3 top-3 text-gray-500 pointer-events-none" />
                                </div>
                            </div>

                            {/* ── Duration (video only) ──────────────────── */}
                            {whiskState.targetMedia !== 'image' && (
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[10px] font-bold text-gray-500 tracking-wider">DURATION</label>
                                        <span className="text-[10px] text-gray-400 font-mono">{studioControls.duration}s</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="4"
                                        max="8"
                                        step="2"
                                        value={studioControls.duration}
                                        onChange={(e) => setStudioControls({ duration: parseInt(e.target.value) })}
                                        className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:transition-all hover:[&::-webkit-slider-thumb]:scale-125"
                                    />
                                    <div className="flex justify-between items-center mt-1 h-4">
                                        {studioControls.duration === 4 && (
                                            <p className="text-[9px] text-green-400 flex items-center gap-1">
                                                <Sparkles size={10} /> High stability (95%)
                                            </p>
                                        )}
                                        {studioControls.duration === 6 && (
                                            <p className="text-[9px] text-blue-400 flex items-center gap-1">
                                                <Sparkles size={10} /> Standard generation
                                            </p>
                                        )}
                                        {studioControls.duration >= 8 && (
                                            <p className="text-[9px] text-orange-400 flex items-center gap-1">
                                                ⚠️ Stability Warning (~80% success)
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ── Seed (video only — not supported by image API) */}
                            {whiskState.targetMedia !== 'image' && (
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
                            )}
                        </div>
                    </SectionCard>

                    <SectionCard
                        isOpen={expandedSection === 'camera'}
                        onToggle={() => setExpandedSection(expandedSection === 'camera' ? '' : 'camera')}
                        title="Camera & Motion"
                        icon={<Move className="text-blue-400" size={14} />}
                    >
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-500 tracking-wider flex items-center gap-2">
                                    <Move size={12} /> CAMERA MOVEMENT
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['Zoom In', 'Pan Left', 'Tilt Up'].map((move) => (
                                        <button
                                            key={move}
                                            data-testid={`camera-${move.toLowerCase().replace(' ', '-')}`}
                                            className="px-2 py-2 bg-black/40 hover:bg-white/10 rounded-lg text-[10px] text-gray-300 border border-white/10 hover:border-white/20 transition-all"
                                        >
                                            {move}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <label className="text-[10px] font-bold text-gray-500 tracking-wider">MOTION STRENGTH</label>
                                    <span className="text-[10px] text-gray-500 font-mono">{studioControls.motionStrength || 0.5}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={(studioControls.motionStrength || 0.5) * 100}
                                    onChange={(e) => setStudioControls({ motionStrength: parseInt(e.target.value) / 100 })}
                                    data-testid="motion-slider"
                                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:transition-all hover:[&::-webkit-slider-thumb]:scale-125"
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <label className="text-[10px] font-bold text-gray-500 tracking-wider">FPS</label>
                                    <span className="text-[10px] text-gray-500 font-mono">24</span>
                                </div>
                                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                    <div className="h-full w-[40%] bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                                </div>
                            </div>
                        </div>
                    </SectionCard>

                    {whiskState.targetMedia !== 'image' && (
                        <SectionCard
                            isOpen={expandedSection === 'shotlist'}
                            onToggle={() => setExpandedSection(expandedSection === 'shotlist' ? '' : 'shotlist')}
                            title="Shot List"
                            icon={<Video className="text-purple-400" size={14} />}
                        >
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-bold text-gray-500 tracking-wider">SEQUENCE</label>
                                    <span className="text-[10px] text-gray-600 font-mono">00:00 / 00:15</span>
                                </div>

                                <div className="space-y-2">
                                    {[1, 2].map((shot) => (
                                        <motion.div
                                            key={shot}
                                            whileHover={{ scale: 1.01 }}
                                            className="group relative bg-black/40 rounded-xl border border-white/10 p-2 flex gap-3 hover:border-blue-500/30 transition-all cursor-pointer shadow-sm"
                                        >
                                            <div className="w-12 h-12 bg-white/5 rounded-lg flex items-center justify-center shrink-0 border border-white/5">
                                                <Video size={14} className="text-gray-600" />
                                            </div>
                                            <div className="flex-1 min-w-0 py-1">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="text-[11px] font-medium text-gray-300 group-hover:text-blue-400 transition-colors">Shot {shot}</span>
                                                    <span className="text-[9px] font-mono text-gray-600 bg-white/5 px-1.5 py-0.5 rounded">4.0s</span>
                                                </div>
                                                <p className="text-[9px] text-gray-500 truncate">Cinematic drone shot over mountains...</p>
                                            </div>
                                            <div className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button className="p-1 hover:bg-white/10 rounded"><Settings size={10} className="text-gray-400" /></button>
                                            </div>
                                        </motion.div>
                                    ))}
                                    <button
                                        data-testid="add-shot-btn"
                                        className="w-full py-2.5 border border-dashed border-white/10 rounded-xl text-[11px] text-gray-500 hover:text-gray-300 hover:border-white/20 hover:bg-white/5 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Plus size={12} /> Add New Shot
                                    </button>
                                </div>
                            </div>
                        </SectionCard>
                    )}
                </div>
            )}
        </div>
    );
}
