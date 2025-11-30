import { StateCreator } from 'zustand';

export interface AppSlice {
    currentModule: 'creative' | 'legal' | 'music' | 'marketing' | 'video' | 'workflow' | 'dashboard';
    currentProjectId: string;
    setModule: (module: AppSlice['currentModule']) => void;
    setProject: (id: string) => void;
}

export const createAppSlice: StateCreator<AppSlice> = (set) => ({
    currentModule: 'dashboard',
    currentProjectId: 'default',
    setModule: (module) => set({ currentModule: module }),
    setProject: (id) => set({ currentProjectId: id }),
});
