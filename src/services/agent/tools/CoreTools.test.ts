/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn()
    }
}));

vi.mock('../registry', () => ({
    agentRegistry: {
        get: vi.fn(),
        listCapabilities: vi.fn()
    }
}));

import { CoreTools } from './CoreTools';
import { useStore } from '@/core/store';
import { agentRegistry } from '../registry';

describe('CoreTools', () => {
    const mockStoreState = {
        createNewProject: vi.fn(),
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
        (useStore.getState as any).mockReturnValue(mockStoreState);
    });

    describe('create_project', () => {
        it('should create a project successfully', async () => {
            mockStoreState.createNewProject.mockResolvedValue(undefined);

            const result = await CoreTools.create_project({
                name: 'New Project',
                type: 'creative'
            });

            expect(result).toContain('Successfully created project "New Project"');
            expect(mockStoreState.createNewProject).toHaveBeenCalledWith(
                'New Project',
                'creative',
                'org-123'
            );
        });

        it('should use default type if not provided', async () => {
            mockStoreState.createNewProject.mockResolvedValue(undefined);

            await CoreTools.create_project({ name: 'Test' } as any);

            expect(mockStoreState.createNewProject).toHaveBeenCalledWith(
                'Test',
                'creative',
                'org-123'
            );
        });

        it('should handle creation errors', async () => {
            mockStoreState.createNewProject.mockRejectedValue(new Error('Database error'));

            const result = await CoreTools.create_project({
                name: 'Test',
                type: 'creative'
            });

            expect(result).toContain('Failed to create project: Database error');
        });
    });

    describe('list_projects', () => {
        it('should list projects for current organization', async () => {
            const result = await CoreTools.list_projects();

            expect(result).toContain('Project 1');
            expect(result).toContain('Project 2');
            expect(result).not.toContain('Other Org Project');
        });

        it('should handle no projects', async () => {
            (useStore.getState as any).mockReturnValue({
                ...mockStoreState,
                projects: []
            });

            const result = await CoreTools.list_projects();

            expect(result).toContain('No projects found');
        });

        it('should include project IDs in output', async () => {
            const result = await CoreTools.list_projects();

            expect(result).toContain('[ID: proj-1]');
            expect(result).toContain('[ID: proj-2]');
        });
    });

    describe('switch_module', () => {
        it('should switch to valid module', async () => {
            const result = await CoreTools.switch_module({ module: 'creative' });

            expect(result).toContain('Switched to creative module');
            expect(mockStoreState.setModule).toHaveBeenCalledWith('creative');
        });

        it('should reject invalid module', async () => {
            const result = await CoreTools.switch_module({ module: 'invalid-module' });

            expect(result).toContain('Invalid module');
            expect(mockStoreState.setModule).not.toHaveBeenCalled();
        });

        it('should list available modules on invalid input', async () => {
            const result = await CoreTools.switch_module({ module: 'bad' });

            expect(result).toContain('creative');
            expect(result).toContain('legal');
            expect(result).toContain('music');
        });
    });

    describe('open_project', () => {
        it('should open existing project', async () => {
            const result = await CoreTools.open_project({ projectId: 'proj-1' });

            expect(result).toContain('Opened project "Project 1"');
            expect(mockStoreState.setProject).toHaveBeenCalledWith('proj-1');
            expect(mockStoreState.setModule).toHaveBeenCalledWith('creative');
        });

        it('should switch to correct module type', async () => {
            await CoreTools.open_project({ projectId: 'proj-2' });

            expect(mockStoreState.setModule).toHaveBeenCalledWith('music');
        });

        it('should handle non-existent project', async () => {
            const result = await CoreTools.open_project({ projectId: 'non-existent' });

            expect(result).toContain('Error: Project with ID non-existent not found');
            expect(mockStoreState.setProject).not.toHaveBeenCalled();
        });
    });

    describe('delegate_task', () => {
        it('should delegate task to valid agent', async () => {
            const mockAgent = {
                name: 'Legal Agent',
                execute: vi.fn().mockResolvedValue({ text: 'Task completed' })
            };
            (agentRegistry.get as any).mockReturnValue(mockAgent);

            const result = await CoreTools.delegate_task({
                agent_id: 'legal',
                task: 'Review contract'
            });

            expect(result).toContain('[Legal Agent]: Task completed');
            expect(mockAgent.execute).toHaveBeenCalledWith('Review contract', undefined);
        });

        it('should pass context to agent', async () => {
            const mockAgent = {
                name: 'Test Agent',
                execute: vi.fn().mockResolvedValue({ text: 'Done' })
            };
            (agentRegistry.get as any).mockReturnValue(mockAgent);

            const context = { projectId: 'proj-1' };
            await CoreTools.delegate_task({
                agent_id: 'test',
                task: 'Do something',
                context
            });

            expect(mockAgent.execute).toHaveBeenCalledWith('Do something', context);
        });

        it('should handle unknown agent', async () => {
            (agentRegistry.get as any).mockReturnValue(undefined);
            (agentRegistry.listCapabilities as any).mockReturnValue('- legal\n- marketing');

            const result = await CoreTools.delegate_task({
                agent_id: 'unknown',
                task: 'Task'
            });

            expect(result).toContain("Error:");
            expect(result).toContain("not found");
        });

        it('should handle agent execution errors', async () => {
            const mockAgent = {
                name: 'Failing Agent',
                execute: vi.fn().mockRejectedValue(new Error('Agent crashed'))
            };
            (agentRegistry.get as any).mockReturnValue(mockAgent);

            const result = await CoreTools.delegate_task({
                agent_id: 'failing',
                task: 'Task'
            });

            expect(result).toContain('Delegation failed: Agent crashed');
        });
    });

    describe('request_approval', () => {
        it('should return approval request message', async () => {
            const result = await CoreTools.request_approval({
                content: 'Post this tweet'
            });

            expect(result).toContain('[APPROVAL REQUESTED]');
            expect(result).toContain('Post this tweet');
        });

        it('should include content in message', async () => {
            const result = await CoreTools.request_approval({
                content: 'Important action',
                type: 'email'
            });

            expect(result).toContain('Important action');
        });
    });

    describe('set_mode', () => {
        it('should acknowledge mode change', async () => {
            const result = await CoreTools.set_mode({ mode: 'dark' });

            expect(result).toContain('Switched to dark mode');
        });
    });

    describe('update_prompt', () => {
        it('should acknowledge prompt update', async () => {
            const result = await CoreTools.update_prompt({ text: 'New prompt text' });

            expect(result).toContain('Prompt updated to: "New prompt text"');
        });
    });
});
