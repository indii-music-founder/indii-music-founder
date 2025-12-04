import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

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

const MAX_DURATION_FRAMES_STANDARD = 30 * 60 * 8; // 8 minutes at 30fps
const MAX_DURATION_FRAMES_PRO = 30 * 60 * 60; // 60 minutes at 30fps

export const useVideoEditorStore = create<VideoEditorState>((set) => ({
    project: INITIAL_PROJECT,
    currentTime: 0,
    isPlaying: false,
    selectedClipId: null,

    setProject: (project) => set({ project }),
    updateProjectSettings: (settings) => set((state) => {
        let newSettings = { ...settings };

        // Enforce duration limits
        if (newSettings.durationInFrames) {
            // TODO: check user membership level. For now, defaulting to standard limit.
            const maxDuration = MAX_DURATION_FRAMES_STANDARD;
            if (newSettings.durationInFrames > maxDuration) {
                newSettings.durationInFrames = maxDuration;
                console.warn(`Project duration limited to ${maxDuration / 30 / 60} minutes.`);
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
}));
