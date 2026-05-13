
import { GeneralistAgent } from './GeneralistAgent';
import { agentRegistry } from '../registry';

async function debug() {
    try {
        console.log('Attempting to instantiate GeneralistAgent...');
        const agent = new GeneralistAgent();
        console.log('Instantiated successfully. Name:', agent.name);
        
        console.log('Attempting to initialize...');
        await agent.initialize();
        console.log('Initialized successfully.');
        
        console.log('Attempting to get from registry...');
        const regAgent = await agentRegistry.getAsync('generalist');
        console.log('Registry getAsync result:', regAgent ? regAgent.name : 'undefined');
    } catch (e) {
        console.error('DEBUG ERROR:', e);
    }
}

debug();
