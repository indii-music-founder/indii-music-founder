import { useStore } from '@/core/store';

export const TOOL_REGISTRY: Record<string, (args: any) => Promise<string>> = {
    set_mode: async (args) => {
        // In a real implementation, this would switch the module or UI state
        return `Switched to ${args.mode} mode (Simulation).`;
    },
    update_prompt: async (args) => {
        return `Prompt updated to: "${args.text}"`;
    },
    generate_image: async (args) => {
        return `Generated ${args.count || 1} images (Simulation).`;
    },
    read_history: async () => {
        const history = useStore.getState().agentHistory;
        return history.slice(-5).map(h => `${h.role}: ${h.text.substring(0, 50)}...`).join('\n');
    }
};

export const BASE_TOOLS = `
AVAILABLE TOOLS:
1. set_mode(mode: string) - Switch studio mode.
2. update_prompt(text: string) - Write text into the prompt box.
3. generate_image(count: number) - Generate images.
4. read_history() - Read recent chat history.
`;
