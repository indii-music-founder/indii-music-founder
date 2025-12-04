import { useStore } from '@/core/store';

export const CoreTools = {
    create_project: async (args: { name: string, type: 'creative' | 'music' | 'marketing' | 'legal' }) => {
        try {
            const { createNewProject, currentOrganizationId } = useStore.getState();
            await createNewProject(args.name, args.type || 'creative', currentOrganizationId);
            return `Successfully created project "${args.name}" (${args.type}) and switched to it.`;
        } catch (e: unknown) {
            if (e instanceof Error) {
                return `Failed to create project: ${e.message}`;
            }
            return `Failed to create project: An unknown error occurred.`;
        }
    },
    list_projects: async () => {
        const { projects, currentOrganizationId } = useStore.getState();
        const orgProjects = projects.filter(p => p.orgId === currentOrganizationId);

        if (orgProjects.length === 0) {
            return "No projects found in this organization.";
        }

        return orgProjects.map(p => `- ${p.name} (${p.type}) [ID: ${p.id}]`).join('\n');
    },
    switch_module: async (args: { module: string }) => {
        const validModules = ['creative', 'legal', 'music', 'marketing', 'video', 'workflow', 'dashboard', 'knowledge', 'road', 'brand', 'publicist', 'social', 'select-org'];
        if (validModules.includes(args.module)) {
            useStore.getState().setModule(args.module as any);
            return `Switched to ${args.module} module.`;
        }
        return `Invalid module. Available: ${validModules.join(', ')}`;
    },
    open_project: async (args: { projectId: string }) => {
        try {
            const store = useStore.getState();
            const project = store.projects.find(p => p.id === args.projectId);
            if (!project) {
                return `Error: Project with ID ${args.projectId} not found.`;
            }
            store.setProject(args.projectId);
            store.setModule(project.type);
            return `Opened project "${project.name}" (${project.type}) and switched module.`;
        } catch (e: any) {
            return `Failed to open project: ${e.message}`;
        }
    },
    delegate_task: async (args: { agent_id: string, task: string, context?: any }) => {
        try {
            const { agentRegistry } = await import('../registry');
            const agent = agentRegistry.get(args.agent_id);

            if (!agent) {
                return `Error: Agent '${args.agent_id}' not found. Available: ${agentRegistry.listCapabilities()}`;
            }

            const response = await agent.execute(args.task, args.context);
            return `[${agent.name}]: ${response.text}`;
        } catch (e: unknown) {
            if (e instanceof Error) {
                return `Delegation failed: ${e.message}`;
            }
            return `Delegation failed: An unknown error occurred.`;
        }
    },
    request_approval: async (args: { content: string, type?: string }) => {
        return `[APPROVAL REQUESTED] Content: "${args.content}". Please wait for user confirmation. (Note: UI integration pending)`;
    },
    set_mode: async (args: any) => {
        return `Switched to ${args.mode} mode (Simulation).`;
    },
    update_prompt: async (args: any) => {
        return `Prompt updated to: "${args.text}"`;
    }
};
