import { genkit } from 'genkit';
import { z } from 'zod';
import { useStore } from '@/core/store';

const ai = genkit({});

export const navigateTool = ai.defineTool(
    {
        name: 'navigate',
        description: 'Navigates the user to a specific module or section of the application.',
        inputSchema: z.object({
            module: z.enum([
                'dashboard', 'creative', 'legal', 'music', 'marketing',
                'video', 'workflow', 'knowledge', 'road', 'brand',
                'publicist', 'social', 'select-org'
            ]).describe('The module to navigate to')
        }),
        outputSchema: z.boolean()
    },
    async ({ module }: { module: any }) => {
        useStore.getState().setModule(module);
        return true;
    }
);

export const navigationTools = [navigateTool];
