import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ThreePanelDashboard } from '@/components/layout/ThreePanelDashboard';
import {
    FileText, Video, Sparkles, Plus, Trash2, Download, Send, Film, Compass
} from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { getStoryboardTimingError, isValidStoryboardSceneDuration, MAX_STORYBOARD_SCENE_SECONDS } from './screenwriterTiming';
import {
    screenwriterDraftService,
    ScreenwriterDraftConflictError,
    type PersistedScreenwriterDraft,
    type ScreenwriterDraftPayload,
} from '@/services/screenwriter/ScreenwriterDraftService';
import { useVideoEditorStore } from '@/modules/creative/video/store/videoEditorStore';
import type { ScreenwriterStoryboardHandoff } from '@/types/handoff';

export interface StoryboardScene {
    id: string;
    sceneNumber: number;
    heading: string;
    description: string;
    cameraAngle: string;
    duration: number; // in seconds
    veoPrompt: string;
}

export interface ScreenwriterDraft {
    activeTab: 'scriptwriter' | 'storyboard' | 'veoprompts';
    songConcept: string;
    selectedTone: 'cinematic' | 'abstract' | 'hype';
    scenes: StoryboardScene[];
    selectedSceneId: string;
}

interface DraftLoadResult {
    draft: ScreenwriterDraft;
    timingRepairs: Record<string, string>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function screenwriterDraftStorageKey(userId: string, projectId: string): string {
    return `indii-screenwriter-draft-v2:${userId}:${projectId}`;
}

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

function isStoryboardSceneShape(value: unknown): value is Omit<StoryboardScene, 'duration'> & { duration?: unknown } {
    if (!value || typeof value !== 'object') return false;
    const scene = value as StoryboardScene;
    return (
        typeof scene.id === 'string' &&
        typeof scene.sceneNumber === 'number' &&
        typeof scene.heading === 'string' &&
        typeof scene.description === 'string' &&
        typeof scene.cameraAngle === 'string' &&
        typeof scene.veoPrompt === 'string'
    );
}

function normalizeDraft(value: unknown): DraftLoadResult {
    const fallback = createDefaultDraft();
    if (!value || typeof value !== 'object') return { draft: fallback, timingRepairs: {} };

    const draft = value as Partial<ScreenwriterDraft>;
    const timingRepairs: Record<string, string> = {};
    const scenes = Array.isArray(draft.scenes)
        ? draft.scenes.filter(isStoryboardSceneShape).map((scene, index) => {
            const duration = Number(scene.duration);
            if (!isValidStoryboardSceneDuration(duration)) {
                timingRepairs[scene.id] = scene.duration == null ? '' : String(scene.duration);
            }
            return {
                ...scene,
                duration: isValidStoryboardSceneDuration(duration) ? duration : 5,
                sceneNumber: index + 1,
            };
        })
        : fallback.scenes;

    return { draft: {
        activeTab: draft.activeTab === 'storyboard' || draft.activeTab === 'veoprompts' ? draft.activeTab : 'scriptwriter',
        songConcept: typeof draft.songConcept === 'string' && draft.songConcept.trim() ? draft.songConcept : fallback.songConcept,
        selectedTone: draft.selectedTone === 'abstract' || draft.selectedTone === 'hype' ? draft.selectedTone : 'cinematic',
        scenes: scenes.length > 0 ? scenes : fallback.scenes,
        selectedSceneId: typeof draft.selectedSceneId === 'string' && scenes.some(scene => scene.id === draft.selectedSceneId)
            ? draft.selectedSceneId
            : (scenes[0]?.id ?? fallback.selectedSceneId),
    }, timingRepairs };
}

function loadDraft(storageKey: string | null): DraftLoadResult {
    if (typeof window === 'undefined') return { draft: createDefaultDraft(), timingRepairs: {} };
    if (!storageKey) return { draft: createDefaultDraft(), timingRepairs: {} };

    try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) return { draft: createDefaultDraft(), timingRepairs: {} };
        return normalizeDraft(JSON.parse(raw));
    } catch {
        return { draft: createDefaultDraft(), timingRepairs: {} };
    }
}

function saveDraft(storageKey: string | null, draft: ScreenwriterDraft): void {
    if (typeof window === 'undefined') return;
    if (!storageKey) return;

    try {
        window.localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {
        // Ignore storage quota / private browsing failures.
    }
}

export default function ScreenwriterDashboard() {
    const draftScope = useStore(useShallow(state => {
        const userId = state.userProfile?.id;
        const projectId = state.currentProjectId;
        return userId && projectId ? { userId, projectId, storageKey: screenwriterDraftStorageKey(userId, projectId) } : null;
    }));
    const storageKey = draftScope?.storageKey ?? null;
    const [initialLoad] = useState<DraftLoadResult>(() => loadDraft(storageKey));
    const initialDraft = initialLoad.draft;
    const [activeTab, setActiveTab] = useState<ScreenwriterDraft['activeTab']>(initialDraft.activeTab);
    const toast = useToast();
    const { setModule, setGenerationMode, setViewMode } = useStore(useShallow(state => ({
        setModule: state.setModule,
        setGenerationMode: state.setGenerationMode,
        setViewMode: state.setViewMode,
    })));
    const [isExporting, setIsExporting] = useState(false);
    const [isHandoffLoading, setIsHandoffLoading] = useState(false);
    
    // Default Script Mood & Song Outline
    const [songConcept, setSongConcept] = useState(initialDraft.songConcept);
    const [selectedTone, setSelectedTone] = useState<ScreenwriterDraft['selectedTone']>(initialDraft.selectedTone);

    // Manage scenes
    const [scenes, setScenes] = useState<StoryboardScene[]>(initialDraft.scenes);

    const [selectedSceneId, setSelectedSceneId] = useState<string>(initialDraft.selectedSceneId);
    const [timingRepairs, setTimingRepairs] = useState<Record<string, string>>(initialLoad.timingRepairs);
    const [hydratedKey, setHydratedKey] = useState(storageKey);
    const [cloudRevision, setCloudRevision] = useState<number | null>(null);
    const [cloudHydratedKey, setCloudHydratedKey] = useState<string | null>(null);
    const [draftConflict, setDraftConflict] = useState<PersistedScreenwriterDraft | null>(null);
    const lastSyncedPayload = useRef<string | null>(null);
    const lastScopedStorageKey = useRef<string | null>(storageKey);

    useEffect(() => {
        if (!draftScope && lastScopedStorageKey.current && typeof window !== 'undefined') {
            window.localStorage.removeItem(lastScopedStorageKey.current);
            lastScopedStorageKey.current = null;
        }
        if (storageKey) lastScopedStorageKey.current = storageKey;
        const loaded = loadDraft(storageKey);
        setActiveTab(loaded.draft.activeTab); setSongConcept(loaded.draft.songConcept); setSelectedTone(loaded.draft.selectedTone);
        setScenes(loaded.draft.scenes); setSelectedSceneId(loaded.draft.selectedSceneId); setTimingRepairs(loaded.timingRepairs);
        setHydratedKey(storageKey);
        setCloudRevision(null);
        setCloudHydratedKey(null);
        setDraftConflict(null);
        lastSyncedPayload.current = null;
        if (!draftScope) return;

        let cancelled = false;
        void screenwriterDraftService.load(draftScope.userId, draftScope.projectId)
            .then(remote => {
                if (cancelled || !remote) return;
                const normalized = normalizeDraft(remote.payload);
                setActiveTab(normalized.draft.activeTab); setSongConcept(normalized.draft.songConcept); setSelectedTone(normalized.draft.selectedTone);
                setScenes(normalized.draft.scenes); setSelectedSceneId(normalized.draft.selectedSceneId); setTimingRepairs(normalized.timingRepairs);
                saveDraft(storageKey, normalized.draft);
                setCloudRevision(remote.revision);
                lastSyncedPayload.current = JSON.stringify(normalized.draft);
            })
            .catch(() => {
                // Local persistence is the explicit offline fallback.
            })
            .finally(() => {
                if (!cancelled) setCloudHydratedKey(storageKey);
            });
        return () => { cancelled = true; };
    }, [storageKey, draftScope]);

    useEffect(() => {
        if (hydratedKey !== storageKey) return;
        if (Object.keys(timingRepairs).length > 0 || getStoryboardTimingError(scenes.map((scene) => scene.duration))) return;
        saveDraft(storageKey, {
            activeTab,
            songConcept,
            selectedTone,
            scenes,
            selectedSceneId,
        });
    }, [activeTab, songConcept, selectedTone, scenes, selectedSceneId, timingRepairs, storageKey, hydratedKey]);

    useEffect(() => {
        if (!draftScope || hydratedKey !== storageKey || cloudHydratedKey !== storageKey) return;
        if (Object.keys(timingRepairs).length > 0 || getStoryboardTimingError(scenes.map(scene => scene.duration))) return;
        const payload: ScreenwriterDraftPayload = { activeTab, songConcept, selectedTone, scenes, selectedSceneId };
        const payloadSignature = JSON.stringify(payload);
        if (lastSyncedPayload.current === payloadSignature) return;
        const timeout = window.setTimeout(() => {
            void screenwriterDraftService.save(draftScope.userId, draftScope.projectId, payload, cloudRevision)
                .then(revision => { lastSyncedPayload.current = payloadSignature; setCloudRevision(revision); })
                .catch(error => {
                    if (error instanceof ScreenwriterDraftConflictError) setDraftConflict(error.current);
                });
        }, 750);
        return () => window.clearTimeout(timeout);
    }, [activeTab, cloudHydratedKey, cloudRevision, draftScope, hydratedKey, scenes, selectedSceneId, selectedTone, songConcept, storageKey, timingRepairs]);

    const useCloudDraft = () => {
        if (!draftConflict) return;
        const normalized = normalizeDraft(draftConflict.payload);
        setActiveTab(normalized.draft.activeTab); setSongConcept(normalized.draft.songConcept); setSelectedTone(normalized.draft.selectedTone);
        setScenes(normalized.draft.scenes); setSelectedSceneId(normalized.draft.selectedSceneId); setTimingRepairs(normalized.timingRepairs);
        setCloudRevision(draftConflict.revision);
        lastSyncedPayload.current = JSON.stringify(normalized.draft);
        setDraftConflict(null);
    };

    const keepLocalDraft = () => {
        if (!draftScope || !draftConflict) return;
        const payload: ScreenwriterDraftPayload = { activeTab, songConcept, selectedTone, scenes, selectedSceneId };
        void screenwriterDraftService.save(draftScope.userId, draftScope.projectId, payload, draftConflict.revision)
            .then(revision => { lastSyncedPayload.current = JSON.stringify(payload); setCloudRevision(revision); setDraftConflict(null); })
            .catch(error => {
                if (error instanceof ScreenwriterDraftConflictError) setDraftConflict(error.current);
                else toast.error('Could not keep this draft. Your local copy is still safe on this device.');
            });
    };

    const getCurrentTimingError = () => {
        const repairSceneId = Object.keys(timingRepairs)[0];
        if (repairSceneId) {
            const sceneNumber = scenes.find((scene) => scene.id === repairSceneId)?.sceneNumber ?? 1;
            return `Scene ${sceneNumber} has an invalid saved duration. Correct it before continuing.`;
        }
        return getStoryboardTimingError(scenes.map((scene) => scene.duration));
    };

    const buildTimingManifest = () => ({
        totalDurationSeconds: scenes.reduce((sum, scene) => sum + scene.duration, 0),
        scenes: scenes.map((scene) => ({
            sceneNumber: scene.sceneNumber,
            durationSeconds: scene.duration,
        })),
    });

    const buildStoryboardArtifact = () => {
        const timingManifest = buildTimingManifest();
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
            '## Timing Manifest',
            '```json',
            JSON.stringify(timingManifest, null, 2),
            '```',
            '',
            `## Scene List`,
            sceneSections,
        ].join('\n');
    };

    const handleExportScript = async () => {
        const timingError = getCurrentTimingError();
        if (timingError) {
            toast.error(timingError);
            return;
        }
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
        const timingError = getCurrentTimingError();
        if (timingError) {
            toast.error(timingError);
            return;
        }
        setIsHandoffLoading(true);
        try {
            const projectId = draftScope?.projectId ?? 'unscoped';
            const handoff: ScreenwriterStoryboardHandoff = {
                projectId,
                name: `${songConcept.trim().slice(0, 60) || 'Untitled'} Storyboard`,
                concept: songConcept,
                tone: selectedTone,
                timestamp: Date.now(),
                scenes: scenes.map(scene => ({
                    id: scene.id,
                    sceneNumber: scene.sceneNumber,
                    heading: scene.heading,
                    description: scene.description,
                    cameraAngle: scene.cameraAngle,
                    durationSeconds: scene.duration,
                    prompt: scene.veoPrompt,
                })),
            };

            useVideoEditorStore.getState().receiveStoryboardHandoff(handoff);
            setGenerationMode('video');
            setViewMode('video_production');
            await setModule('creative');
            toast.success(`${scenes.length} storyboard scenes opened in Creative Studio.`);
        } finally {
            setIsHandoffLoading(false);
        }
    };

    const addBlankScene = () => {
        const nextNumber = scenes.length + 1;
        const newScene: StoryboardScene = {
            id: globalThis.crypto?.randomUUID?.() ?? `scene-${Date.now()}-${nextNumber}`,
            sceneNumber: nextNumber,
            heading: 'UNTITLED SCENE',
            description: '',
            cameraAngle: '',
            duration: 5,
            veoPrompt: '',
        };
        setScenes(prev => [...prev, newScene]);
        setSelectedSceneId(newScene.id);
        setActiveTab('storyboard');
    };

    const deleteScene = (id: string) => {
        setScenes(prev => prev.filter(s => s.id !== id).map((s, idx) => ({ ...s, sceneNumber: idx + 1 })));
        setTimingRepairs(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
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
            title="Screenwriter & Storyboard Planner"
            subtitle="Draft scripts, edit scene plans, and open structured video storyboards in Creative Studio"
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
                            onClick={addBlankScene}
                            className="w-full flex items-center justify-center gap-1.5 mt-3 py-1.5 border border-dashed border-green-500/30 hover:border-green-500/60 rounded text-xs font-bold text-green-400 hover:text-green-300 transition-colors"
                        >
                            <Plus size={12} />
                            Add Blank Scene
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
                        <span className="text-[10px] font-black uppercase tracking-wider text-green-400 font-mono block mb-3">Storyboard Controls</span>
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
                                    Creative Studio video storyboard
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
                {draftConflict && (
                    <div role="alert" className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100">
                        This draft changed on another device. Choose which version to keep before the next sync.
                        <div className="mt-2 flex gap-2">
                            <button onClick={useCloudDraft} className="rounded bg-white/10 px-2 py-1 font-bold hover:bg-white/20">Load cloud draft</button>
                            <button onClick={keepLocalDraft} className="rounded bg-amber-500/20 px-2 py-1 font-bold hover:bg-amber-500/30">Keep this device’s draft</button>
                        </div>
                    </div>
                )}
                {Object.keys(timingRepairs).length > 0 && (
                    <div role="alert" className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
                        A saved scene contains an invalid duration. Its original value is preserved below; correct it before this draft can be saved, exported, or sent to Creative Studio.
                    </div>
                )}
                <AnimatePresence mode="wait">
                    {activeTab === 'scriptwriter' && (
                        <motion.div
                            key="scriptwriter"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            {/* Story concept input */}
                            <div className="p-5 rounded-xl border border-white/5 bg-white/1">
                                <h3 className="text-xs font-black uppercase text-green-400 tracking-wider font-mono mb-2 flex items-center gap-1.5">
                                    <Sparkles size={12} /> Story Concept Input
                                </h3>
                                <textarea
                                    value={songConcept}
                                    onChange={(e) => setSongConcept(e.target.value)}
                                    placeholder="Write a brief prompt details detailing the song's story theme, imagery, or narrative arc..."
                                    className="w-full min-h-[70px] bg-black/40 border border-white/10 rounded-lg p-3 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-green-500 mb-3"
                                />
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-gray-500 font-mono">Manual scene editing is available; AI expansion is not connected.</span>
                                    <button
                                        disabled
                                        title="AI scene expansion is not connected"
                                        className="px-4 py-1.5 bg-gray-700 text-gray-400 font-black text-xs rounded flex items-center gap-1 cursor-not-allowed"
                                    >
                                        <Sparkles size={12} /> AI Expansion Unavailable
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
                                                value={timingRepairs[activeScene.id] ?? activeScene.duration}
                                                min={1}
                                                max={MAX_STORYBOARD_SCENE_SECONDS}
                                                step={1}
                                                onChange={(e) => {
                                                    const duration = Number(e.target.value);
                                                    if (!isValidStoryboardSceneDuration(duration)) {
                                                        if (timingRepairs[activeScene.id] === undefined) {
                                                            e.currentTarget.value = String(activeScene.duration);
                                                        } else {
                                                            setTimingRepairs(prev => ({ ...prev, [activeScene.id]: e.target.value }));
                                                        }
                                                        toast.error(`Scene duration must be a whole number between 1 and ${MAX_STORYBOARD_SCENE_SECONDS} seconds.`);
                                                        return;
                                                    }
                                                    updateScene(activeScene.id, { duration });
                                                    setTimingRepairs(prev => {
                                                        const next = { ...prev };
                                                        delete next[activeScene.id];
                                                        return next;
                                                    });
                                                }}
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
