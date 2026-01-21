import { useStore, type AppSlice } from '@/core/store';
import { wrapTool, toolError, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction, AgentContext } from '../types';
import type { ToolExecutionContext } from '../ToolExecutionContext';

export const ProjectTools: Record<string, AnyToolFunction> = {
    create_project: wrapTool('create_project', async (args: { name: string, type: AppSlice['currentModule'], orgId?: string }, _context?: AgentContext, toolContext?: ToolExecutionContext) => {
        const store = useStore.getState();

        // Phase 3.6: Read state through execution context when available
        const currentOrganizationId = toolContext
            ? toolContext.get('currentOrganizationId')
            : store.currentOrganizationId;

        const targetOrgId = args.orgId || currentOrganizationId;

        if (!targetOrgId) {
            return toolError("No active organization found. Please switch to or create an organization first.", "ORG_REQUIRED");
        }

        // Mutations still go through store actions (not in execution context scope)
        const projectId = await store.createNewProject(args.name, args.type, targetOrgId);

        return toolSuccess({
            projectId,
            name: args.name,
            type: args.type
        }, `Project created successfully. ID: ${projectId}`);
    }),

    list_projects: wrapTool('list_projects', async (_args, _context?: AgentContext, toolContext?: ToolExecutionContext) => {
        const store = useStore.getState();

        // Phase 3.6: Read state through execution context when available
        const projects = toolContext
            ? toolContext.get('projects')
            : store.projects;

        // Ensure projects are loaded if empty
        if (projects.length === 0) {
            await store.loadProjects();
            // Re-read after loading
            const loadedProjects = toolContext
                ? toolContext.get('projects')
                : useStore.getState().projects;

            if (loadedProjects.length === 0) {
                return toolSuccess({ projects: [] }, "No projects found.");
            }

            return toolSuccess({ projects: loadedProjects }, `Found ${loadedProjects.length} projects.`);
        }

        return toolSuccess({ projects }, `Found ${projects.length} projects.`);
    }),

    open_project: wrapTool('open_project', async (args: { projectId: string }, _context?: AgentContext, toolContext?: ToolExecutionContext) => {
        const store = useStore.getState();

        // Phase 3.6: Read state through execution context when available
        const projects = toolContext
            ? toolContext.get('projects')
            : store.projects;

        const project = projects.find(p => p.id === args.projectId);
        if (!project) {
            return toolError(`Project with ID ${args.projectId} not found.`, "NOT_FOUND");
        }

        // Mutations still go through store actions
        store.setProject(args.projectId);
        store.setModule(project.type);

        return toolSuccess({
            projectId: args.projectId,
            projectName: project.name,
            projectType: project.type
        }, `Opened project: ${project.name}`);
    })
};
