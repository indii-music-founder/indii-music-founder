import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectList } from './ProjectList';
import type { ProjectMetadata } from '@/services/dashboard/DashboardService';

const { syncProject, setModule, setProjectStatus, updateProjectName, getState } = vi.hoisted(() => ({
  syncProject: vi.fn(),
  setModule: vi.fn(),
  setProjectStatus: vi.fn(),
  updateProjectName: vi.fn(),
  getState: vi.fn(),
}));

vi.mock('@/core/store', () => ({
  useStore: Object.assign((selector: (state: unknown) => unknown) => selector(getState()), { getState }),
}));
vi.mock('@/hooks/useProjectSync', () => ({ useProjectSync: () => ({ syncProject }) }));
vi.mock('firebase/auth', () => ({ getAuth: () => ({ currentUser: null }) }));

const project = (id: string, name: string, status: ProjectMetadata['status'] = 'active'): ProjectMetadata => ({
  id,
  name,
  status,
  type: 'creative',
  orgId: 'org',
  lastModified: 0,
  assetCount: 0,
});

describe('ProjectList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getState.mockReturnValue({
      projects: [project('video', 'Test Music Video'), project('mix', 'Studio Mix'), project('poster', 'Poster', 'archived')],
      currentProjectId: 'video',
      currentModule: 'project-canvas',
      setModule,
      setProject: syncProject,
      setProjectStatus,
      updateProjectName,
    });
  });

  it('opens a named project from the keyboard and identifies the current project', async () => {
    const user = userEvent.setup();
    render(<ProjectList isSidebarOpen />);

    await user.tab();
    expect(screen.getByRole('button', { name: 'Projects' })).toHaveFocus();
    await user.keyboard('{Enter}');
    const open = screen.getByRole('button', { name: 'Open project Test Music Video' });
    expect(open).toHaveAttribute('aria-current', 'true');
    await user.tab();
    expect(screen.getByRole('button', { name: 'Create project' })).toHaveFocus();
    await user.tab();
    expect(open).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(syncProject).toHaveBeenCalledWith('video');
    expect(setModule).toHaveBeenCalledWith('project-canvas');
  });

  it('opens a named inline archive confirmation and selects a different active project after archiving', async () => {
    const user = userEvent.setup();
    render(<ProjectList isSidebarOpen />);

    await user.click(screen.getByRole('button', { name: 'Projects' }));
    await user.click(screen.getByRole('button', { name: 'Archive project Test Music Video' }));
    const confirm = screen.getByRole('button', { name: 'Confirm archive for Test Music Video' });
    expect(confirm).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(setProjectStatus).toHaveBeenCalledWith('video', 'archived');
    await waitFor(() => expect(syncProject).toHaveBeenCalledWith('mix'));
    expect(setModule).not.toHaveBeenCalled();
  });

  it('returns focus to the archive action when confirmation is cancelled', async () => {
    const user = userEvent.setup();
    render(<ProjectList isSidebarOpen />);

    await user.click(screen.getByRole('button', { name: 'Projects' }));
    await user.click(screen.getByRole('button', { name: 'Archive project Test Music Video' }));
    await user.tab();
    expect(screen.getByRole('button', { name: 'Cancel archive for Test Music Video' })).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('button', { name: 'Archive project Test Music Video' })).toHaveFocus();
    expect(setProjectStatus).not.toHaveBeenCalled();
  });

  it('restores a named archived project without opening it', async () => {
    const user = userEvent.setup();
    render(<ProjectList isSidebarOpen />);

    await user.click(screen.getByRole('button', { name: 'Projects' }));
    const archived = screen.getByRole('button', { name: 'Archived (1)' });
    expect(archived).toHaveAttribute('aria-expanded', 'false');
    await user.click(archived);
    expect(archived).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('button', { name: 'Restore project Poster' }));
    expect(setProjectStatus).toHaveBeenCalledWith('poster', 'active');
    expect(syncProject).not.toHaveBeenCalled();
  });
});
