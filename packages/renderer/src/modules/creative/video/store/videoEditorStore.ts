import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { MembershipService, MembershipTier } from '@/services/MembershipService';
import type { ExtendedVideoProject, SceneSegment } from '@/services/video/SceneExtensionService';
import type { MasterAudioReference } from '@/services/metadata/types';
import { logger } from '@/utils/logger';
import type { StoryboardProject, StoryboardSlot } from '../schemas/storyboard';
import type { ScreenwriterStoryboardHandoff } from '@/types/handoff';

/**
 * MIG-001: The canonical project model lives in @indii/shared (`IndiiVideoProject`).
 * The names below are renderer-facing compatibility aliases — indii owns the model,
 * engines adapt to it. Do NOT add engine-specific fields here; extend the shared type.
 */
import type {
    IndiiVideoClip,
    IndiiVideoProject,
    IndiiVideoTrack,
} from '@indii/shared';

export type ClipType = IndiiVideoClip['type'];

/** Immutable audio identity sent to the render backend; preview URLs are not authority. */
export type CanonicalMasterRenderReference = Pick<
    MasterAudioReference,
    'contentHash' | 'generation' | 'masterFingerprint' | 'storagePath'
> & { volume: number };

// Structural twin of CanonicalMasterRenderReference lives in @indii/shared
// (`canonicalMaster` field). This compile-time check fails if the two drift apart.
type _CanonicalMasterRefInSync = [IndiiVideoClip['canonicalMaster']] extends [
    CanonicalMasterRenderReference | undefined,
]
    ? true
    : never;
const _CANONICAL_MASTER_REF_IN_SYNC: _CanonicalMasterRefInSync = true;
void _CANONICAL_MASTER_REF_IN_SYNC;

export type VideoClip = IndiiVideoClip;

export type VideoTrack = IndiiVideoTrack;

export type VideoProject = IndiiVideoProject;

interface VideoEditorState {
    project: VideoProject;
    currentTime: number;
    isPlaying: boolean;
    selectedClipId: string | null;

    // Actions
    setProject: (project: VideoProject) => void;
    updateProjectSettings: (settings: Partial<VideoProject>) => void;
    setCurrentTime: (time: number) => void;
    setIsPlaying: (isPlaying: boolean) => void;
    setSelectedClipId: (id: string | null) => void;

    // Undo/redo history (in-memory; capped)
    past: VideoProject[];
    future: VideoProject[];
    undo: () => void;
    redo: () => void;

    // Loop-region playback
    loopRegion: { a: number; b: number } | null;
    setLoopIn: () => void;
    setLoopOut: () => void;
    clearLoop: () => void;

    addTrack: (type: VideoTrack['type']) => void;
    removeTrack: (id: string) => void;

    addClip: (clip: Omit<VideoClip, 'id'>) => void;
    updateClip: (id: string, updates: Partial<VideoClip>) => void;
    removeClip: (id: string) => void;
    /** Delete + close the gap: later clips on the same track slide left. */
    rippleDeleteClip: (id: string) => void;
    /** Razor: cut a clip at a frame; source trims (µs) shift with the split. */
    splitClip: (id: string, atFrame: number) => void;
    /** Copy a clip right after itself on the same track. */
    duplicateClip: (id: string) => void;
    addKeyframe: (clipId: string, property: string, frame: number, value: number) => void;
    removeKeyframe: (clipId: string, property: string, frame: number) => void;
    updateKeyframe: (clipId: string, property: string, frame: number, updates: Partial<{ value: number, easing: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' }>) => void;

    // Job Tracking
    jobId: string | null;
    status: 'idle' | 'queued' | 'processing' | 'stitching' | 'completed' | 'failed' | 'cancelled';
    progress: number;
    setJobId: (id: string | null) => void;
    setStatus: (status: 'idle' | 'queued' | 'processing' | 'stitching' | 'completed' | 'failed' | 'cancelled') => void;
    setProgress: (progress: number) => void;

    // Membership
    membershipTier: MembershipTier;
    setMembershipTier: (tier: MembershipTier) => void;
    getMaxDurationFrames: () => number;

    // Scene Extension (60s+ videos)
    extendedProject: ExtendedVideoProject | null;
    setExtendedProject: (project: ExtendedVideoProject | null) => void;
    updateExtendedSegment: (segmentId: string, updates: Partial<SceneSegment>) => void;

    // Veo 3.1 Enhanced Options
    referenceImages: { mimeType: string; data: string }[];
    setReferenceImages: (images: { mimeType: string; data: string }[]) => void;
    addReferenceImage: (image: { mimeType: string; data: string }) => void;
    removeReferenceImage: (index: number) => void;
    generateAudio: boolean;
    setGenerateAudio: (enabled: boolean) => void;
    inputAudio: string | null;
    setInputAudio: (url: string | null) => void;

    // Timeline Zoom (P1)
    timelineZoom: number;
    setTimelineZoom: (zoom: number) => void;

    // View Mode (Director vs Editor vs Visualizer vs Storyboard)
    viewMode: 'director' | 'editor' | 'visualizer' | 'storyboard';
    setViewMode: (mode: 'director' | 'editor' | 'visualizer' | 'storyboard') => void;

    // Storyboard Timeline
    storyboardProject: StoryboardProject | null;
    setStoryboardProject: (project: StoryboardProject | null) => void;
    updateStoryboardSlot: (slotId: string, updates: Partial<StoryboardSlot>) => void;
    generateStoryboardSlots: (bpm: number, durationSeconds: number) => void;
    receiveStoryboardHandoff: (handoff: ScreenwriterStoryboardHandoff) => void;

    // Popout Viewer State
    isPopoutActive: boolean;
    setIsPopoutActive: (active: boolean) => void;

    /** Rendered artifact (indii pipeline output) backing the preview surfaces. */
    previewArtifactUrl: string | null;
    setPreviewArtifactUrl: (url: string | null) => void;

    // Persistence (ISSUE-1147)
    isLoadingProject: boolean;
    resetProjectForId: (projectId: string) => void;
    loadProjectFromDoc: (project: VideoProject) => void;
    setIsLoadingProject: (loading: boolean) => void;

    // Persistence failure surfaces (ISSUE-1195). A failed load or save used to be
    // a `logger.warn` and nothing else, which is how a user discovers their work
    // is not being saved only after losing it.
    projectLoadError: string | null;
    projectSaveError: string | null;
    setProjectLoadError: (message: string | null) => void;
    setProjectSaveError: (message: string | null) => void;

    // ISSUE-1194: true when the signed-in session can never persist a timeline
    // (guest/anonymous). Firestore's `isAuthenticated()` excludes anonymous, so
    // every write is denied at the rules layer. The editor is still reachable, so
    // the user must be told up front rather than discovering it on reload.
    isEphemeralSession: boolean;
    setIsEphemeralSession: (ephemeral: boolean) => void;
}

export const INITIAL_PROJECT: VideoProject = {
    id: 'default-project',
    name: 'My Video Project',
    fps: 30,
    durationInFrames: 30 * 10, // 10 seconds default
    width: 1920,
    height: 1080,
    tracks: [
        { id: 'track-1', name: 'Main Video', type: 'video' },
        { id: 'track-2', name: 'Text Overlay', type: 'text' },
        { id: 'track-3', name: 'Background Music', type: 'audio' },
    ],
    // Production projects deliberately start empty. Sample content must be an
    // explicit template choice, never an exportable default.
    clips: []
};

// ISSUE-1147: a fresh, empty timeline stamped with the requesting app-project's
// ID — used when opening a project that has no persisted video-editor doc yet.
// Never reused across two different project IDs (that was the isolation bug).
export const blankProjectForId = (projectId: string): VideoProject => ({
    ...INITIAL_PROJECT,
    id: projectId,
    tracks: INITIAL_PROJECT.tracks.map(t => ({ ...t })),
    clips: [],
});

export function compileScreenwriterStoryboardHandoff(
    handoff: ScreenwriterStoryboardHandoff,
): StoryboardProject {
    const bpm = 120;
    const secondsPerBar = 4 * (60 / bpm);
    let elapsedSeconds = 0;
    const slots: StoryboardSlot[] = handoff.scenes.map((scene) => {
        const startSeconds = elapsedSeconds;
        elapsedSeconds += scene.durationSeconds;
        return {
            id: scene.id,
            barIndex: Math.floor(startSeconds / secondsPerBar),
            startBar: Math.floor(startSeconds / secondsPerBar),
            durationBars: Math.max(1, Math.ceil(scene.durationSeconds / secondsPerBar)),
            startSeconds,
            durationSeconds: scene.durationSeconds,
            sourceSceneNumber: scene.sceneNumber,
            heading: scene.heading,
            description: scene.description,
            cameraAngle: scene.cameraAngle,
            prompt: scene.prompt,
            isGenerating: false,
            progress: 0,
            useVocalSync: false,
            useDaisyChain: true,
        };
    });

    return {
        id: `screenwriter-${handoff.projectId}-${handoff.timestamp}`,
        name: handoff.name,
        bpm,
        durationSeconds: elapsedSeconds,
        source: 'screenwriter',
        concept: handoff.concept,
        tone: handoff.tone,
        slots,
    };
}

const isSafeDimension = (value: number) => Number.isInteger(value) && value >= 64 && value <= 8192;
const isSafeFps = (value: number) => Number.isInteger(value) && value >= 1 && value <= 120;
const sanitizeProjectSettings = (candidate: Partial<VideoProject>, _fallback: VideoProject): Partial<VideoProject> => {
    const safe = { ...candidate };
    if (safe.width !== undefined && !isSafeDimension(safe.width)) delete safe.width;
    if (safe.height !== undefined && !isSafeDimension(safe.height)) delete safe.height;
    if (safe.fps !== undefined && !isSafeFps(safe.fps)) delete safe.fps;
    return safe;
};

// Setup BroadcastChannel for sync to popout window
// Exported so hooks can reuse the same singleton instead of creating fire-and-forget channels.
export let syncChannel: BroadcastChannel | null = null;
let _heartbeatExpiryTimer: ReturnType<typeof setTimeout> | null = null;

// Resets (or starts) the 5-second crash-detection window.
// Called on POPOUT_OPENED and every HEARTBEAT — so the popout is declared dead
// exactly 5 s after the last sign of life, regardless of polling interval.
const resetHeartbeatExpiry = () => {
    if (_heartbeatExpiryTimer) clearTimeout(_heartbeatExpiryTimer);
    _heartbeatExpiryTimer = setTimeout(() => {
        useVideoEditorStore.getState().setIsPopoutActive(false);
        _heartbeatExpiryTimer = null;
    }, 5000);
};

if (typeof window !== 'undefined') {
    syncChannel = new BroadcastChannel('indii-video-editor-sync');
    syncChannel.onmessage = (event) => {
        if (event.data?.type === 'POPOUT_OPENED') {
            useVideoEditorStore.getState().setIsPopoutActive(true);
            resetHeartbeatExpiry();
            // Give it the latest state immediately
            syncChannel?.postMessage({
                type: 'SYNC_PROJECT',
                project: useVideoEditorStore.getState().project,
                artifactUrl: useVideoEditorStore.getState().previewArtifactUrl,
            });
        } else if (event.data?.type === 'POPOUT_CLOSED') {
            useVideoEditorStore.getState().setIsPopoutActive(false);
            if (_heartbeatExpiryTimer) {
                clearTimeout(_heartbeatExpiryTimer);
                _heartbeatExpiryTimer = null;
            }
        } else if (event.data?.type === 'HEARTBEAT') {
            resetHeartbeatExpiry();
        }
    };
}

const HISTORY_LIMIT = 50;
/** True while undo/redo is applying a snapshot — that change must not re-record itself. */
let _restoring = false;

export const useVideoEditorStore = create<VideoEditorState>((_set, get) => {
    // Custom set wrapper to broadcast project sync
    const set: typeof _set = (partial, replace) => {
        const before = get();
        const safeSet = _set as unknown as (p: unknown, r?: boolean) => void;
        safeSet(partial, replace);
        let state = get();
        // Every user edit lands in the undo history (capped); a new edit
        // clears the redo stack. Undo/redo applications are exempt.
        if (state.project !== before.project && !_restoring) {
            safeSet({
                past: [...before.past, before.project].slice(-HISTORY_LIMIT),
                future: [],
            }, false);
            state = get();
        }
        // A rendered artifact represents one exact project snapshot. Any
        // timeline mutation invalidates it so preview can never silently show
        // stale pixels for the newly edited project.
        if (state.project !== before.project && state.previewArtifactUrl !== null) {
            safeSet({ previewArtifactUrl: null }, false);
            state = get();
        }
        // After setting, if project was updated, sync it out.
        // Zustand batches updates but we can grab the latest.
        if (syncChannel && window.location.pathname !== '/video-popout') {
            syncChannel.postMessage({
                type: 'SYNC_PROJECT',
                project: state.project,
                artifactUrl: state.previewArtifactUrl,
            });
        }
    };

    return {
        project: INITIAL_PROJECT,
        currentTime: 0,
        loopRegion: null,
        isPlaying: false,
        selectedClipId: null,
        past: [],
        future: [],
        undo: () => {
            const state = get();
            if (state.past.length === 0) return;
            _restoring = true;
            try {
                set({
                    project: state.past[state.past.length - 1],
                    past: state.past.slice(0, -1),
                    future: [...state.future, state.project],
                });
            } finally {
                _restoring = false;
            }
        },
        redo: () => {
            const state = get();
            if (state.future.length === 0) return;
            _restoring = true;
            try {
                set({
                    project: state.future[state.future.length - 1],
                    future: state.future.slice(0, -1),
                    past: [...state.past, state.project].slice(-HISTORY_LIMIT),
                });
            } finally {
                _restoring = false;
            }
        },
        jobId: null,
        status: 'idle',
        progress: 0,
        membershipTier: 'free',
        extendedProject: null,
        referenceImages: [],
        generateAudio: true,
        inputAudio: null,
        setInputAudio: (url) => set({ inputAudio: url }),
        timelineZoom: 1,

        viewMode: 'director',
        setViewMode: (mode) => set({ viewMode: mode }),

        storyboardProject: null,
        setStoryboardProject: (project: StoryboardProject | null) => set({ storyboardProject: project }),
        updateStoryboardSlot: (slotId: string, updates: Partial<StoryboardSlot>) => set((state: VideoEditorState) => {
            if (!state.storyboardProject) return {};
            return {
                storyboardProject: {
                    ...state.storyboardProject,
                    slots: state.storyboardProject.slots.map((s: StoryboardSlot) =>
                        s.id === slotId ? { ...s, ...updates } : s
                    )
                }
            };
        }),
        generateStoryboardSlots: (bpm: number, durationSeconds: number) => set((state: VideoEditorState) => {
            const barDuration = 4 * (60 / bpm); // 4 beats per bar
            const slotDuration = 4 * barDuration; // 4 bars per slot
            const numSlots = Math.ceil(durationSeconds / slotDuration);
            
            const slots: StoryboardSlot[] = Array.from({ length: numSlots }).map((_, idx) => ({
                id: uuidv4(),
                barIndex: idx,
                startBar: idx * 4,
                durationBars: 4,
                prompt: '',
                isGenerating: false,
                progress: 0,
                useVocalSync: false,
                useDaisyChain: true
            }));

            return {
                storyboardProject: {
                    id: state.storyboardProject?.id || uuidv4(),
                    name: state.storyboardProject?.name || 'New Audio Sync Storyboard',
                    bpm,
                    durationSeconds,
                    source: 'audio-grid',
                    slots,
                    audioUrl: state.storyboardProject?.audioUrl
                }
            };
        }),
        receiveStoryboardHandoff: (handoff: ScreenwriterStoryboardHandoff) => set(() => ({
            storyboardProject: compileScreenwriterStoryboardHandoff(handoff),
            viewMode: 'storyboard',
        })),

        isPopoutActive: false,
        previewArtifactUrl: null,
        setPreviewArtifactUrl: (url) => set({ previewArtifactUrl: url }),
        setIsPopoutActive: (active) => set({ isPopoutActive: active }),

        // Persistence (ISSUE-1147)
        isLoadingProject: false,
        setIsLoadingProject: (loading) => set({ isLoadingProject: loading }),
        resetProjectForId: (projectId) => set({ project: blankProjectForId(projectId), selectedClipId: null }),
        loadProjectFromDoc: (project) => set({ project, selectedClipId: null }),

        // Persistence failure surfaces (ISSUE-1195)
        projectLoadError: null,
        projectSaveError: null,
        setProjectLoadError: (message) => set({ projectLoadError: message }),
        setProjectSaveError: (message) => set({ projectSaveError: message }),

        // Guest sessions cannot persist (ISSUE-1194)
        isEphemeralSession: false,
        setIsEphemeralSession: (ephemeral) => set({ isEphemeralSession: ephemeral }),

        setJobId: (id) => set({ jobId: id }),
        setStatus: (status) => set({ status }),
        setProgress: (progress) => set({ progress }),
        setMembershipTier: (tier) => set({ membershipTier: tier }),

        // Scene Extension actions
        setExtendedProject: (project) => set({ extendedProject: project }),
        updateExtendedSegment: (segmentId, updates) => set((state) => {
            if (!state.extendedProject) return {};
            return {
                extendedProject: {
                    ...state.extendedProject,
                    segments: state.extendedProject.segments.map((seg) =>
                        seg.id === segmentId ? { ...seg, ...updates } : seg
                    ),
                },
            };
        }),

        // Reference Images actions (max 3 per Veo 3.1)
        setReferenceImages: (images) => set({ referenceImages: images.slice(0, 3) }),
        addReferenceImage: (image) => set((state) => {
            if (state.referenceImages.length >= 3) {
                logger.warn('[VideoEditor] Max 3 reference images allowed');
                return {};
            }
            return { referenceImages: [...state.referenceImages, image] };
        }),
        removeReferenceImage: (index) => set((state) => ({
            referenceImages: state.referenceImages.filter((_, i) => i !== index),
        })),

        // Audio generation toggle
        setGenerateAudio: (enabled) => set({ generateAudio: enabled }),

        // Timeline zoom (0.25 to 4x)
        setTimelineZoom: (zoom) => set({ timelineZoom: Math.max(0.25, Math.min(4, zoom)) }),

        getMaxDurationFrames: () => {
            const { membershipTier, project } = get();
            return MembershipService.getMaxVideoDurationFrames(membershipTier, project.fps);
        },

        setProject: (project) => set((state) => ({
            project: {
                ...project,
                width: isSafeDimension(project.width) ? project.width : state.project.width,
                height: isSafeDimension(project.height) ? project.height : state.project.height,
                fps: isSafeFps(project.fps) ? project.fps : state.project.fps,
            }
        })),
        updateProjectSettings: (settings) => set((state) => {
            const newSettings = sanitizeProjectSettings(settings, state.project);

            // Enforce duration limits based on membership tier
            if (newSettings.durationInFrames) {
                const maxDurationFrames = MembershipService.getMaxVideoDurationFrames(
                    state.membershipTier,
                    newSettings.fps || state.project.fps
                );

                if (newSettings.durationInFrames > maxDurationFrames) {
                    newSettings.durationInFrames = maxDurationFrames;
                    const maxSeconds = MembershipService.getMaxVideoDurationSeconds(state.membershipTier);
                    const formattedDuration = MembershipService.formatDuration(maxSeconds);
                    logger.warn(
                        `Project duration limited to ${formattedDuration} (${MembershipService.getTierDisplayName(state.membershipTier)} tier). ` +
                        MembershipService.getUpgradeMessage(state.membershipTier, 'video')
                    );
                }
            }

            return {
                project: { ...state.project, ...newSettings }
            };
        }),
        setCurrentTime: (time) => set((state) => {
            // Loop-region enforcement: while playing, crossing the out-point
            // snaps back to the in-point. Paused scrubbing stays unrestricted.
            const loop = state.loopRegion;
            if (state.isPlaying && loop && time >= loop.b) {
                return { currentTime: loop.a };
            }
            return { currentTime: time };
        }),
        setIsPlaying: (isPlaying) => set({ isPlaying }),
        setSelectedClipId: (id) => set({ selectedClipId: id }),

        setLoopIn: () => set((state) => {
            const a = Math.max(0, state.currentTime);
            const b = state.loopRegion?.b ?? state.project.durationInFrames;
            return { loopRegion: a < b ? { a, b } : { a: 0, b: state.project.durationInFrames } };
        }),
        setLoopOut: () => set((state) => {
            const b = Math.min(state.project.durationInFrames, Math.max(1, state.currentTime));
            const a = state.loopRegion?.a ?? 0;
            return { loopRegion: a < b ? { a, b } : null };
        }),
        clearLoop: () => set({ loopRegion: null }),

        addTrack: (type) => set((state) => {
            const newTrack: VideoTrack = {
                id: uuidv4(),
                name: `${type} Track`,
                type,
            };
            return {
                project: {
                    ...state.project,
                    tracks: [...state.project.tracks, newTrack]
                }
            };
        }),

        removeTrack: (id) => set((state) => {
            // An editor project must always retain an import target. Keeping the
            // final track is safer than creating a zero-track project that later
            // import/drop operations cannot route into.
            if (state.project.tracks.length <= 1) return {};
            return {
                project: {
                    ...state.project,
                    tracks: state.project.tracks.filter(t => t.id !== id),
                    clips: state.project.clips.filter(c => c.trackId !== id)
                }
            };
        }),

        addClip: (clipData) => set((state) => {
            const newClip: VideoClip = {
                id: uuidv4(),
                ...clipData
            };
            const requiredDuration = Math.max(
                state.project.durationInFrames,
                newClip.startFrame + newClip.durationInFrames
            );
            return {
                project: {
                    ...state.project,
                    clips: [...state.project.clips, newClip],
                    durationInFrames: requiredDuration
                }
            };
        }),

        updateClip: (id, updates) => set((state) => {
            const clips = state.project.clips.map(c => c.id === id ? { ...c, ...updates } : c);
            const updated = clips.find(c => c.id === id);
            const requiredDuration = updated
                ? Math.max(state.project.durationInFrames, updated.startFrame + updated.durationInFrames)
                : state.project.durationInFrames;
            return { project: { ...state.project, clips, durationInFrames: requiredDuration } };
        }),

        removeClip: (id) => set((state) => ({
            project: {
                ...state.project,
                clips: state.project.clips.filter(c => c.id !== id)
            }
        })),

        rippleDeleteClip: (id) => set((state) => {
            const clip = state.project.clips.find(c => c.id === id);
            if (!clip) return {};
            const gapEnd = clip.startFrame + clip.durationInFrames;
            return {
                project: {
                    ...state.project,
                    clips: state.project.clips
                        .filter(c => c.id !== id)
                        .map(c => (c.trackId === clip.trackId && c.startFrame >= gapEnd
                            ? { ...c, startFrame: c.startFrame - clip.durationInFrames }
                            : c))
                        .sort((a, b) => a.startFrame - b.startFrame),
                },
            };
        }),

        splitClip: (id, atFrame) => set((state) => {
            const clip = state.project.clips.find(c => c.id === id);
            if (!clip) return {};
            const start = clip.startFrame;
            const end = start + clip.durationInFrames;
            if (!Number.isInteger(atFrame) || atFrame <= start || atFrame >= end) return {};

            const leftFrames = atFrame - start;
            const left: VideoClip = { ...clip, id: uuidv4(), name: `${clip.name} A`, durationInFrames: leftFrames };
            const right: VideoClip = { ...clip, id: uuidv4(), name: `${clip.name} B`, startFrame: atFrame, durationInFrames: end - atFrame };

            // Source-trim-aware: the µs window shifts with the split so the
            // two halves cover the same media region as the original.
            if (clip.sourceInUs !== undefined && clip.sourceOutUs !== undefined) {
                const splitUs = Math.round(leftFrames * 1_000_000 / state.project.fps);
                left.sourceOutUs = clip.sourceInUs + splitUs;
                right.sourceInUs = clip.sourceInUs + splitUs;
            }

            const clips = [...state.project.clips.filter(c => c.id !== id), left, right]
                .sort((a, b) => a.startFrame - b.startFrame);
            return { project: { ...state.project, clips } };
        }),

        duplicateClip: (id) => set((state) => {
            const clip = state.project.clips.find(c => c.id === id);
            if (!clip) return {};
            const copy: VideoClip = {
                ...clip,
                id: uuidv4(),
                name: `${clip.name} copy`,
                startFrame: clip.startFrame + clip.durationInFrames,
            };
            return { project: { ...state.project, clips: [...state.project.clips, copy] } };
        }),

        addKeyframe: (clipId: string, property: string, frame: number, value: number) => set((state) => {
            const clip = state.project.clips.find(c => c.id === clipId);
            if (!clip) return {};

            const currentKeyframes = clip.keyframes?.[property] || [];
            // Remove existing keyframe at same frame if any
            const filtered = currentKeyframes.filter(k => k.frame !== frame);
            const newKeyframes = [...filtered, { frame, value }].sort((a, b) => a.frame - b.frame);

            return {
                project: {
                    ...state.project,
                    clips: state.project.clips.map(c => c.id === clipId ? {
                        ...c,
                        keyframes: {
                            ...c.keyframes,
                            [property]: newKeyframes
                        }
                    } : c)
                }
            };
        }),

        removeKeyframe: (clipId: string, property: string, frame: number) => set((state) => {
            const clip = state.project.clips.find(c => c.id === clipId);
            if (!clip || !clip.keyframes || !clip.keyframes[property]) return {};

            return {
                project: {
                    ...state.project,
                    clips: state.project.clips.map(c => c.id === clipId ? {
                        ...c,
                        keyframes: {
                            ...c.keyframes,
                            [property]: clip.keyframes![property]!.filter(k => k.frame !== frame)
                        }
                    } : c)
                }
            };
        }),

        updateKeyframe: (clipId: string, property: string, frame: number, updates: Partial<{ value: number, easing: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' }>) => set((state) => {
            const clip = state.project.clips.find(c => c.id === clipId);
            if (!clip || !clip.keyframes || !clip.keyframes[property]) return {};

            return {
                project: {
                    ...state.project,
                    clips: state.project.clips.map(c => c.id === clipId ? {
                        ...c,
                        keyframes: {
                            ...c.keyframes,
                            [property]: clip.keyframes![property]!.map(k => k.frame === frame ? { ...k, ...updates } : k)
                        }
                    } : c)
                }
            };
        }),
    };
});

if (typeof window !== 'undefined' && import.meta.env.DEV) {
    (window as any).useVideoEditorStore = useVideoEditorStore;
}

/** Raised when a compile is refused. Never partially applied — the project is untouched. */
export class TimelineCompileError extends Error {
    constructor(
        public readonly code:
            | 'cross-owner'
            | 'cross-project'
            | 'missing-source-generation'
            | 'missing-proxy-generation',
        message: string,
    ) {
        super(message);
        this.name = 'TimelineCompileError';
    }
}

/**
 * Stable identity for a compiled clip (ISSUE-1180 acceptance 4).
 *
 * This was `uuidv4()`, which is what made the compiler impossible to make
 * idempotent: re-running produced a fresh id for every clip, so there was no key
 * to reconcile against and the results could only be appended. Deriving the id
 * from (approval, segment) makes recompiling the same approval produce byte-
 * identical ids, so it can replace rather than duplicate.
 */
const compiledClipId = (approvalReceiptId: string, segmentId: string) =>
    `compiled:${approvalReceiptId}:${segmentId}`;

/**
 * Compile one approval receipt into a project-scoped timeline.
 *
 * ISSUE-1196 (repair-order step 1): `ownerUid` and `projectId` were previously
 * declared on the parameter type and read by nothing, so there was no
 * cross-owner rejection and no project-scope check — the two fields that exist
 * to enforce authorization were decorative. They are now enforced, and the
 * function fails closed rather than returning a partially-compiled timeline.
 *
 * Idempotent: clips carry deterministic ids, and re-running for the same
 * approval replaces that approval's clips instead of appending a second copy.
 */
export function compileApprovalToTimeline(
    approval: { approvalReceiptId: string; planId: string; ownerUid: string; projectId: string; decisions: Array<{ segmentId: string; action: string; overrideProxyStartUs?: number; overrideProxyEndUs?: number; overrideAudioRecipeId?: string }> },
    plan: { segments: Array<{ segmentId: string; classification: string; proxyStartUs: number; proxyEndUs: number; originalStartUs: number; originalEndUs: number; transcriptText: string; syncAlignmentId?: string; audioRecipeId?: string }> },
    session: { original?: { bucket: string; path: string; generation: string }; proxyManifest?: { proxy: { bucket: string; path: string; generation: string } } },
    existingProject: VideoProject,
    currentUid: string,
): VideoProject {
    // Fail closed before touching anything.
    if (approval.ownerUid !== currentUid) {
        throw new TimelineCompileError(
            'cross-owner',
            `Approval ${approval.approvalReceiptId} belongs to another user; refusing to compile.`,
        );
    }
    if (approval.projectId !== existingProject.id) {
        throw new TimelineCompileError(
            'cross-project',
            `Approval ${approval.approvalReceiptId} targets project ${approval.projectId}, not ${existingProject.id}.`,
        );
    }
    // Generations are the lineage back to the original and proxy media. Recording
    // `undefined` would silently sever it, which is what the field exists to prevent.
    if (!session.original?.generation) {
        throw new TimelineCompileError(
            'missing-source-generation',
            'Session has no original media generation; cannot establish source lineage.',
        );
    }
    if (!session.proxyManifest?.proxy.generation) {
        throw new TimelineCompileError(
            'missing-proxy-generation',
            'Session has no proxy generation; cannot establish proxy lineage.',
        );
    }

    const fps = existingProject.fps || 30;
    const microsecPerFrame = 1_000_000 / fps;
    const mainTrack = existingProject.tracks.find(t => t.type === 'video') || existingProject.tracks[0] || { id: 'track-video-1', name: 'Video 1', type: 'video' as const };

    let currentTimelineFrame = 0;
    const compiledClips: VideoClip[] = [];

    const decisionMap = new Map(approval.decisions.map(d => [d.segmentId, d]));

    for (const segment of plan.segments) {
        const decision = decisionMap.get(segment.segmentId);
        if (!decision || (decision.action !== 'keep' && decision.action !== 'blooper')) {
            continue;
        }

        const proxyStartUs = decision.overrideProxyStartUs ?? segment.proxyStartUs;
        const proxyEndUs = decision.overrideProxyEndUs ?? segment.proxyEndUs;
        const durationUs = proxyEndUs - proxyStartUs;
        if (durationUs <= 0) continue;

        const durationInFrames = Math.max(1, Math.round(durationUs / microsecPerFrame));
        // Clamp: an override earlier than the segment start would otherwise drive the
        // source in-point negative, which no decoder can seek to.
        const originalStartUs = Math.max(
            0,
            segment.originalStartUs + (proxyStartUs - segment.proxyStartUs),
        );
        const originalEndUs = originalStartUs + durationUs;

        const clip: VideoClip = {
            id: compiledClipId(approval.approvalReceiptId, segment.segmentId),
            type: 'video',
            name: segment.transcriptText.slice(0, 30) || `Segment ${segment.segmentId}`,
            src: `gs://${session.proxyManifest.proxy.bucket}/${session.proxyManifest.proxy.path}`,
            startFrame: currentTimelineFrame,
            durationInFrames,
            trackId: mainTrack.id,
            sourceInUs: originalStartUs,
            sourceOutUs: originalEndUs,
            sourceGeneration: session.original.generation,
            proxyGeneration: session.proxyManifest.proxy.generation,
            syncAlignmentId: segment.syncAlignmentId,
            syncLock: Boolean(segment.syncAlignmentId),
            audioRecipeId: decision.overrideAudioRecipeId || segment.audioRecipeId,
            approvalReceiptId: approval.approvalReceiptId,
            planId: approval.planId,
        };

        compiledClips.push(clip);
        currentTimelineFrame += durationInFrames;
    }

    // Idempotency: drop any prior compilation of THIS approval, keep everything
    // else (hand edits, clips from other approvals) untouched.
    const retained = existingProject.clips.filter(
        c => c.approvalReceiptId !== approval.approvalReceiptId,
    );

    return {
        ...existingProject,
        clips: [...retained, ...compiledClips],
        durationInFrames: Math.max(existingProject.durationInFrames, currentTimelineFrame),
    };
}
