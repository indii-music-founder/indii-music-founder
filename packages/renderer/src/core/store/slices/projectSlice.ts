import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Project, ProjectStatus } from '@/services/project/ProjectService';

interface ProjectSlice {
  selectedProjectId: string | null;
  selectedProject: Project | null;
  projects: Map<string, Project>;
  isLoading: boolean;
  error: string | null;

  setSelectedProject: (project: Project | null) => void;
  setProject: (project: Project) => void;
  setProjects: (projects: Project[]) => void;
  setProjectStatus: (projectId: string, status: ProjectStatus) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearSelected: () => void;
}

export const useProjectSlice = create<ProjectSlice>()(
  persist(
    (set) => ({
      selectedProjectId: null,
      selectedProject: null,
      projects: new Map(),
      isLoading: false,
      error: null,

      setSelectedProject: (project) =>
        set({
          selectedProjectId: project?.id ?? null,
          selectedProject: project,
          error: null,
        }),

      setProject: (project) =>
        set((state) => {
          const newProjects = new Map(state.projects);
          newProjects.set(project.id, project);
          return {
            projects: newProjects,
            selectedProject:
              state.selectedProjectId === project.id
                ? project
                : state.selectedProject,
          };
        }),

      setProjects: (projects) =>
        set((state) => {
          const newProjects = new Map();
          projects.forEach((p) => newProjects.set(p.id, p));
          
          const currentSelectedId = state.selectedProjectId;
          const currentSelected = currentSelectedId ? newProjects.get(currentSelectedId) ?? null : null;

          return {
            projects: newProjects,
            selectedProject: currentSelected,
            selectedProjectId: currentSelected ? currentSelected.id : null,
          };
        }),

      setProjectStatus: (projectId, status) =>
        set((state) => {
          const project = state.projects.get(projectId);
          if (!project) return state;

          const updated = { ...project, status, updatedAt: new Date() as any };
          const newProjects = new Map(state.projects);
          newProjects.set(projectId, updated);

          return {
            projects: newProjects,
            selectedProject:
              state.selectedProjectId === projectId
                ? updated
                : state.selectedProject,
          };
        }),

      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      clearSelected: () =>
        set({
          selectedProjectId: null,
          selectedProject: null,
        }),
    }),
    {
      name: 'indii-project-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ selectedProjectId: state.selectedProjectId }),
    }
  )
);
