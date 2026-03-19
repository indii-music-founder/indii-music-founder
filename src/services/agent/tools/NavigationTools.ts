// useStore removed
import type { AppSlice } from '@/core/store/slices/appSlice';
import { wrapTool } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';

export const NavigationTools = {
    switch_module: wrapTool('switch_module', async (args: { module: AppSlice['currentModule'] }) => {
        const { useStore } = await import('@/core/store');
        useStore.getState().setModule(args.module);
        return {
            module: args.module,
            message: `Navigated to module: ${args.module}`
        };
    })
} satisfies Record<string, AnyToolFunction>;
