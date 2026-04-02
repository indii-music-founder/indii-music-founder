import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { MembershipService, MembershipTier } from '@/services/MembershipService';
import type { ExtendedVideoProject, SceneSegment } from '@/services/video/SceneExtensionService';
import { logger } from '@/utils/logger';

export type ClipType = 'video' | 'image' | 'text' | 'audio';

export interface VideoClip {
    id: string;
    type: ClipType;
    src?: string; // URL for video/image/audio
    text?: string; // Content for text
    startFrame: number;
    durationInFrames: number;
    trackId: string;
    name: string;
    // Visual properties
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    scale?: number;
    opacity?: number;
    rotation?: number;
    anchorX?: number; // 0 to 1 (percentage)
    anchorY?: number; // 0 to 1 (percentage)
    borderRadius?: number;
    volume?: number; // 0 to 1
    // Text specific properties
    textColor?: string;
    fontSize?: number;
    fontWeight?: string;
    textAlign?: 'left' | 'center' | 'right';
    filter?: {
        type: 'blur' | 'grayscale' | 'sepia' | 'contrast' | 'brightness';
        intensity: number; // 0-100
    };
    transitionIn?: { type: 'fade' | 'slide' | 'wipe' | 'zoom'; duration: number };
    transitionOut?: { type: 'fade' | 'slide' | 'wipe' | 'zoom'; duration: number };
    keyframes?: {
        [key: string]: Array<{
            frame: number; // Relative to clip start
            value: number;
            easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
        }>;
    };
}

export interface VideoTrack {
    id: string;
    name: string;
    type: 'video' | 'audio' | 'text'; // Simplified track types for now
    isMuted?: boolean;
    isHidden?: boolean;
}

export interface VideoProject {
    id: string;
    name: string;
    fps: number;
    durationInFrames: number;
    width: number;
    height: number;
    tracks: VideoTrack[];
    clips: VideoClip[];
}

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

    addTrack: (type: VideoTrack['type']) => void;
    removeTrack: (id: string) => void;

    addClip: (clip: Omit<VideoClip, 'id'>) => void;
    updateClip: (id: string, updates: Partial<VideoClip>) => void;
    removeClip: (id: string) => void;
    addKeyframe: (clipId: string, property: string, frame: number, value: number) => void;
    removeKeyframe: (clipId: string, property: string, frame: number) => void;
    updateKeyframe: (clipId: string, property: string, frame: number, updates: Partial<{ value: number, easing: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' }>) => void;

    // Job Tracking
    jobId: string | null;
    status: 'idle' | 'queued' | 'processing' | 'stitching' | 'completed' | 'failed';
    progress: number;
    setJobId: (id: string | null) => void;
    setStatus: (status: 'idle' | 'queued' | 'processing' | 'stitching' | 'completed' | 'failed') => void;
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

    // View Mode (Director vs Editor vs Visualizer)
    viewMode: 'director' | 'editor' | 'visualizer';
    setViewMode: (mode: 'director' | 'editor' | 'visualizer') => void;

    // Popout Viewer State
    isPopoutActive: boolean;
    setIsPopoutActive: (active: boolean) => void;
}

const INITIAL_PROJECT: VideoProject = {
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
    clips: [
        {
            id: 'clip-1',
            type: 'text',
            text: 'Welcome to Remotion',
            startFrame: 0,
            durationInFrames: 90,
            trackId: 'track-2',
            name: 'Title Card'
        }
    ]
};

// Setup BroadcastChannel for sync to popout window
let syncChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined') {
    syncChannel = new BroadcastChannel('indiiOS-video-editor-sync');
    syncChannel.onmessage = (event) => {
        if (event.data?.type === 'POPOUT_OPENED') {
            useVideoEditorStore.getState().setIsPopoutActive(true);
            // Give it the latest state immediately
            syncChannel?.postMessage({
                type: 'SYNC_PROJECT',
                project: useVideoEditorStore.getState().project
            });
        } else if (event.data?.type === 'POPOUT_CLOSED') {
            useVideoEditorStore.getState().setIsPopoutActive(false);
        }
    };
}

export const useVideoEditorStore = create<VideoEditorState>((_set, get) => {
    // Custom set wrapper to broadcast project sync
    const set: typeof _set = (partial, replace?) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (_set as any)(partial, replace);
        // After setting, if project was updated, sync it out.
        // Zustand batches updates but we can grab the latest.
        const state = get();
        if (syncChannel && window.location.pathname !== '/video-popout') {
            syncChannel.postMessage({
                type: 'SYNC_PROJECT',
                project: state.project
            });
        }
    };

    return {
        project: INITIAL_PROJECT,
        currentTime: 0,
        isPlaying: false,
        selectedClipId: null,
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

        isPopoutActive: false,
        setIsPopoutActive: (active) => set({ isPopoutActive: active }),

        setJobId: (id) => set({ jobId: id }),
        setStatus: (status) => set({ status }),
        setProgress: (progress) => set({ progress }),
        setMembershipTier: (tier) => set({ membershipTier: tier }),

        // Scene Extension actions
        setExtendedProject: (project) => set({ extendedProject: project }),
        updateExtendedSegment: (segmentId, updates) => set((state) => {
            if (!state.extendedProject) return state;
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
                return state;
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

        setProject: (project) => set({ project }),
        updateProjectSettings: (settings) => set((state) => {
            const newSettings = { ...settings };

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
        setCurrentTime: (time) => set({ currentTime: time }),
        setIsPlaying: (isPlaying) => set({ isPlaying }),
        setSelectedClipId: (id) => set({ selectedClipId: id }),

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

        removeTrack: (id) => set((state) => ({
            project: {
                ...state.project,
                tracks: state.project.tracks.filter(t => t.id !== id),
                clips: state.project.clips.filter(c => c.trackId !== id) // Remove clips in track
            }
        })),

        addClip: (clipData) => set((state) => {
            const newClip: VideoClip = {
                id: uuidv4(),
                ...clipData
            };
            return {
                project: {
                    ...state.project,
                    clips: [...state.project.clips, newClip]
                }
            };
        }),

        updateClip: (id, updates) => set((state) => ({
            project: {
                ...state.project,
                clips: state.project.clips.map(c => c.id === id ? { ...c, ...updates } : c)
            }
        })),

        removeClip: (id) => set((state) => ({
            project: {
                ...state.project,
                clips: state.project.clips.filter(c => c.id !== id)
            }
        })),

        addKeyframe: (clipId: string, property: string, frame: number, value: number) => set((state) => {
            const clip = state.project.clips.find(c => c.id === clipId);
            if (!clip) return state;

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
            if (!clip || !clip.keyframes || !clip.keyframes[property]) return state;

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
            if (!clip || !clip.keyframes || !clip.keyframes[property]) return state;

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
