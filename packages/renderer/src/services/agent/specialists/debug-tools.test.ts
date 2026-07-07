
import { it, expect } from 'vitest';
import { importWithRetry } from '@/utils/dynamicImport';

it('should debug tools and GeneralistAgent', async () => {
    try {
        console.log('Attempting to import tools.ts...');
        const tools = await importWithRetry(() => import('../tools'));
        console.log('Imported tools successfully. Tool count:', Object.keys(tools.TOOL_REGISTRY).length);
        
        // Try to initialize GeneralistAgent now
        const { GeneralistAgent } = await importWithRetry(() => import('./GeneralistAgent'));
        const agent = new GeneralistAgent();
        console.log('Instantiating GeneralistAgent...');
        await agent.initialize();
        console.log('GeneralistAgent initialized.');
        expect(agent).toBeDefined();
    } catch (e: any) {
        console.error('DEBUG ERROR:', e);
        console.error('STACK:', e.stack);
        throw e;
    }
}, 60000);
