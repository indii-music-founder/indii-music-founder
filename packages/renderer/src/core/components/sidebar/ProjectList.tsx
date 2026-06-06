import React, { useEffect, useState } from 'react';
import { useStore } from '@/core/store';
import { useProjectSlice } from '@/core/store/slices/projectSlice';
import { ProjectService } from '@/services/project/ProjectService';
import type { Project } from '@/services/project/ProjectService';
import { FolderGit2, Plus, ChevronDown, Pencil, Trash2, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useShallow } from 'zustand/react/shallow';
import { getAuth } from 'firebase/auth';
import { useProjectSync } from '@/hooks/useProjectSync';
import { Logger } from '@/core/logger/Logger';

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
  const [pendingRename, setPendingRename] = useState<{ id: string; name: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    async function loadProjects() {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;

      try {
        setLoading(true);
        // Ensure inbox project exists and list all active projects
        try {
          await ProjectService.ensureInbox(user.uid);
        } catch (e: unknown) {
          if (e instanceof Error && e.message.includes('A real authenticated user ID is required')) {
            Logger.warn('ProjectList', 'Skipping inbox creation for unauthenticated user');
          } else {
            throw e;
          }
        }
        const userProjects = await ProjectService.listByUser(user.uid);
        setProjects(userProjects);
      } catch (err) {
        Logger.error('ProjectList', 'Failed to load projects', err);
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

    // Use a temporary inline project with an editable name field
    const newName = `Project ${projects.size + 1}`;
    try {
      const newProject = await ProjectService.create(user.uid, newName);
      const updatedProjects = await ProjectService.listByUser(user.uid);
      setProjects(updatedProjects);
      setSelectedProject(newProject);
      syncProject(newProject.id);
      // Immediately open rename for the new project
      setPendingRename({ id: newProject.id, name: newName });
      setRenameValue(newName);
    } catch (err) {
      Logger.error('ProjectList', 'Failed to create project', err);
    }
  };

  const handleRenameProject = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setPendingRename({ id: project.id, name: project.name });
    setRenameValue(project.name);
  };

  const commitRename = async (projectId: string) => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === pendingRename?.name) {
      setPendingRename(null);
      return;
    }
    try {
      await ProjectService.update(projectId, { name: trimmed });
      const auth = getAuth();
      if (auth.currentUser) {
        const updatedProjects = await ProjectService.listByUser(auth.currentUser.uid);
        setProjects(updatedProjects);
      }
    } catch (err) {
      Logger.error('ProjectList', 'Failed to rename project', err);
    } finally {
      setPendingRename(null);
    }
  };

  const handleDeleteProject = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    if (project.name === 'Inbox') return; // Inbox cannot be deleted — silently ignore
    setPendingDelete(project.id);
  };

  const commitDelete = async (project: Project) => {
    try {
      await ProjectService.setStatus(project.id, 'archived');
      const auth = getAuth();
      if (auth.currentUser) {
        const updatedProjects = await ProjectService.listByUser(auth.currentUser.uid);
        setProjects(updatedProjects);
        if (selectedProjectId === project.id) {
          const defaultProj = updatedProjects.find((p: Project) => p.name === 'Inbox') || updatedProjects[0];
          if (defaultProj) {
            setSelectedProject(defaultProj);
            syncProject(defaultProj.id);
          }
        }
      }
    } catch (err) {
      Logger.error('ProjectList', 'Failed to delete project', err);
    } finally {
      setPendingDelete(null);
    }
  };

  // Filter out duplicate Inbox entries if the backend hasn't cleaned them up yet
  const uniqueProjects = new Map<string, Project>();
  projects.forEach((p: Project) => {
    if (p.name === 'Inbox' && uniqueProjects.has('Inbox')) return;
    uniqueProjects.set(p.name === 'Inbox' ? 'Inbox' : p.id, p);
  });
  const projectArray = Array.from(uniqueProjects.values());

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
              <div className="px-4 py-2 text-xs text-gray-400">Loading...</div>
            ) : projectArray.length === 0 ? (
              <div className="px-4 py-2 text-xs text-gray-400">No projects</div>
            ) : (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              projectArray.map((project: any) => {
                const isActive = selectedProjectId === project.id;
                const isRenaming = pendingRename?.id === project.id;
                const isConfirmingDelete = pendingDelete === project.id;

                if (isConfirmingDelete) {
                  return (
                    <div key={project.id} className="w-[calc(100%-8px)] mx-1 flex items-center gap-1 px-3 py-2 text-xs rounded-lg bg-red-900/30 border border-red-500/30 mb-0.5">
                      <span className="flex-1 text-red-300 truncate">Delete "{project.name}"?</span>
                      <button onClick={() => commitDelete(project)} className="p-1 hover:text-red-300 text-red-400" title="Confirm delete"><Check size={12} /></button>
                      <button onClick={() => setPendingDelete(null)} className="p-1 hover:text-gray-200 text-gray-400" title="Cancel"><X size={12} /></button>
                    </div>
                  );
                }

                return (
                  <div
                    key={project.id}
                    onClick={() => {
                      if (isRenaming) return;
                      setSelectedProject(project);
                      syncProject(project.id);
                      useStore.getState().setModule('files');
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
                        isRenaming ? (
                          <input
                            autoFocus
                            className="flex-1 bg-transparent border-b border-blue-400 text-white text-sm outline-none py-0.5 relative z-10"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={() => commitRename(project.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitRename(project.id);
                              if (e.key === 'Escape') setPendingRename(null);
                            }}
                          />
                        ) : (
                          <span className={cn(
                            "truncate relative z-10 transition-all duration-200",
                            isActive ? "translate-x-1" : "group-hover:translate-x-0.5"
                          )}>
                            {project.name}
                          </span>
                        )
                      )}
                    </div>

                    {isSidebarOpen && !isRenaming && (
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity relative z-10">
                        <Pencil
                          size={14}
                          className="text-gray-400 hover:text-white transition-colors"
                          onClick={(e) => handleRenameProject(e, project)}
                        />
                        {project.name !== 'Inbox' && (
                          <Trash2
                            size={14}
                            className="text-gray-400 hover:text-red-400 transition-colors"
                            onClick={(e) => handleDeleteProject(e, project)}
                          />
                        )}
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
