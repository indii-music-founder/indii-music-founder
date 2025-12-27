import { useStore } from '@/core/store';
import type { AppSlice } from '@/core/store/slices/appSlice';

export const NavigationTools = {
    switch_module: async (args: { module: AppSlice['currentModule'] }) => {
        try {
            useStore.getState().setModule(args.module);
            return `Navigated to module: ${args.module}`;
        } catch (error: unknown) {
            console.error("Navigation failed:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            return `Failed to navigate: ${errorMessage}`;
        }
    }
};
