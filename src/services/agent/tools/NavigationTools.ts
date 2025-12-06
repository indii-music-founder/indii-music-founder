import { useStore } from '@/core/store';

export const NavigationTools = {
    switch_module: async (args: { module: any }) => {
        try {
            useStore.getState().setModule(args.module);
            return `Navigated to module: ${args.module}`;
        } catch (error) {
            console.error("Navigation failed:", error);
            return `Failed to navigate: ${error}`;
        }
    }
};
