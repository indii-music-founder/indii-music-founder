import React, { useEffect } from 'react';
import { useStore } from '@/core/store';
import { useProjectSlice } from '@/core/store/slices/projectSlice';
import { ProjectService } from '@/services/project/ProjectService';
import { FolderGit2, Plus, ChevronDown, Pencil, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useShallow } from 'zustand/react/shallow';
import { getAuth } from 'firebase/auth';
import { useProjectSync } from '@/hooks/useProjectSync';

interface ProjectListProps {
  isSidebarOpen: boolean;
}

export function ProjectList({ isSidebarOpen }: ProjectListProps) {
  const {
    projects,
    selectedProjectId,
    setSelectedProject,
    setProjects,
    isLoading,
    setLoading,
    setError
  } = useProjectSlice(
    useShallow((state) => ({
      projects: state.projects,
      selectedProjectId: state.selectedProjectId,
      setSelectedProject: state.setSelectedProject,
      setProjects: state.setProjects,
      isLoading: state.isLoading,
      setLoading: state.setLoading,
      setError: state.setError
    }))
  );

  const { syncProject } = useProjectSync();

  const [isOpen, setIsOpen] = React.useState(true);

  useEffect(() => {
    async function loadProjects() {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;

      try {
        setLoading(true);
        // Ensure inbox project exists and list all active projects
        await ProjectService.ensureInbox(user.uid);
        const userProjects = await ProjectService.listByUser(user.uid);
        setProjects(userProjects);
      } catch (err) {
        console.error('Failed to load projects:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    loadProjects();
  }, [setProjects, setLoading, setError]);

  const handleCreateProject = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;
    
    // In a real implementation this would probably open a modal
    const name = prompt('Project Name:');
    if (!name) return;
    
    try {
      const newProject = await ProjectService.create(user.uid, name);
      // Reload projects
      const updatedProjects = await ProjectService.listByUser(user.uid);
      setProjects(updatedProjects);
      setSelectedProject(newProject);
      syncProject(newProject.id);
    } catch (err) {
      console.error('Failed to create project:', err);
    }
  };

  const handleRenameProject = async (e: React.MouseEvent, project: any) => {
    e.stopPropagation();
    const newName = prompt('Rename project:', project.name);
    if (!newName || newName === project.name) return;
    
    try {
      await ProjectService.update(project.id, { name: newName });
      const auth = getAuth();
      if (auth.currentUser) {
        const updatedProjects = await ProjectService.listByUser(auth.currentUser.uid);
        setProjects(updatedProjects);
      }
    } catch (err) {
      console.error('Failed to rename project:', err);
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, project: any) => {
    e.stopPropagation();
    if (project.name === 'Inbox') {
      alert('The Inbox project cannot be deleted.');
      return;
    }
    
    if (!confirm(`Are you sure you want to delete "${project.name}"?`)) return;
    
    try {
      await ProjectService.setStatus(project.id, 'archived');
      const auth = getAuth();
      if (auth.currentUser) {
        const updatedProjects = await ProjectService.listByUser(auth.currentUser.uid);
        setProjects(updatedProjects);
        // Reset selected project if we deleted the current one
        if (selectedProjectId === project.id) {
            const defaultProj = updatedProjects.find(p => p.name === 'Inbox') || updatedProjects[0];
            if (defaultProj) {
                setSelectedProject(defaultProj);
                syncProject(defaultProj.id);
            }
        }
      }
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  const projectArray = Array.from(projects.values());

  return (
    <div className="mb-2">
      {isSidebarOpen && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-4 py-1 text-xs font-semibold text-gray-400 hover:text-gray-200 uppercase tracking-wider mb-1 transition-colors group"
        >
          <span className="whitespace-nowrap flex items-center gap-2">
            Projects
          </span>
          <div className="flex items-center gap-1">
            <Plus
              size={14}
              className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-white"
              onClick={handleCreateProject}
            />
            <ChevronDown
              size={14}
              className={cn("transition-transform duration-200", isOpen ? "rotate-180" : "")}
            />
          </div>
        </button>
      )}

      <AnimatePresence initial={false}>
        {(!isSidebarOpen || isOpen) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="space-y-0.5 overflow-hidden"
          >
            {isLoading && projectArray.length === 0 ? (
              <div className="px-4 py-2 text-xs text-gray-500">Loading...</div>
            ) : projectArray.length === 0 ? (
              <div className="px-4 py-2 text-xs text-gray-500">No projects</div>
            ) : (
              projectArray.map((project) => {
                const isActive = selectedProjectId === project.id;
                return (
                  <div
                    key={project.id}
                    onClick={() => {
                      setSelectedProject(project);
                      syncProject(project.id);
                    }}
                    className={cn(
                      "w-[calc(100%-8px)] mx-1 flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all duration-200 relative group overflow-hidden mb-0.5 cursor-pointer",
                      isActive
                        ? "text-white font-bold bg-white/[0.12] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.15)] ring-1 ring-white/10"
                        : "text-gray-400 font-medium hover:text-white hover:bg-white/[0.05]"
                    )}
                  >
                    <div className="flex items-center gap-3 overflow-hidden flex-1">
                      {isActive && (
                        <motion.div
                          layoutId="active-project-pill"
                          className="absolute left-0 top-0 w-1 h-full bg-blue-500 rounded-r-md"
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                      )}
                      
                      <FolderGit2
                        size={16}
                        className={cn(
                          "relative z-10 transition-transform duration-200 flex-shrink-0 group-hover:scale-110",
                          isActive ? "text-blue-400" : "opacity-70 group-hover:opacity-100"
                        )}
                      />
                      
                      {isSidebarOpen && (
                        <span className={cn(
                          "truncate relative z-10 transition-all duration-200",
                          isActive ? "translate-x-1" : "group-hover:translate-x-0.5"
                        )}>
                          {project.name}
                        </span>
                      )}
                    </div>

                    {isSidebarOpen && (
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity relative z-10">
                        <Pencil
                          size={14}
                          className="text-gray-400 hover:text-white transition-colors"
                          onClick={(e) => handleRenameProject(e, project)}
                        />
                        <Trash2
                          size={14}
                          className="text-gray-400 hover:text-red-400 transition-colors"
                          onClick={(e) => handleDeleteProject(e, project)}
                        />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
