import { genkit } from 'genkit';
import { z } from 'zod';
import { useStore } from '@/core/store';

const ai = genkit({});

export const createProjectTool = ai.defineTool(
    {
        name: 'createProject',
        description: 'Creates a new project with the specified name and type.',
        inputSchema: z.object({
            name: z.string().describe('The name of the project'),
            type: z.enum(['creative', 'legal', 'music', 'marketing', 'video', 'workflow', 'knowledge', 'road', 'brand', 'publicist', 'social']).describe('The type of project module'),
            orgId: z.string().optional().describe('The organization ID to create the project in. Defaults to current org.')
        }),
        outputSchema: z.object({
            projectId: z.string(),
            success: z.boolean()
        })
    },
    async ({ name, type, orgId }: { name: string, type: any, orgId?: string }) => {
        try {
            const store = useStore.getState();
            const targetOrgId = orgId || store.currentOrganizationId;

            // We need to call the store action. 
            // Note: createNewProject is async in AppSlice
            const projectId = await store.createNewProject(name, type, targetOrgId);

            return { projectId, success: true };
        } catch (error) {
            console.error("Tool execution failed:", error);
            throw new Error(`Failed to create project: ${error}`);
        }
    }
);

export const listProjectsTool = ai.defineTool(
    {
        name: 'listProjects',
        description: 'Lists all projects available to the current user.',
        inputSchema: z.object({}),
        outputSchema: z.object({
            projects: z.array(z.object({
                id: z.string(),
                name: z.string(),
                type: z.string(),
                date: z.number()
            }))
        })
    },
    async () => {
        const store = useStore.getState();
        // Ensure projects are loaded
        if (store.projects.length === 0) {
            await store.loadProjects();
        }
        return { projects: useStore.getState().projects };
    }
);

export const openProjectTool = ai.defineTool(
    {
        name: 'openProject',
        description: 'Opens a specific project by ID.',
        inputSchema: z.object({
            projectId: z.string().describe('The ID of the project to open')
        }),
        outputSchema: z.boolean()
    },
    async ({ projectId }: { projectId: string }) => {
        const store = useStore.getState();
        const project = store.projects.find(p => p.id === projectId);
        if (!project) {
            throw new Error(`Project with ID ${projectId} not found.`);
        }

        store.setProject(projectId);
        store.setModule(project.type);
        return true;
    }
);

export const projectTools = [createProjectTool, listProjectsTool, openProjectTool];
