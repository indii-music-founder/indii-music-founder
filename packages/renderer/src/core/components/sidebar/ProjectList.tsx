import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '@/core/store';
import { DEFAULT_PROJECT_ID } from '@/core/constants';
import { navigateToModule } from '@/services/agent/tools/navigationOutcome';
import { FolderGit2, Plus, ChevronDown, Pencil, Check, X, Archive, ArchiveRestore } from 'lucide-react';
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

  const { syncProject } = useProjectSync();

  const [isOpen, setIsOpen] = React.useState(false);
  const [isArchivesOpen, setIsArchivesOpen] = React.useState(false);
  const [isLoading, setLoading] = useState(false);
  const [pendingRename, setPendingRename] = useState<{ id: string; name: string } | null>(null);
  const [pendingArchive, setPendingArchive] = useState<string | null>(null);
  const restoreArchiveFocus = useRef<string | null>(null);
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

  const handleCreateProject = async () => {
    setIsOpen(true);
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

  const handleRenameProject = (project: ProjectMetadata) => {
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

  const handleArchiveProject = (project: ProjectMetadata) => {
    if (project.name === 'Inbox') return;
    setPendingArchive(project.id);
  };

  const commitArchive = async (project: ProjectMetadata) => {
    try {
      await setProjectStatus(project.id, 'archived');
      const current = useStore.getState();
      if (current.currentProjectId === project.id) {
        const remaining = current.projects.filter(p => p.id !== project.id && p.status !== 'archived');
        const nextProject = remaining.find(p => p.name === 'Inbox') ?? remaining[0];
        current.setProject(nextProject?.id ?? DEFAULT_PROJECT_ID);
      }
    } catch (err) {
      Logger.error('ProjectList', 'Failed to archive project', err);
    } finally {
      setPendingArchive(null);
    }
  };

  const handleUnarchive = async (project: ProjectMetadata) => {
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
    const isConfirmingArchive = pendingArchive === project.id;

    if (isConfirmingArchive && !isArchivedList) {
      return (
        <div key={`${project.id}-archive-confirmation`} className="w-[calc(100%-8px)] mx-1 flex items-center gap-1 px-3 py-2 text-xs rounded-lg bg-red-900/30 border border-red-500/30 mb-0.5">
          <span className="flex-1 text-red-300 truncate">Archive "{project.name}"?</span>
          <button
            type="button"
            autoFocus
            onClick={() => void commitArchive(project)}
            className="rounded p-1 text-red-400 hover:text-red-300 focus-visible:ring-2 focus-visible:ring-red-300"
            aria-label={`Confirm archive for ${project.name}`}
          >
            <Check size={12} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => {
              restoreArchiveFocus.current = project.id;
              setPendingArchive(null);
            }}
            className="rounded p-1 text-gray-400 hover:text-gray-200 focus-visible:ring-2 focus-visible:ring-white"
            aria-label={`Cancel archive for ${project.name}`}
          >
            <X size={12} aria-hidden="true" />
          </button>
        </div>
      );
    }

    const projectLabel = (
      <>
        {isArchivedList ? (
          <Archive size={16} className="shrink-0 opacity-50" aria-hidden="true" />
        ) : (
          <FolderGit2 size={16} className={cn('shrink-0', isActive ? 'text-blue-400' : 'opacity-70')} aria-hidden="true" />
        )}
        {isSidebarOpen && <span className="truncate">{project.name}</span>}
      </>
    );

    return (
      <div
        key={project.id}
        className={cn(
          'relative mx-1 mb-0.5 flex w-[calc(100%-8px)] items-center gap-1 rounded-lg text-sm transition-colors group',
          isActive && !isArchivedList
            ? 'bg-white/12 font-bold text-white ring-1 ring-white/10'
            : 'font-medium text-gray-400 hover:bg-white/5 hover:text-white'
        )}
      >
        {isActive && !isArchivedList && (
          <motion.div
            layoutId="active-project-pill"
            className="pointer-events-none absolute left-0 top-0 h-full w-1 rounded-r-md bg-blue-500"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          />
        )}
        {isRenaming && isSidebarOpen ? (
          <input
            autoFocus
            aria-label={`Project name for ${project.name}`}
            className="mx-3 my-2 min-w-0 flex-1 border-b border-blue-400 bg-transparent text-sm text-white outline-none"
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onBlur={() => void commitRename(project.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void commitRename(project.id);
              if (event.key === 'Escape') setPendingRename(null);
            }}
          />
        ) : isArchivedList ? (
          <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2">{projectLabel}</div>
        ) : (
          <button
            type="button"
            aria-label={`Open project ${project.name}`}
            aria-current={isActive ? 'true' : undefined}
            onClick={() => {
              syncProject(project.id);
              void navigateToModule(useStore, 'project-canvas');
            }}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400"
          >
            {projectLabel}
          </button>
        )}

        {isSidebarOpen && !isRenaming && (
          <div className="mr-2 flex items-center gap-1 text-gray-400">
            {isArchivedList ? (
              <button
                type="button"
                aria-label={`Restore project ${project.name}`}
                title="Restore project"
                onClick={() => void handleUnarchive(project)}
                className="rounded p-1 hover:text-green-400 focus-visible:ring-2 focus-visible:ring-white"
              >
                <ArchiveRestore size={14} aria-hidden="true" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  aria-label={`Rename project ${project.name}`}
                  title="Rename project"
                  onClick={() => handleRenameProject(project)}
                  className="rounded p-1 hover:text-white focus-visible:ring-2 focus-visible:ring-white"
                >
                  <Pencil size={14} aria-hidden="true" />
                </button>
                {project.name !== 'Inbox' && (
                  <button
                    type="button"
                    aria-label={`Archive project ${project.name}`}
                    title="Archive project"
                    ref={(button) => {
                      if (button && restoreArchiveFocus.current === project.id) {
                        restoreArchiveFocus.current = null;
                        button.focus();
                      }
                    }}
                    onClick={() => handleArchiveProject(project)}
                    className="rounded p-1 hover:text-red-400 focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <Archive size={14} aria-hidden="true" />
                  </button>
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
        <div className="mb-1 flex items-center">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-expanded={isOpen}
            className="flex min-w-0 flex-1 items-center justify-between rounded px-4 py-1 text-xs font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-200 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400"
          >
            Projects
            <ChevronDown size={14} className={cn('transition-transform', isOpen && 'rotate-180')} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Create project"
            title="Create project"
            onClick={() => void handleCreateProject()}
            className="mr-2 rounded p-1 text-gray-400 hover:text-white focus-visible:ring-2 focus-visible:ring-white"
          >
            <Plus size={14} aria-hidden="true" />
          </button>
        </div>
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
                  type="button"
                  aria-expanded={isArchivesOpen}
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
