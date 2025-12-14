import { useStore } from '@/core/store';
import type { ToolFunctionArgs, AgentContext } from '../types';

// ============================================================================
// Types for CoreTools
// ============================================================================

type ModuleId = 'creative' | 'legal' | 'music' | 'marketing' | 'video' | 'workflow' | 'dashboard' | 'knowledge' | 'road' | 'brand' | 'publicist' | 'social' | 'select-org';

interface CreateProjectArgs extends ToolFunctionArgs {
    name: string;
    type: 'creative' | 'music' | 'marketing' | 'legal';
}

interface SwitchModuleArgs extends ToolFunctionArgs {
    module: string;
}

interface OpenProjectArgs extends ToolFunctionArgs {
    projectId: string;
}

interface DelegateTaskArgs extends ToolFunctionArgs {
    agent_id: string;
    task: string;
    context?: AgentContext;
}

interface RequestApprovalArgs extends ToolFunctionArgs {
    content: string;
    type?: string;
}

interface SetModeArgs extends ToolFunctionArgs {
    mode: string;
}

interface UpdatePromptArgs extends ToolFunctionArgs {
    text: string;
}

const VALID_MODULES: ModuleId[] = ['creative', 'legal', 'music', 'marketing', 'video', 'workflow', 'dashboard', 'knowledge', 'road', 'brand', 'publicist', 'social', 'select-org'];

function isValidModule(module: string): module is ModuleId {
    return VALID_MODULES.includes(module as ModuleId);
}

// ============================================================================
// CoreTools Implementation
// ============================================================================

export const CoreTools = {
    create_project: async (args: CreateProjectArgs): Promise<string> => {
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

    list_projects: async (): Promise<string> => {
        const { projects, currentOrganizationId } = useStore.getState();
        const orgProjects = projects.filter(p => p.orgId === currentOrganizationId);

        if (orgProjects.length === 0) {
            return "No projects found in this organization.";
        }

        return orgProjects.map(p => `- ${p.name} (${p.type}) [ID: ${p.id}]`).join('\n');
    },

    switch_module: async (args: SwitchModuleArgs): Promise<string> => {
        if (isValidModule(args.module)) {
            useStore.getState().setModule(args.module);
            return `Switched to ${args.module} module.`;
        }
        return `Invalid module. Available: ${VALID_MODULES.join(', ')}`;
    },

    open_project: async (args: OpenProjectArgs): Promise<string> => {
        try {
            const store = useStore.getState();
            const project = store.projects.find(p => p.id === args.projectId);
            if (!project) {
                return `Error: Project with ID ${args.projectId} not found.`;
            }
            store.setProject(args.projectId);
            store.setModule(project.type as ModuleId);
            return `Opened project "${project.name}" (${project.type}) and switched module.`;
        } catch (e: unknown) {
            if (e instanceof Error) {
                return `Failed to open project: ${e.message}`;
            }
            return `Failed to open project: An unknown error occurred.`;
        }
    },

    delegate_task: async (args: DelegateTaskArgs): Promise<string> => {
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

    request_approval: async (args: RequestApprovalArgs): Promise<string> => {
        return `[APPROVAL REQUESTED] Content: "${args.content}". Please wait for user confirmation. (Note: UI integration pending)`;
    },

    set_mode: async (args: SetModeArgs): Promise<string> => {
        return `Switched to ${args.mode} mode (Simulation).`;
    },

    update_prompt: async (args: UpdatePromptArgs): Promise<string> => {
        return `Prompt updated to: "${args.text}"`;
    }
};
