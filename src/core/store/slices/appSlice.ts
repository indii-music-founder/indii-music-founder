import { StateCreator } from 'zustand';

export interface Project {
    id: string;
    name: string;
    type: AppSlice['currentModule'];
    date: number;
    orgId: string;
}

export interface AppSlice {
    currentModule: 'creative' | 'legal' | 'music' | 'marketing' | 'video' | 'workflow' | 'dashboard' | 'select-org' | 'knowledge' | 'road' | 'brand' | 'publicist' | 'social';
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
}

export const createAppSlice: StateCreator<AppSlice> = (set, get) => ({
    currentModule: 'dashboard',
    currentProjectId: 'default',
    projects: [],
    setModule: (module) => set({ currentModule: module }),
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
            currentModule: type
        }));
        return newProject.id;
    },
    pendingPrompt: null,
    setPendingPrompt: (prompt) => set({ pendingPrompt: prompt }),
    apiKeyError: false,
    setApiKeyError: (error) => set({ apiKeyError: error }),
});
