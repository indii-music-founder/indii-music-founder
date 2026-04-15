import { StateCreator } from 'zustand';
import { type ModuleId, isValidModule } from '@/core/constants';
import type { ProjectMetadata } from '@/services/dashboard/DashboardService';
import { logger } from '@/utils/logger';

// Helper to get initial module from URL
const getInitialModule = (): ModuleId => {
    if (typeof window === 'undefined') return 'dashboard';
    const pathSegments = window.location.pathname.split('/').filter(Boolean);
    const firstSegment = pathSegments[0];
    if (firstSegment && isValidModule(firstSegment)) {
        return firstSegment;
    }
    return 'dashboard';
};

export interface Project {
    id: string;
    name: string;
    type: AppSlice['currentModule'];
    date?: number;
    lastModified?: number;
    orgId: string;
    thumbnail?: string;
    assetCount?: number;
}

export interface AppSlice {
    currentModule: ModuleId;
    currentProjectId: string;
    projects: ProjectMetadata[]; // Changed from Project[] to enforce UI type
    setModule: (module: AppSlice['currentModule']) => void;
    setProject: (id: string) => void;
    addProject: (project: ProjectMetadata) => void; // Changed parameter type
    loadProjects: () => Promise<void>;
    createNewProject: (name: string, type: Project['type'], orgId: string) => Promise<string>;
    pendingPrompt: string | null;
    setPendingPrompt: (prompt: string | null) => void;
    apiKeyError: boolean;
    setApiKeyError: (error: boolean) => void;
    isSidebarOpen: boolean;
    isRightPanelOpen: boolean;
    rightPanelTab: 'context' | 'assets' | 'agent';
    toggleSidebar: () => void;
    toggleRightPanel: () => void;
    setRightPanelTab: (tab: 'context' | 'assets' | 'agent') => void;
    isCommandMenuOpen: boolean;
    setCommandMenuOpen: (open: boolean) => void;
    hasUnsavedChanges: boolean;
    setHasUnsavedChanges: (hasUnsaved: boolean) => void;
    /** @internal Debounce tracker for toggleRightPanel */
    _lastRightPanelToggle?: number;
    /** @internal Debounce tracker for toggleSidebar */
    _lastSidebarToggle?: number;
}

export const createAppSlice: StateCreator<AppSlice> = (set, get) => ({
    currentModule: getInitialModule(),
    currentProjectId: 'default',
    projects: [],
    hasUnsavedChanges: false,
    setHasUnsavedChanges: (hasUnsaved) => set({ hasUnsavedChanges: hasUnsaved }),
    setModule: (module) => {
        const state = get();
        if (state.hasUnsavedChanges && state.currentModule !== module) {
            const confirmLeave = window.confirm("You have unsaved changes that will be lost. Are you sure you want to leave?");
            if (!confirmLeave) {
                return;
            }
            set({ hasUnsavedChanges: false });
        }

        // Aggressively tear down listeners from previous modules
        // This requires dynamic import of store to avoid circular dependency
        import('@/core/store').then(({ useStore }) => {
            const currentModule = get().currentModule;
            // Only clear if actually switching modules
            if (currentModule !== module) {
                const store = useStore.getState();
                // Clean up Firestore subscriptions for the module we're leaving
                // to prevent INTERNAL ASSERTION FAILED errors during rapid navigation
                const prefixes: Partial<Record<string, string>> = {
                    creative: 'creative_',
                    publishing: 'publishing_',
                    finance: 'finance_',
                    memory: 'memory_',
                    publicist: 'publicist_',
                    distribution: 'distribution_',
                    merch: 'merch_',
                };
                const prefix = prefixes[currentModule];
                if (prefix) {
                    store.clearSubscriptionsByPrefix(prefix);
                }
            }
        }).catch(err => logger.error('[AppSlice] Failed to cleanup subscriptions:', err));

        set({
            currentModule: module,
        });
    },
    setProject: (id) => set({ currentProjectId: id }),
    addProject: (project) => set((state) => ({ projects: [project, ...state.projects] })),
    loadProjects: async () => {
        const { ProjectService } = await import('@/services/ProjectService');
        const { OrganizationService } = await import('@/services/OrganizationService');
        const { projectsToMetadata } = await import('@/services/dashboard/projectTypeUtils');
        const orgId = OrganizationService.getCurrentOrgId();
        if (orgId) {
            const firestoreProjects = await ProjectService.getProjectsForOrg(orgId);
            // Convert Project[] to ProjectMetadata[] at the boundary
            const projects = projectsToMetadata(firestoreProjects);
            set({ projects });
        }
    },
    createNewProject: async (name, type, orgId) => {
        const { ProjectService } = await import('@/services/ProjectService');
        const { projectToMetadata } = await import('@/services/dashboard/projectTypeUtils');
        const newProject = await ProjectService.createProject(name, type, orgId);
        // Convert Project to ProjectMetadata at the boundary
        const metadata = projectToMetadata(newProject);
        set((state) => ({
            projects: [metadata, ...state.projects],
            currentProjectId: newProject.id,
            currentModule: type,
        }));
        return newProject.id;
    },
    pendingPrompt: null,
    setPendingPrompt: (prompt) => set({ pendingPrompt: prompt }),
    apiKeyError: false,
    setApiKeyError: (error) => set({ apiKeyError: error }),
    isSidebarOpen: typeof window !== 'undefined' ? localStorage.getItem('indiiOS_sidebarOpen') !== 'false' : true,
    isRightPanelOpen: false,
    rightPanelTab: 'context',
    toggleSidebar: () => {
        const now = Date.now();
        const state = get();
        if (state._lastSidebarToggle && now - state._lastSidebarToggle < 200) {
            return; // Ignore rapid-fire toggles
        }
        const newState = !state.isSidebarOpen;
        if (typeof window !== 'undefined') {
            localStorage.setItem('indiiOS_sidebarOpen', String(newState));
        }
        set({ isSidebarOpen: newState, _lastSidebarToggle: now });
    },
    toggleRightPanel: () => {
        // BUG-006 FIX: Debounce rapid toggle clicks.
        // The AnimatePresence mode="wait" in RightPanel can get stuck
        // if toggled faster than the spring animation duration (~200ms).
        const now = Date.now();
        const state = get();
        if (state._lastRightPanelToggle && now - state._lastRightPanelToggle < 200) {
            return; // Ignore rapid-fire toggles
        }
        set({ isRightPanelOpen: !state.isRightPanelOpen, _lastRightPanelToggle: now });
    },
    setRightPanelTab: (tab) => set({ rightPanelTab: tab, isRightPanelOpen: true }),
    isCommandMenuOpen: false,
    setCommandMenuOpen: (open) => set({ isCommandMenuOpen: open }),
});
