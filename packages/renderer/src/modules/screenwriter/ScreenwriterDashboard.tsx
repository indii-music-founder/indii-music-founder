import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ThreePanelDashboard } from '@/components/layout/ThreePanelDashboard';
import {
    FileText, Video, Sparkles, Plus, Trash2, Download, Send, Film, Compass, RotateCw
} from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';

interface StoryboardScene {
    id: string;
    sceneNumber: number;
    heading: string;
    description: string;
    cameraAngle: string;
    duration: number; // in seconds
    veoPrompt: string;
}

interface ScreenwriterDraft {
    activeTab: 'scriptwriter' | 'storyboard' | 'veoprompts';
    songConcept: string;
    selectedTone: 'cinematic' | 'abstract' | 'hype';
    scenes: StoryboardScene[];
    selectedSceneId: string;
}

const SCREENWRITER_DRAFT_STORAGE_KEY = 'indii-screenwriter-draft-v1';

const DEFAULT_SCENES: StoryboardScene[] = [
    {
        id: '1',
        sceneNumber: 1,
        heading: 'EXT. CITY ALLEY - NIGHT',
        description: 'Neon glowing signs flicker. Slick puddles on concrete reflect vibrant magenta and cyan lights. Rain droplets splash slowly on the pavement.',
        cameraAngle: 'Extreme Wide Shot - Slow tracking lateral pan',
        duration: 5,
        veoPrompt: 'Cinematic wide tracking shot of a rainy neon alley at night, reflections in puddles, photorealistic 8k, slow motion.'
    },
    {
        id: '2',
        sceneNumber: 2,
        heading: 'INT. UNDERGROUND METRO STATION - NIGHT',
        description: 'The artist descends the concrete steps. Fluorescent lights flicker overhead. The hum of a distant train echoes through the tiled vault.',
        cameraAngle: 'Medium Close Up - Low angle looking up',
        duration: 8,
        veoPrompt: 'Low-angle medium close-up of a musician walking down retro underground metro subway steps, dim flickering lighting, moody aesthetic.'
    },
    {
        id: '3',
        sceneNumber: 3,
        heading: 'EXT. ROOFTOP OVERLOOK - DAWN',
        description: 'The sky breaks into gold and violet gradients. The artist stands at the ledge, overlooking a massive futuristic cityscape. Wind blows through their jacket.',
        cameraAngle: 'High Angle Crane Shot - Orbit rotation',
        duration: 7,
        veoPrompt: 'Epic drone orbit shot of a singer on a rooftop looking at a gold and purple sunrise over a huge cyber city, wind blowing, premium CGI look.'
    }
];

function createDefaultDraft(): ScreenwriterDraft {
    return {
        activeTab: 'scriptwriter',
        songConcept: 'An independent artist walking through a neon-lit rain-slicked city alleyway, with reflections of holographic advertisements detailing their journey.',
        selectedTone: 'cinematic',
        scenes: DEFAULT_SCENES,
        selectedSceneId: DEFAULT_SCENES[0]?.id ?? '1',
    };
}

function isStoryboardScene(value: unknown): value is StoryboardScene {
    if (!value || typeof value !== 'object') return false;
    const scene = value as StoryboardScene;
    return (
        typeof scene.id === 'string' &&
        typeof scene.sceneNumber === 'number' &&
        typeof scene.heading === 'string' &&
        typeof scene.description === 'string' &&
        typeof scene.cameraAngle === 'string' &&
        typeof scene.duration === 'number' &&
        typeof scene.veoPrompt === 'string'
    );
}

function normalizeDraft(value: unknown): ScreenwriterDraft {
    const fallback = createDefaultDraft();
    if (!value || typeof value !== 'object') return fallback;

    const draft = value as Partial<ScreenwriterDraft>;
    const scenes = Array.isArray(draft.scenes)
        ? draft.scenes.filter(isStoryboardScene).map((scene, index) => ({
            ...scene,
            sceneNumber: index + 1,
        }))
        : fallback.scenes;

    return {
        activeTab: draft.activeTab === 'storyboard' || draft.activeTab === 'veoprompts' ? draft.activeTab : 'scriptwriter',
        songConcept: typeof draft.songConcept === 'string' && draft.songConcept.trim() ? draft.songConcept : fallback.songConcept,
        selectedTone: draft.selectedTone === 'abstract' || draft.selectedTone === 'hype' ? draft.selectedTone : 'cinematic',
        scenes: scenes.length > 0 ? scenes : fallback.scenes,
        selectedSceneId: typeof draft.selectedSceneId === 'string' && scenes.some(scene => scene.id === draft.selectedSceneId)
            ? draft.selectedSceneId
            : (scenes[0]?.id ?? fallback.selectedSceneId),
    };
}

function loadDraft(): ScreenwriterDraft {
    if (typeof window === 'undefined') return createDefaultDraft();

    try {
        const raw = window.localStorage.getItem(SCREENWRITER_DRAFT_STORAGE_KEY);
        if (!raw) return createDefaultDraft();
        return normalizeDraft(JSON.parse(raw));
    } catch {
        return createDefaultDraft();
    }
}

function saveDraft(draft: ScreenwriterDraft): void {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(SCREENWRITER_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
        // Ignore storage quota / private browsing failures.
    }
}

export default function ScreenwriterDashboard() {
    const [initialDraft] = useState<ScreenwriterDraft>(() => loadDraft());
    const [activeTab, setActiveTab] = useState<ScreenwriterDraft['activeTab']>(initialDraft.activeTab);
    const toast = useToast();
    const { setModule, setGenerationMode, setViewMode, setCreativePrompt } = useStore(useShallow(state => ({
        setModule: state.setModule,
        setGenerationMode: state.setGenerationMode,
        setViewMode: state.setViewMode,
        setCreativePrompt: state.setCreativePrompt
    })));
    const [isExporting, setIsExporting] = useState(false);
    const [isHandoffLoading, setIsHandoffLoading] = useState(false);
    
    // Default Script Mood & Song Outline
    const [songConcept, setSongConcept] = useState(initialDraft.songConcept);
    const [selectedTone, setSelectedTone] = useState<ScreenwriterDraft['selectedTone']>(initialDraft.selectedTone);
    const [isGenerating, setIsGenerating] = useState(false);
    
    // Manage scenes
    const [scenes, setScenes] = useState<StoryboardScene[]>(initialDraft.scenes);

    const [selectedSceneId, setSelectedSceneId] = useState<string>(initialDraft.selectedSceneId);

    useEffect(() => {
        saveDraft({
            activeTab,
            songConcept,
            selectedTone,
            scenes,
            selectedSceneId,
        });
    }, [activeTab, songConcept, selectedTone, scenes, selectedSceneId]);

    const buildStoryboardArtifact = () => {
        const sceneSections = scenes.map(scene => [
            `### Scene ${scene.sceneNumber}`,
            `- Heading: ${scene.heading}`,
            `- Duration: ${scene.duration}s`,
            `- Camera: ${scene.cameraAngle}`,
            `- Description: ${scene.description}`,
            `- Veo Prompt: ${scene.veoPrompt}`,
        ].join('\n')).join('\n\n');

        return [
            '# Screenwriter Draft',
            '',
            `## Concept`,
            songConcept,
            '',
            `## Tone`,
            selectedTone,
            '',
            `## Scene List`,
            sceneSections,
        ].join('\n');
    };

    const handleExportScript = async () => {
        if (!window.electronAPI?.agent?.createArtifact) {
            toast.error('Script export is only available in the desktop app.');
            return;
        }

        setIsExporting(true);
        try {
            const result = await window.electronAPI.agent.createArtifact(
                `screenwriter-script-${Date.now()}.md`,
                buildStoryboardArtifact(),
                { artifactType: 'walkthrough' }
            );

            if (result.success) {
                toast.success('Script exported to an artifact.');
            } else {
                toast.error(result.error || 'Failed to export script.');
            }
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : 'Failed to export script.');
        } finally {
            setIsExporting(false);
        }
    };

    const handleOpenCreativeStudio = async () => {
        setIsHandoffLoading(true);
        try {
            const handoffPrompt = [
                `Song concept: ${songConcept}`,
                `Tone: ${selectedTone}`,
                'Storyboard beats:',
                ...scenes.map(scene => `${scene.sceneNumber}. ${scene.heading} - ${scene.veoPrompt}`)
            ].join('\n');

            setCreativePrompt(handoffPrompt);
            setGenerationMode('video');
            setViewMode('video_production');
            await setModule('creative');
            toast.success('Storyboard loaded into Creative Studio.');
        } finally {
            setIsHandoffLoading(false);
        }
    };

    // Simulate AI generation of next scene
    const generateNextScene = () => {
        setIsGenerating(true);
        setTimeout(() => {
            const nextNumber = scenes.length + 1;
            const newScene: StoryboardScene = {
                id: Math.random().toString(),
                sceneNumber: nextNumber,
                heading: `INT. RECORDING CABIN - ${nextNumber % 2 === 0 ? 'NIGHT' : 'DAY'}`,
                description: `Close-up on a vintage microphone. Soundwaves visualize as glowing threads in the air. The artist sings with raw emotional intensity.`,
                cameraAngle: 'Macro close-up, shallow depth of field',
                duration: 6,
                veoPrompt: 'Macro shot of a vintage tube microphone, glowing neon soundwave lines floating in air, warm moody lighting, cinema quality.'
            };
            setScenes(prev => [...prev, newScene]);
            setSelectedSceneId(newScene.id);
            setIsGenerating(false);
        }, 1200);
    };

    const deleteScene = (id: string) => {
        setScenes(prev => prev.filter(s => s.id !== id).map((s, idx) => ({ ...s, sceneNumber: idx + 1 })));
        if (selectedSceneId === id) {
            setSelectedSceneId(scenes[0]?.id || '');
        }
    };

    const updateScene = (id: string, updates: Partial<StoryboardScene>) => {
        setScenes(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    };

    const activeScene = scenes.find(s => s.id === selectedSceneId) || scenes[0];

    const totalDuration = scenes.reduce((acc, curr) => acc + curr.duration, 0);

    return (
        <ThreePanelDashboard
            moduleName="Screenwriter"
            headerIcon={<Film size={18} className="text-white" />}
            title="AI Screenwriter & Storyboarder"
            subtitle="Draft scripts, build scene-by-scene storyboards, and sync text-to-video Veo cues"
            bgBlobClass="bg-green-500/10"
            iconBgClass="bg-linear-to-br from-green-500 to-green-400"
            iconShadowClass="shadow-green-500/20"
            leftPanel={
                <div className="flex flex-col gap-4">
                    {/* Script Navigation */}
                    <div className="p-4 rounded-xl border border-white/5 bg-white/2 backdrop-blur-md">
                        <span className="text-[10px] font-black uppercase tracking-wider text-green-400 font-mono block mb-3">Storyboard Scenes</span>
                        <div className="space-y-1 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                            {scenes.map((scene) => (
                                <button
                                    key={scene.id}
                                    onClick={() => setSelectedSceneId(scene.id)}
                                    className={`w-full flex items-center justify-between p-2 rounded text-left transition-colors ${
                                        selectedSceneId === scene.id 
                                        ? 'bg-green-500/20 text-white font-bold border border-green-500/30' 
                                        : 'hover:bg-white/5 text-gray-400 hover:text-white border border-transparent'
                                    }`}
                                >
                                    <div className="truncate flex items-center gap-2">
                                        <span className="font-mono text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-gray-300">SC {scene.sceneNumber}</span>
                                        <span className="text-xs truncate">{scene.heading}</span>
                                    </div>
                                    <span className="text-[10px] font-mono text-gray-500">{scene.duration}s</span>
                                </button>
                            ))}
                        </div>

                        <button 
                            onClick={generateNextScene}
                            disabled={isGenerating}
                            className="w-full flex items-center justify-center gap-1.5 mt-3 py-1.5 border border-dashed border-green-500/30 hover:border-green-500/60 rounded text-xs font-bold text-green-400 hover:text-green-300 transition-colors"
                        >
                            {isGenerating ? <RotateCw size={12} className="animate-spin" /> : <Plus size={12} />}
                            {isGenerating ? 'Drafting with AI...' : 'Draft Next Scene'}
                        </button>
                    </div>

                    {/* Meta Analysis Panel */}
                    <div className="p-4 rounded-xl border border-white/5 bg-white/2 backdrop-blur-md">
                        <span className="text-[10px] font-black uppercase tracking-wider text-green-400 font-mono block mb-2">Metrics Summary</span>
                        <div className="space-y-2 text-xs">
                            <div className="flex justify-between py-1 border-b border-white/[0.02]">
                                <span className="text-gray-400">Total Playtime</span>
                                <span className="font-mono font-bold text-white">{totalDuration} seconds</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-white/[0.02]">
                                <span className="text-gray-400">Total Scenes</span>
                                <span className="font-mono font-bold text-white">{scenes.length} scene boards</span>
                            </div>
                            <div className="flex justify-between py-1">
                                <span className="text-gray-400">Word Count</span>
                                <span className="font-mono font-bold text-white">
                                    {scenes.reduce((acc, curr) => acc + curr.description.split(' ').length, 0)} words
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            }
            rightPanel={
                <div className="flex flex-col gap-4">
                    {/* Creative Sync Setup */}
                    <div className="p-4 rounded-xl border border-white/5 bg-white/2 backdrop-blur-md">
                        <span className="text-[10px] font-black uppercase tracking-wider text-green-400 font-mono block mb-3">AI Prompter Controls</span>
                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] text-gray-400 font-bold block mb-1">STORYBOARD TONE</label>
                                <div className="grid grid-cols-3 gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
                                    {(['cinematic', 'abstract', 'hype'] as const).map((tone) => (
                                        <button
                                            key={tone}
                                            onClick={() => setSelectedTone(tone)}
                                            className={`text-[10px] font-bold py-1 rounded capitalize transition-all ${
                                                selectedTone === tone 
                                                ? 'bg-green-500 text-white shadow' 
                                                : 'text-gray-400 hover:text-white'
                                            }`}
                                        >
                                            {tone}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] text-gray-400 font-bold block mb-1">TARGET GENERATOR</label>
                                <div className="text-xs bg-black/40 px-3 py-2 rounded-lg border border-white/5 font-mono text-gray-300">
                                    Google Veo-3.1-generate-preview
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Export Actions */}
                    <div className="p-4 rounded-xl border border-white/5 bg-white/2 backdrop-blur-md">
                        <span className="text-[10px] font-black uppercase tracking-wider text-green-400 font-mono block mb-3">Creative Handoff</span>
                        <div className="space-y-2">
                            <button 
                                onClick={handleExportScript}
                                disabled={isExporting}
                                className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold bg-white text-black hover:bg-gray-200 rounded-lg transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                <span className="flex items-center gap-1.5"><Download size={12} /> {isExporting ? 'Exporting...' : 'Export Script'}</span>
                            </button>
                            <button 
                                onClick={handleOpenCreativeStudio}
                                disabled={isHandoffLoading}
                                className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold border border-white/10 text-white hover:bg-white/5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                <span className="flex items-center gap-1.5"><Send size={12} /> {isHandoffLoading ? 'Loading...' : 'Open Creative Studio'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            }
        >
            {/* Nav Tabs */}
            <div className="border-b border-white/5 px-6 flex-shrink-0">
                <div className="flex gap-6 h-12">
                    {([
                        { id: 'scriptwriter', label: 'Screenplay Editor', icon: FileText },
                        { id: 'storyboard', label: 'Visual Storyboarder', icon: Video },
                        { id: 'veoprompts', label: 'Veo Video Prompting', icon: Compass }
                    ] as const).map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => setActiveTab(id)}
                            className={`flex items-center gap-2 text-xs font-bold border-b-2 px-1 transition-all ${
                                activeTab === id 
                                ? 'border-green-500 text-white font-black' 
                                : 'border-transparent text-gray-500 hover:text-gray-300'
                            }`}
                        >
                            <Icon size={14} className={activeTab === id ? 'text-green-400' : ''} />
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Editor Workspace */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <AnimatePresence mode="wait">
                    {activeTab === 'scriptwriter' && (
                        <motion.div
                            key="scriptwriter"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            {/* AI Prompt Input Card */}
                            <div className="p-5 rounded-xl border border-white/5 bg-white/1">
                                <h3 className="text-xs font-black uppercase text-green-400 tracking-wider font-mono mb-2 flex items-center gap-1.5">
                                    <Sparkles size={12} /> AI Story Concept Input
                                </h3>
                                <textarea
                                    value={songConcept}
                                    onChange={(e) => setSongConcept(e.target.value)}
                                    placeholder="Write a brief prompt details detailing the song's story theme, imagery, or narrative arc..."
                                    className="w-full min-h-[70px] bg-black/40 border border-white/10 rounded-lg p-3 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-green-500 mb-3"
                                />
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-gray-500 font-mono">Dynamic contextual generation utilizes Gemini-3-pro-preview</span>
                                    <button 
                                        onClick={generateNextScene}
                                        disabled={isGenerating}
                                        className="px-4 py-1.5 bg-green-500 hover:bg-green-400 text-white font-black text-xs rounded transition-all flex items-center gap-1"
                                    >
                                        {isGenerating ? <RotateCw size={12} className="animate-spin" /> : <Sparkles size={12} />} Expand Script
                                    </button>
                                </div>
                            </div>

                            {/* Screenplay preview */}
                            <div className="p-8 rounded-xl border border-white/5 bg-white/2 max-w-3xl mx-auto shadow-inner text-gray-100 select-text">
                                <div className="text-center border-b border-white/5 pb-4 mb-6">
                                    <h2 className="text-xl font-bold uppercase tracking-widest font-mono">NEON STREETREFLECTIONS</h2>
                                    <p className="text-[10px] text-gray-500 font-mono mt-1">A Screenplay storyboard draft for music video release</p>
                                </div>

                                <div className="space-y-6 font-mono text-xs leading-relaxed max-w-2xl mx-auto">
                                    {scenes.map((scene) => (
                                        <div 
                                            key={scene.id} 
                                            onClick={() => setSelectedSceneId(scene.id)}
                                            className={`p-3 rounded-lg border transition-all cursor-pointer ${
                                                selectedSceneId === scene.id 
                                                ? 'border-green-500/40 bg-green-500/[0.03]' 
                                                : 'border-transparent hover:border-white/5 hover:bg-white/[0.01]'
                                            }`}
                                        >
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="font-bold text-gray-200">{scene.heading}</span>
                                                <span className="text-[9px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20 uppercase">SCENE {scene.sceneNumber}</span>
                                            </div>
                                            <p className="text-gray-400 mb-2 pl-4 border-l border-white/5 italic">{scene.description}</p>
                                            <div className="text-right text-[10px] text-gray-500 font-bold">
                                                CAMERA: {scene.cameraAngle} ({scene.duration}s)
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'storyboard' && activeScene && (
                        <motion.div
                            key="storyboard"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Visual Panel Frame */}
                                <div className="p-5 rounded-xl border border-white/5 bg-white/1 flex flex-col justify-between h-80 relative overflow-hidden">
                                    <div className="absolute inset-0 bg-linear-to-b from-green-900/10 to-black pointer-events-none" />
                                    
                                    {/* Mock Visual representation */}
                                    <div className="relative z-10 flex-1 flex flex-col justify-center items-center text-center p-4">
                                        <Film size={40} className="text-green-400/50 mb-3 animate-pulse" />
                                        <span className="text-[10px] font-black uppercase text-green-400 tracking-widest font-mono">SCENE {activeScene.sceneNumber} SHOT MATRIX</span>
                                        <p className="text-xs text-gray-400 mt-2 max-w-xs">{activeScene.cameraAngle}</p>
                                    </div>

                                    <div className="relative z-10 p-3 bg-black/60 rounded border border-white/5 flex justify-between items-center text-[10px] font-mono">
                                        <span className="text-gray-400">TIMING: {activeScene.duration}s duration</span>
                                        <span className="text-green-400 font-bold">ASPECT: 16:9 Cinema</span>
                                    </div>
                                </div>

                                {/* Active Scene Details editor */}
                                <div className="p-5 rounded-xl border border-white/5 bg-white/1 space-y-4">
                                    <h4 className="text-sm font-black uppercase text-white">Edit Scene Board</h4>
                                    
                                    <div>
                                        <label className="text-[10px] text-gray-400 font-bold block mb-1">SCENE HEADING</label>
                                        <input
                                            type="text"
                                            value={activeScene.heading}
                                            onChange={(e) => updateScene(activeScene.id, { heading: e.target.value })}
                                            className="w-full bg-black border border-white/10 rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-green-500 font-mono"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[10px] text-gray-400 font-bold block mb-1">NARRATIVE ACTION DESCRIPTION</label>
                                        <textarea
                                            value={activeScene.description}
                                            onChange={(e) => updateScene(activeScene.id, { description: e.target.value })}
                                            className="w-full min-h-[80px] bg-black border border-white/10 rounded p-3 text-xs text-gray-200 focus:outline-none focus:border-green-500"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] text-gray-400 font-bold block mb-1">CAMERA ANGLE</label>
                                            <input
                                                type="text"
                                                value={activeScene.cameraAngle}
                                                onChange={(e) => updateScene(activeScene.id, { cameraAngle: e.target.value })}
                                                className="w-full bg-black border border-white/10 rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-green-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-gray-400 font-bold block mb-1">DURATION (SEC)</label>
                                            <input
                                                type="number"
                                                value={activeScene.duration}
                                                onChange={(e) => updateScene(activeScene.id, { duration: Number(e.target.value) })}
                                                className="w-full bg-black border border-white/10 rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-green-500 font-mono"
                                            />
                                        </div>
                                    </div>

                                    <div className="text-right pt-2 border-t border-white/5">
                                        <button 
                                            onClick={() => deleteScene(activeScene.id)}
                                            className="inline-flex items-center gap-1.5 text-[10px] font-bold text-red-400 hover:text-red-300 transition-colors"
                                        >
                                            <Trash2 size={12} /> Remove Scene board
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'veoprompts' && activeScene && (
                        <motion.div
                            key="veoprompts"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            <div className="p-5 rounded-xl border border-white/5 bg-white/1">
                                <h3 className="text-sm font-black uppercase text-white mb-2">Google Veo Video Prompt compiler</h3>
                                <p className="text-xs text-gray-400 mb-6">Modify text-to-video instructions synced specifically to Scene {activeScene.sceneNumber}. Output directly exports to generative pipelines.</p>
                                
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] text-gray-400 font-bold block mb-1">VEO MAIN PROMPT STRETCH</label>
                                        <textarea
                                            value={activeScene.veoPrompt}
                                            onChange={(e) => updateScene(activeScene.id, { veoPrompt: e.target.value })}
                                            className="w-full min-h-[80px] bg-black border border-white/10 rounded p-3 text-xs text-gray-200 focus:outline-none focus:border-green-500 font-mono"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="p-3 bg-black/40 border border-white/5 rounded-lg">
                                            <label className="text-[9px] font-mono text-gray-500 block mb-1">FPS FRAMERATE</label>
                                            <span className="text-xs font-mono font-bold text-gray-200">24 frames per second</span>
                                        </div>
                                        <div className="p-3 bg-black/40 border border-white/5 rounded-lg">
                                            <label className="text-[9px] font-mono text-gray-500 block mb-1">RESOLUTION ASPECT</label>
                                            <span className="text-xs font-mono font-bold text-gray-200">1920 x 1080 (Cinema Landscape)</span>
                                        </div>
                                        <div className="p-3 bg-black/40 border border-white/5 rounded-lg">
                                            <label className="text-[9px] font-mono text-gray-500 block mb-1">VIDEO SEED TARGET</label>
                                            <span className="text-xs font-mono font-bold text-gray-200">RANDOM (Auto rotate)</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </ThreePanelDashboard>
    );
}
