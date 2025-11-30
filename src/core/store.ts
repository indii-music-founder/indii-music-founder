import { create } from 'zustand';
import type { CustomNode, CustomEdge, KnowledgeDocument, UserProfile, BrandKit } from '../modules/workflow/types';

export interface AgentMessage {
    id: string;
    role: 'user' | 'model' | 'system';
    text: string;
    timestamp: number;
    attachments?: { mimeType: string; base64: string }[];
    isStreaming?: boolean;
}

export interface HistoryItem {
    id: string;
    type: 'image' | 'video';
    url: string; // Base64 or URL
    prompt: string;
    timestamp: number;
    projectId: string;
    meta?: string;
    mask?: string; // Base64 mask data
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

export interface Organization {
    id: string;
    name: string;
    plan: 'free' | 'pro' | 'enterprise';
    members: string[];
}

interface AppState {
    currentModule: 'creative' | 'legal' | 'music' | 'marketing' | 'video' | 'workflow' | 'dashboard';
    currentProjectId: string;

    // Organization State
    currentOrganizationId: string;
    organizations: Organization[];
    setOrganization: (id: string) => void;
    addOrganization: (org: Organization) => void;

    agentHistory: AgentMessage[];
    isAgentOpen: boolean;
    generatedHistory: HistoryItem[];

    setModule: (module: AppState['currentModule']) => void;
    setProject: (id: string) => void;
    addAgentMessage: (msg: AgentMessage) => void;
    updateAgentMessage: (id: string, updates: Partial<AgentMessage>) => void;
    clearAgentHistory: () => void;
    toggleAgentWindow: () => void;
    addToHistory: (item: HistoryItem) => void;
    initializeHistory: () => Promise<void>;
    updateHistoryItem: (id: string, updates: Partial<HistoryItem>) => void;
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

    uploadedImages: HistoryItem[]; // Reusing HistoryItem for consistency
    addUploadedImage: (img: HistoryItem) => void;
    removeUploadedImage: (id: string) => void;

    studioControls: {
        aspectRatio: string;
        resolution: string;
        negativePrompt: string;
        seed: string;
    };
    setStudioControls: (controls: Partial<AppState['studioControls']>) => void;

    generationMode: 'image' | 'video';
    setGenerationMode: (mode: 'image' | 'video') => void;

    activeReferenceImage: HistoryItem | null;
    setActiveReferenceImage: (img: HistoryItem | null) => void;

    videoInputs: {
        firstFrame: HistoryItem | null;
        lastFrame: HistoryItem | null;
        isDaisyChain: boolean;
        timeOffset: number;
    };
    setVideoInput: (key: keyof AppState['videoInputs'], value: any) => void;

    viewMode: 'gallery' | 'canvas' | 'showroom' | 'video_production';
    setViewMode: (mode: 'gallery' | 'canvas' | 'showroom' | 'video_production') => void;

    prompt: string;
    setPrompt: (prompt: string) => void;

    selectedItem: HistoryItem | null;
    setSelectedItem: (item: HistoryItem | null) => void;

    // Workflow State
    nodes: CustomNode[];
    edges: CustomEdge[];
    selectedNodeId: string | null;
    setNodes: (nodes: CustomNode[] | ((nodes: CustomNode[]) => CustomNode[])) => void;
    setEdges: (edges: CustomEdge[] | ((edges: CustomEdge[]) => CustomEdge[])) => void;
    addNode: (node: CustomNode) => void;
    setSelectedNodeId: (id: string | null) => void;
    // Knowledge Base State
    knowledgeBase: KnowledgeDocument[];
    addKnowledgeDocument: (doc: KnowledgeDocument) => void;

    // User Profile & Brand Kit
    userProfile: UserProfile;
    setUserProfile: (profile: UserProfile) => void;
    updateBrandKit: (updates: Partial<BrandKit>) => void;
}

export const useStore = create<AppState>((set) => ({
    currentModule: 'dashboard',
    // ... existing initial state ...
    currentProjectId: 'default',

    // Organization State
    currentOrganizationId: 'org-default',
    organizations: [
        { id: 'org-default', name: 'Personal Workspace', plan: 'free', members: ['me'] }
    ],
    setOrganization: (id) => set({ currentOrganizationId: id }),
    addOrganization: (org) => set((state) => ({ organizations: [...state.organizations, org] })),

    agentHistory: [],
    isAgentOpen: false,
    generatedHistory: [],

    setModule: (module) => set({ currentModule: module }),
    setProject: (id) => set({ currentProjectId: id }),
    addAgentMessage: (msg) => set((state) => ({ agentHistory: [...state.agentHistory, msg] })),
    updateAgentMessage: (id, updates) => set((state) => ({
        agentHistory: state.agentHistory.map(msg => msg.id === id ? { ...msg, ...updates } : msg)
    })),
    clearAgentHistory: () => set({ agentHistory: [] }),
    toggleAgentWindow: () => set((state) => ({ isAgentOpen: !state.isAgentOpen })),
    addToHistory: (item) => {
        set((state) => ({ generatedHistory: [item, ...state.generatedHistory] }));
        // Fire and forget save to Firestore
        import('../services/StorageService').then(({ StorageService }) => {
            StorageService.saveItem(item)
                .then(() => console.log("Saved to Firestore"))
                .catch(e => console.error("Save failed", e));
        });
    },
    initializeHistory: async () => {
        const { auth } = await import('../services/firebase');
        const { onAuthStateChanged, signInAnonymously } = await import('firebase/auth');
        const { StorageService } = await import('../services/StorageService');

        // Wait for auth to initialize
        return new Promise<void>((resolve) => {
            const unsubscribe = onAuthStateChanged(auth, async (user) => {
                if (user) {
                    console.log("User authenticated:", user.uid);
                    try {
                        const history = await StorageService.loadHistory();
                        set({ generatedHistory: history });
                        console.log("Loaded history:", history.length, "items");
                    } catch (error) {
                        console.error("Error loading history:", error);
                    }
                    unsubscribe();
                    resolve();
                } else {
                    console.log("No user, signing in anonymously...");
                    try {
                        const cred = await signInAnonymously(auth);
                        console.log("Sign in successful. User:", cred.user.uid);
                        // Manually load history if listener doesn't fire immediately
                        // (Though it should fire)
                        if (auth.currentUser) {
                            console.log("Manual load after sign in...");
                            const history = await StorageService.loadHistory();
                            set({ generatedHistory: history });
                            console.log("Manual load success:", history.length);
                            unsubscribe();
                            resolve();
                        }
                    } catch (e) {
                        console.error("Anonymous sign-in failed:", e);
                        // Resolve anyway so the app doesn't hang on "Loading..."
                        unsubscribe();
                        resolve();
                    }
                }
            });
        });
    },
    updateHistoryItem: (id, updates) => set((state) => ({
        generatedHistory: state.generatedHistory.map(item => item.id === id ? { ...item, ...updates } : item)
    })),
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

    uploadedImages: [],
    addUploadedImage: (img) => set((state) => ({ uploadedImages: [img, ...state.uploadedImages] })),
    removeUploadedImage: (id) => set((state) => ({ uploadedImages: state.uploadedImages.filter(i => i.id !== id) })),

    studioControls: {
        aspectRatio: '16:9',
        resolution: '4K',
        negativePrompt: '',
        seed: ''
    },
    setStudioControls: (controls) => set((state) => ({ studioControls: { ...state.studioControls, ...controls } })),

    generationMode: 'image',
    setGenerationMode: (mode) => set({ generationMode: mode }),

    activeReferenceImage: null as HistoryItem | null,
    setActiveReferenceImage: (img: HistoryItem | null) => set({ activeReferenceImage: img }),

    videoInputs: {
        firstFrame: null,
        lastFrame: null,
        isDaisyChain: false,
        timeOffset: 0
    },
    setVideoInput: (key, value) => set(state => ({
        videoInputs: { ...state.videoInputs, [key]: value }
    })),

    viewMode: 'gallery',
    setViewMode: (mode) => set({ viewMode: mode }),

    prompt: '',
    setPrompt: (prompt) => set({ prompt }),

    selectedItem: null,
    setSelectedItem: (item) => set({ selectedItem: item }),

    // Workflow State
    nodes: [],
    edges: [],
    selectedNodeId: null,
    setNodes: (nodes) => set((state) => ({
        nodes: typeof nodes === 'function' ? nodes(state.nodes) : nodes
    })),
    setEdges: (edges) => set((state) => ({
        edges: typeof edges === 'function' ? edges(state.edges) : edges
    })),
    addNode: (node) => set((state) => ({ nodes: [...state.nodes, node] })),
    setSelectedNodeId: (id) => set({ selectedNodeId: id }),

    // Knowledge Base State
    knowledgeBase: [],
    addKnowledgeDocument: (doc) => set((state) => ({ knowledgeBase: [...state.knowledgeBase, doc] })),

    // User Profile & Brand Kit
    userProfile: {
        bio: '',
        preferences: '',
        brandKit: {
            colors: [],
            fonts: '',
            brandDescription: '',
            negativePrompt: '',
            socials: {},
            brandAssets: [],
            referenceImages: [],
            releaseDetails: {
                title: '',
                type: 'Single',
                artists: '',
                genre: '',
                mood: '',
                themes: '',
                lyrics: ''
            }
        },
        analyzedTrackIds: [],
        knowledgeBase: [],
        savedWorkflows: []
    },
    setUserProfile: (profile) => set({ userProfile: profile }),
    updateBrandKit: (updates) => set((state) => ({
        userProfile: {
            ...state.userProfile,
            brandKit: { ...state.userProfile.brandKit, ...updates }
        }
    })),
}));

// Expose store for debugging/automation
if (typeof window !== 'undefined') {
    (window as any).useStore = useStore;
}
