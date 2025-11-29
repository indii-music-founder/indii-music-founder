import { create } from 'zustand';

export interface AgentMessage {
    id: string;
    role: 'user' | 'model' | 'system';
    text: string;
    timestamp: number;
    attachments?: { mimeType: string; base64: string }[];
}

export interface HistoryItem {
    id: string;
    type: 'image' | 'video';
    url: string; // Base64 or URL
    prompt: string;
    timestamp: number;
    projectId: string;
    meta?: string;
}

export interface SavedPrompt {
    id: string;
    title: string;
    text: string;
    date: number;
}

export interface CanvasImage {
    id: string;
    base64: string;
    x: number;
    y: number;
    width: number;
    height: number;
    aspect: number;
    projectId: string;
}

interface AppState {
    currentModule: 'creative' | 'legal' | 'music' | 'marketing';
    currentProjectId: string;
    agentHistory: AgentMessage[];
    isAgentOpen: boolean;
    generatedHistory: HistoryItem[];

    setModule: (module: AppState['currentModule']) => void;
    setProject: (id: string) => void;
    addAgentMessage: (msg: AgentMessage) => void;
    clearAgentHistory: () => void;
    toggleAgentWindow: () => void;
    addToHistory: (item: HistoryItem) => void;
    removeFromHistory: (id: string) => void;
    savedPrompts: SavedPrompt[];
    savePrompt: (prompt: SavedPrompt) => void;
    deletePrompt: (id: string) => void;

    canvasImages: CanvasImage[];
    addCanvasImage: (img: CanvasImage) => void;
    updateCanvasImage: (id: string, updates: Partial<CanvasImage>) => void;
    removeCanvasImage: (id: string) => void;
    selectedCanvasImageId: string | null;
    selectCanvasImage: (id: string | null) => void;
}

export const useStore = create<AppState>((set) => ({
    currentModule: 'creative',
    currentProjectId: 'default',
    agentHistory: [],
    isAgentOpen: true,
    generatedHistory: [],

    setModule: (module) => set({ currentModule: module }),
    setProject: (id) => set({ currentProjectId: id }),
    addAgentMessage: (msg) => set((state) => ({ agentHistory: [...state.agentHistory, msg] })),
    clearAgentHistory: () => set({ agentHistory: [] }),
    toggleAgentWindow: () => set((state) => ({ isAgentOpen: !state.isAgentOpen })),
    addToHistory: (item) => set((state) => ({ generatedHistory: [item, ...state.generatedHistory] })),
    removeFromHistory: (id) => set((state) => ({ generatedHistory: state.generatedHistory.filter(i => i.id !== id) })),

    savedPrompts: [],
    savePrompt: (prompt) => set((state) => ({ savedPrompts: [prompt, ...state.savedPrompts] })),
    deletePrompt: (id) => set((state) => ({ savedPrompts: state.savedPrompts.filter(p => p.id !== id) })),

    canvasImages: [],
    selectedCanvasImageId: null,
    addCanvasImage: (img) => set((state) => ({ canvasImages: [...state.canvasImages, img] })),
    updateCanvasImage: (id, updates) => set((state) => ({
        canvasImages: state.canvasImages.map(img => img.id === id ? { ...img, ...updates } : img)
    })),
    removeCanvasImage: (id) => set((state) => ({ canvasImages: state.canvasImages.filter(i => i.id !== id) })),
    selectCanvasImage: (id) => set({ selectedCanvasImageId: id }),
}));
