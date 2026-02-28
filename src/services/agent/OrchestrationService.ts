import { AgentContext } from './types';
import { agentService } from './AgentService';
import { maestroBatchingService } from './MaestroBatchingService';
import { WORKFLOW_REGISTRY, WorkflowDefinition } from './WorkflowRegistry';
import { v4 as uuidv4 } from 'uuid';

/**
 * OrchestrationService manages complex, multi-agent workflows.
 * It coordinates specialist agents to achieve high-level goals 
 * using the Maestro Batching system for efficiency.
 */
export class OrchestrationService {

    /**
     * Executes a workflow from the registry.
     */
    async executeWorkflow(workflowId: string, context: AgentContext): Promise<string> {
        const workflow = WORKFLOW_REGISTRY[workflowId];
        if (!workflow) throw new Error(`Workflow ${workflowId} not found in registry.`);

        const traceId = uuidv4();
        console.info(`[Orchestration] Starting workflow: ${workflow.name} (${workflowId}), trace: ${traceId}`);

        let report = `# 🚀 Workflow Report: ${workflow.name}\n\n**Description**: ${workflow.description}\n\n---\n\n`;

        try {
            // Map steps to batch tasks
            const tasks = workflow.steps.map(step => ({
                agentId: step.agentId,
                prompt: step.prompt,
                description: step.prompt, // Use prompt as description for now
                params: { projectId: context.projectId, traceId },
                context,
                priority: step.priority,
                traceId
            }));

            // Execute via Maestro Batching
            console.info(`[Orchestration] Enqueuing ${tasks.length} tasks into Maestro...`);
            const results = await maestroBatchingService.executeBatch(tasks);

            // Synthesize report
            results.forEach((res: any, index: number) => {
                const step = workflow.steps[index];
                const statusIcon = res.success ? '✅' : '❌';
                report += `## ${statusIcon} Step: ${step.agentId.toUpperCase()}\n`;
                report += `${res.message || res.text || res.error || 'No output'}\n\n---\n\n`;
            });

            report += `✅ **Orchestration Complete.** All steps processed via Maestro Batching.`;
            return report;

        } catch (error: any) {
            console.error(`[Orchestration] Workflow ${workflowId} failed:`, error);
            return `❌ **Workflow Interrupted**: ${error.message}.`;
        }
    }

    /**
     * General purpose orchestration router.
     */
    async executeOrchestratedWorkflow(intent: string, context: AgentContext): Promise<string | null> {
        const lower = intent.toLowerCase();

        // Release/Campaign Workflow
        if (lower.includes('launch') && (lower.includes('campaign') || lower.includes('release'))) {
            if (!context.projectId) throw new Error("A project must be active to launch a campaign.");
            return this.executeWorkflow('CAMPAIGN_LAUNCH', context);
        }

        // Merch Drop Workflow
        if (lower.includes('merch') && (lower.includes('drop') || lower.includes('collection'))) {
            if (!context.projectId) throw new Error("A project must be active for a merch drop.");
            return this.executeWorkflow('AI_MERCH_DROP', context);
        }

        return null;
    }
}

export const orchestrationService = new OrchestrationService();
