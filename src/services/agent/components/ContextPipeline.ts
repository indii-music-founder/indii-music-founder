import { ContextResolver, AgentContext } from './ContextResolver';
import { HistoryManager } from './HistoryManager';

export interface PipelineContext extends AgentContext {
    chatHistory: string;
}

export class ContextPipeline {
    private resolver: ContextResolver;
    private historyManager: HistoryManager;

    constructor() {
        this.resolver = new ContextResolver();
        this.historyManager = new HistoryManager();
    }

    async buildContext(): Promise<PipelineContext> {
        // 1. Fetch State (The "Working Context")
        const stateContext = await this.resolver.resolveContext();

        // 2. Fetch History (The "Session")
        const chatHistory = this.historyManager.getCompiledView();

        // 3. Assemble Pipeline Context
        return {
            ...stateContext,
            chatHistory
        };
    }
}
