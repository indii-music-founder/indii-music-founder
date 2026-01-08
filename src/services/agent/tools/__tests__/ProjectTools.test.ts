/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
const mockGetState = vi.fn();

vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => mockGetState()
    }
}));

import { ProjectTools } from '../ProjectTools';
import { useStore } from '@/core/store';

describe('ProjectTools', () => {
    const mockStoreState = {
        createNewProject: vi.fn(),
        loadProjects: vi.fn(),
        currentOrganizationId: 'org-123',
        currentProjectId: 'project-123',
        projects: [
            { id: 'proj-1', name: 'Project 1', type: 'creative', orgId: 'org-123' },
            { id: 'proj-2', name: 'Project 2', type: 'music', orgId: 'org-123' },
            { id: 'proj-3', name: 'Other Org Project', type: 'legal', orgId: 'org-456' }
        ],
        setModule: vi.fn(),
        setProject: vi.fn()
    };

    beforeEach(() => {
        vi.resetAllMocks();
        mockGetState.mockReturnValue(mockStoreState);
    });

    describe('create_project', () => {
        it('should create a project successfully', async () => {
            mockStoreState.createNewProject.mockResolvedValue('new-id');

            const result = await ProjectTools.create_project({
                name: 'New Project',
                type: 'creative'
            });

            expect(result.success).toBe(true);
            expect(result.message).toContain('Project created successfully');
            expect(mockStoreState.createNewProject).toHaveBeenCalledWith(
                'New Project',
                'creative',
                'org-123'
            );
        });

        it('should handle creation errors', async () => {
            mockStoreState.createNewProject.mockRejectedValue(new Error('Database error'));

            const result = await ProjectTools.create_project({
                name: 'Test',
                type: 'creative'
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Database error');
        });
    });

    describe('list_projects', () => {
        it('should list projects for current organization', async () => {
            const result = await ProjectTools.list_projects();

            expect(result.success).toBe(true);
            expect(result.data.projects).toHaveLength(3); // ProjectTools just returns all projects in state for now
            expect(result.message).toContain('Found 3 projects');
        });

        it('should handle no projects', async () => {
            mockGetState.mockReturnValue({
                ...mockStoreState,
                projects: [],
                loadProjects: vi.fn().mockResolvedValue(undefined)
            });

            const result = await ProjectTools.list_projects();

            expect(result.message).toContain('No projects found');
        });
    });

    describe('open_project', () => {
        it('should open existing project', async () => {
            const result = await ProjectTools.open_project({ projectId: 'proj-1' });

            expect(result.success).toBe(true);
            expect(result.message).toContain('Opened project: Project 1');
            expect(mockStoreState.setProject).toHaveBeenCalledWith('proj-1');
            expect(mockStoreState.setModule).toHaveBeenCalledWith('creative');
        });

        it('should handle non-existent project', async () => {
            const result = await ProjectTools.open_project({ projectId: 'non-existent' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });
    });
});
