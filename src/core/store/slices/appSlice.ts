import { StateCreator } from 'zustand';
import { type ModuleId, isValidModule } from '@/core/constants';

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
    date: number;
    orgId: string;
}

export interface AppSlice {
    currentModule: ModuleId;
    currentProjectId: string;
    projects: Project[];
    setModule: (module: AppSlice['currentModule']) => void;
    setProject: (id: string) => void;
    addProject: (project: Project) => void;
    loadProjects: () => Promise<void>;
    createNewProject: (name: string, type: Project['type'], orgId: string) => Promise<string>;
    pendingPrompt: string | null;
    setPendingPrompt: (prompt: string | null) => void;
    apiKeyError: boolean;
    setApiKeyError: (error: boolean) => void;
    isSidebarOpen: boolean;
    isRightPanelOpen: boolean;
    toggleSidebar: () => void;
    toggleRightPanel: () => void;
}

export const createAppSlice: StateCreator<AppSlice> = (set, get) => ({
    currentModule: getInitialModule(),
    currentProjectId: 'default',
    projects: [],
    setModule: (module) => set({
        currentModule: module,
        isRightPanelOpen: module === 'creative' || module === 'video' || module === 'files'
    }),
    setProject: (id) => set({ currentProjectId: id }),
    addProject: (project) => set((state) => ({ projects: [project, ...state.projects] })),
    loadProjects: async () => {
        const { ProjectService } = await import('@/services/ProjectService');
        const { OrganizationService } = await import('@/services/OrganizationService');
        const orgId = OrganizationService.getCurrentOrgId();
        if (orgId) {
            const projects = await ProjectService.getProjectsForOrg(orgId);
            set({ projects });
        }
    },
    createNewProject: async (name, type, orgId) => {
        const { ProjectService } = await import('@/services/ProjectService');
        const newProject = await ProjectService.createProject(name, type, orgId);
        set((state) => ({
            projects: [newProject, ...state.projects],
            currentProjectId: newProject.id,
            currentModule: type,
            isRightPanelOpen: type === 'creative' || type === 'video'
        }));
        return newProject.id;
    },
    pendingPrompt: null,
    setPendingPrompt: (prompt) => set({ pendingPrompt: prompt }),
    apiKeyError: false,
    setApiKeyError: (error) => set({ apiKeyError: error }),
    isSidebarOpen: true,
    isRightPanelOpen: false,
    toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
    toggleRightPanel: () => set((state) => ({ isRightPanelOpen: !state.isRightPanelOpen })),
});
