import { AgentContext } from './ContextResolver';

export class AgentOrchestrator {
    determineAgent(context: AgentContext): string {
        let agentId = 'generalist';

        if (context.currentProject) {
            switch (context.currentProject.type) {
                case 'creative': agentId = 'director'; break;
                case 'music': agentId = 'music'; break;
                case 'marketing': agentId = 'campaign'; break;
                case 'legal': agentId = 'legal'; break;
                case 'publicist': agentId = 'publicist'; break;
                case 'brand': agentId = 'brand'; break;
                case 'road': agentId = 'road'; break;
                default: agentId = 'generalist';
            }
        } else {
            // Fallback: Use current module if no project is selected
            switch (context.currentModule) {
                case 'marketing': agentId = 'campaign'; break;
                case 'road': agentId = 'road'; break;
                // Add other module mappings as needed
                default: agentId = 'generalist';
            }
        }

        return agentId;
    }
}
