import { useStore } from '@/core/store';
import type { AppSlice } from '@/core/store/slices/appSlice';
import { wrapTool } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';

export const NavigationTools: Record<string, AnyToolFunction> = {
    switch_module: wrapTool('switch_module', async (args: { module: AppSlice['currentModule'] }) => {
        useStore.getState().setModule(args.module);
        return {
            module: args.module,
            message: `Navigated to module: ${args.module}`
        };
    })
};
