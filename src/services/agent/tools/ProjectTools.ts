import { useStore, type AppSlice } from '@/core/store';
import { wrapTool, toolError, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';

export const ProjectTools: Record<string, AnyToolFunction> = {
    create_project: wrapTool('create_project', async (args: { name: string, type: AppSlice['currentModule'], orgId?: string }) => {
        const store = useStore.getState();
        const targetOrgId = args.orgId || store.currentOrganizationId;

        if (!targetOrgId) {
            return toolError("No active organization found. Please switch to or create an organization first.", "ORG_REQUIRED");
        }

        const projectId = await store.createNewProject(args.name, args.type, targetOrgId);

        return toolSuccess({
            projectId,
            name: args.name,
            type: args.type
        }, `Project created successfully. ID: ${projectId}`);
    }),

    list_projects: wrapTool('list_projects', async () => {
        const store = useStore.getState();
        // Ensure projects are loaded
        if (store.projects.length === 0) {
            await store.loadProjects();
        }

        const projects = useStore.getState().projects;
        if (projects.length === 0) {
            return toolSuccess({ projects: [] }, "No projects found.");
        }

        return toolSuccess({ projects }, `Found ${projects.length} projects.`);
    }),

    open_project: wrapTool('open_project', async (args: { projectId: string }) => {
        const store = useStore.getState();
        const project = store.projects.find(p => p.id === args.projectId);
        if (!project) {
            return toolError(`Project with ID ${args.projectId} not found.`, "NOT_FOUND");
        }

        store.setProject(args.projectId);
        store.setModule(project.type);
        return toolSuccess({
            projectId: args.projectId,
            projectName: project.name,
            projectType: project.type
        }, `Opened project: ${project.name}`);
    })
};
