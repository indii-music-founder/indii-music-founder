
import { GeneralistAgent } from './GeneralistAgent';
import { Logger } from '@/core/logger/Logger';
import { agentRegistry } from '../registry';

const TAG = 'debug-tools';


async function debug() {
    try {
        Logger.info(TAG, 'Attempting to instantiate GeneralistAgent...');
        const agent = new GeneralistAgent();
        Logger.info(TAG, 'Instantiated successfully. Name:', agent.name);
        
        Logger.info(TAG, 'Attempting to initialize...');
        await agent.initialize();
        Logger.info(TAG, 'Initialized successfully.');
        
        Logger.info(TAG, 'Attempting to get from registry...');
        const regAgent = await agentRegistry.getAsync('generalist');
        Logger.info(TAG, 'Registry getAsync result:', regAgent ? regAgent.name : 'undefined');
    } catch (e) {
        Logger.error('DebugTools', 'DEBUG ERROR', e);
    }
}

debug();
