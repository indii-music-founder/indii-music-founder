import { useStore, type AppSlice } from '@/core/store';

export const ProjectTools = {
    create_project: async (args: { name: string, type: AppSlice['currentModule'], orgId?: string }) => {
        try {
            const store = useStore.getState();
            const targetOrgId = args.orgId || store.currentOrganizationId;

            // Note: createNewProject is async in AppSlice
            const projectId = await store.createNewProject(args.name, args.type, targetOrgId);

            return `Project created successfully. ID: ${projectId}`;
        } catch (error: unknown) {
            console.error("Tool execution failed:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            return `Failed to create project: ${errorMessage}`;
        }
    },

    list_projects: async () => {
        const store = useStore.getState();
        // Ensure projects are loaded
        if (store.projects.length === 0) {
            await store.loadProjects();
        }

        const projects = useStore.getState().projects;
        if (projects.length === 0) return "No projects found.";

        return projects.map(p => `- ${p.name} (${p.type}) [ID: ${p.id}]`).join('\n');
    },

    open_project: async (args: { projectId: string }) => {
        const store = useStore.getState();
        const project = store.projects.find(p => p.id === args.projectId);
        if (!project) {
            return `Project with ID ${args.projectId} not found.`;
        }

        store.setProject(args.projectId);
        store.setModule(project.type);
        return `Opened project: ${project.name}`;
    }
};
