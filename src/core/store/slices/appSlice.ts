import { StateCreator } from 'zustand';

export interface Project {
    id: string;
    name: string;
    type: AppSlice['currentModule'];
    date: number;
    orgId: string;
}

export interface AppSlice {
    currentModule: 'creative' | 'legal' | 'music' | 'marketing' | 'video' | 'workflow' | 'dashboard' | 'select-org';
    currentProjectId: string;
    projects: Project[];
    setModule: (module: AppSlice['currentModule']) => void;
    setProject: (id: string) => void;
    addProject: (project: Project) => void;
}

export const createAppSlice: StateCreator<AppSlice> = (set) => ({
    currentModule: 'dashboard',
    currentProjectId: 'default',
    projects: [
        { id: 'default', name: 'Default Project', date: Date.now(), type: 'creative', orgId: 'org-default' },
        { id: 'proj-2', name: 'Neon City Campaign', date: Date.now() - 86400000, type: 'marketing', orgId: 'org-default' },
        { id: 'proj-3', name: 'Audio Experience', date: Date.now() - 172800000, type: 'music', orgId: 'org-default' },
    ],
    setModule: (module) => set({ currentModule: module }),
    setProject: (id) => set({ currentProjectId: id }),
    addProject: (project) => set((state) => ({ projects: [project, ...state.projects] })),
});
