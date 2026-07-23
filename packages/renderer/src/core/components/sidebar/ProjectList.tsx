import React, { useEffect, useState } from 'react';
import { useStore } from '@/core/store';
import { FolderGit2, Plus, ChevronDown, Pencil, Trash2, Check, X, Archive, ArchiveRestore } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { getAuth } from 'firebase/auth';
import { useProjectSync } from '@/hooks/useProjectSync';
import { Logger } from '@/core/logger/Logger';
import { ProjectMetadata } from '@/services/dashboard/DashboardService';

interface ProjectListProps {
  isSidebarOpen: boolean;
}

export function ProjectList({ isSidebarOpen }: ProjectListProps) {
  const currentProjectId = useStore(state => state.currentProjectId);
  const projects = useStore(state => state.projects);
  const loadProjects = useStore(state => state.loadProjects);
  const createNewProject = useStore(state => state.createNewProject);
  const updateProjectName = useStore(state => state.updateProjectName);
  const setProjectStatus = useStore(state => state.setProjectStatus);
  const setModule = useStore(state => state.setModule);

  const { syncProject } = useProjectSync();

  const [isOpen, setIsOpen] = React.useState(true);
  const [isArchivesOpen, setIsArchivesOpen] = React.useState(false);
  const [isLoading, setLoading] = useState(false);
  const [pendingRename, setPendingRename] = useState<{ id: string; name: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    async function initProjects() {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;

      try {
        setLoading(true);
        // We ensure the inbox in the ProjectService backend when loading
        const { ProjectService } = await import('@/services/ProjectService');
        await ProjectService.ensureInbox(user.uid);
        await loadProjects();
      } catch (err) {
        Logger.error('ProjectList', 'Failed to load projects', err);
      } finally {
        setLoading(false);
      }
    }
    initProjects();
  }, [loadProjects]);

  const handleCreateProject = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newName = `Project ${projects.length + 1}`;
    try {
      const newProjectId = await createNewProject(newName, 'creative', 'personal');
      syncProject(newProjectId);
      setPendingRename({ id: newProjectId, name: newName });
      setRenameValue(newName);
    } catch (err) {
      Logger.error('ProjectList', 'Failed to create project', err);
    }
  };

  const handleRenameProject = (e: React.MouseEvent, project: ProjectMetadata) => {
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
      await updateProjectName(projectId, trimmed);
    } catch (err) {
      Logger.error('ProjectList', 'Failed to rename project', err);
    } finally {
      setPendingRename(null);
    }
  };

  const handleDeleteProject = (e: React.MouseEvent, project: ProjectMetadata) => {
    e.stopPropagation();
    if (project.name === 'Inbox') return; 
    setPendingDelete(project.id);
  };

  const commitDelete = async (project: ProjectMetadata) => {
    try {
      await setProjectStatus(project.id, 'archived');
      if (currentProjectId === project.id) {
        const defaultProj = projects.find(p => p.name === 'Inbox' && p.status !== 'archived') || projects[0];
        if (defaultProj) {
          syncProject(defaultProj.id);
        }
      }
    } catch (err) {
      Logger.error('ProjectList', 'Failed to delete project', err);
    } finally {
      setPendingDelete(null);
    }
  };

  const handleUnarchive = async (e: React.MouseEvent, project: ProjectMetadata) => {
    e.stopPropagation();
    try {
      await setProjectStatus(project.id, 'active');
    } catch (err) {
      Logger.error('ProjectList', 'Failed to unarchive project', err);
    }
  };

  const uniqueProjects = new Map<string, ProjectMetadata>();
  projects.forEach((p) => {
    if (p.name === 'Inbox' && uniqueProjects.has('Inbox')) return;
    uniqueProjects.set(p.name === 'Inbox' ? 'Inbox' : p.id, p);
  });
  const projectArray = Array.from(uniqueProjects.values());
  const activeProjects = projectArray.filter(p => p.status !== 'archived');
  const archivedProjects = projectArray.filter(p => p.status === 'archived');

  const renderProject = (project: ProjectMetadata, isArchivedList = false) => {
    const isActive = currentProjectId === project.id;
    const isRenaming = pendingRename?.id === project.id;
    const isConfirmingDelete = pendingDelete === project.id;

    if (isConfirmingDelete && !isArchivedList) {
      return (
        <div key={project.id} className="w-[calc(100%-8px)] mx-1 flex items-center gap-1 px-3 py-2 text-xs rounded-lg bg-red-900/30 border border-red-500/30 mb-0.5">
          <span className="flex-1 text-red-300 truncate">Archive "{project.name}"?</span>
          <button onClick={() => commitDelete(project)} className="p-1 hover:text-red-300 text-red-400" title="Confirm archive"><Check size={12} /></button>
          <button onClick={() => setPendingDelete(null)} className="p-1 hover:text-gray-200 text-gray-400" title="Cancel"><X size={12} /></button>
        </div>
      );
    }

    return (
      <div
        key={project.id}
        onClick={() => {
          if (isRenaming || isArchivedList) return;
          syncProject(project.id);
          setModule('files');
        }}
        className={cn(
          "w-[calc(100%-8px)] mx-1 flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all duration-200 relative group overflow-hidden mb-0.5",
          !isArchivedList && "cursor-pointer",
          isActive && !isArchivedList
            ? "text-white font-bold bg-white/12 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.15)] ring-1 ring-white/10"
            : "text-gray-400 font-medium hover:text-white hover:bg-white/5"
        )}
      >
        <div className="flex items-center gap-3 overflow-hidden flex-1">
          {isActive && !isArchivedList && (
            <motion.div
              layoutId="active-project-pill"
              className="absolute left-0 top-0 w-1 h-full bg-blue-500 rounded-r-md"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          )}
          
          {isArchivedList ? (
            <Archive size={16} className="relative z-10 shrink-0 opacity-50" />
          ) : (
            <FolderGit2
              size={16}
              className={cn(
                "relative z-10 transition-transform duration-200 shrink-0 group-hover:scale-110",
                isActive ? "text-blue-400" : "opacity-70 group-hover:opacity-100"
              )}
            />
          )}
          
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
                isActive && !isArchivedList ? "translate-x-1" : "group-hover:translate-x-0.5"
              )}>
                {project.name}
              </span>
            )
          )}
        </div>

        {isSidebarOpen && !isRenaming && (
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity relative z-10">
            {isArchivedList ? (
              <div title="Restore Project" className="flex">
                <ArchiveRestore
                  size={14}
                  className="text-gray-400 hover:text-green-400 transition-colors cursor-pointer"
                  onClick={(e) => handleUnarchive(e, project)}
                />
              </div>
            ) : (
              <>
                <Pencil
                  size={14}
                  className="text-gray-400 hover:text-white transition-colors cursor-pointer"
                  onClick={(e) => handleRenameProject(e, project)}
                />
                {project.name !== 'Inbox' && (
                  <div title="Archive Project" className="flex">
                    <Trash2
                      size={14}
                      className="text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
                      onClick={(e) => handleDeleteProject(e, project)}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

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
            {isLoading && activeProjects.length === 0 ? (
              <div className="px-4 py-2 text-xs text-gray-400">Loading...</div>
            ) : activeProjects.length === 0 ? (
              <div className="px-4 py-2 text-xs text-gray-400">No active projects</div>
            ) : (
              activeProjects.map(p => renderProject(p))
            )}

            {isSidebarOpen && archivedProjects.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={() => setIsArchivesOpen(!isArchivesOpen)}
                  className="w-full flex items-center justify-between px-4 py-1 text-xs font-semibold text-gray-500 hover:text-gray-300 tracking-wider mb-1 transition-colors"
                >
                  <span className="whitespace-nowrap flex items-center gap-2">
                    <Archive size={12} />
                    Archived ({archivedProjects.length})
                  </span>
                  <ChevronDown
                    size={14}
                    className={cn("transition-transform duration-200", isArchivesOpen ? "rotate-180" : "")}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isArchivesOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="space-y-0.5 overflow-hidden opacity-75"
                    >
                      {archivedProjects.map(p => renderProject(p, true))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
