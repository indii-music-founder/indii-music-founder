/* eslint-disable @typescript-eslint/no-explicit-any -- Service with dynamic external data */
import { AgentContext } from './types';
import { maestroBatchingService } from './MaestroBatchingService';
import { WORKFLOW_REGISTRY, WorkflowDefinition } from './WorkflowRegistry';
import { workflowStateService } from './WorkflowStateService';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/utils/logger';

/**
 * OrchestrationService manages complex, multi-agent workflows.
 * It coordinates specialist agents to achieve high-level goals
 * using persistent state tracking and the Maestro Batching system.
 *
 * Agentic Harness Primitive #4: Workflow State Tracking
 * - Each step's completion is persisted before the next begins.
 * - Interrupted workflows can be resumed via `resumeWorkflow()`.
 */
export class OrchestrationService {

    /**
     * Executes a workflow from the registry with per-step state persistence.
     * Each step is executed sequentially and its result is persisted
     * before advancing to the next step.
     */
    async executeWorkflow(workflowId: string, context: AgentContext): Promise<string> {
        const workflow = WORKFLOW_REGISTRY[workflowId];
        if (!workflow) throw new Error(`Workflow ${workflowId} not found in registry.`);

        const userId = context.userId;
        if (!userId) throw new Error('userId is required for workflow execution.');

        const traceId = uuidv4();
        logger.info(`[Orchestration] Starting workflow: ${workflow.name} (${workflowId}), trace: ${traceId}`);

        // Create persistent execution record
        const execution = await workflowStateService.createExecution(
            userId,
            workflowId,
            workflow.steps,
            context.projectId
        );

        return this.runSteps(execution.id, workflow, context, userId, traceId);
    }

    /**
     * Resume a previously interrupted or failed workflow from its last checkpoint.
     * Skips completed steps and starts from the first planned/failed step.
     */
    async resumeWorkflow(executionId: string, context: AgentContext): Promise<string> {
        const userId = context.userId;
        if (!userId) throw new Error('userId is required for workflow resumption.');

        const execution = await workflowStateService.getExecution(userId, executionId);
        if (!execution) throw new Error(`Execution ${executionId} not found.`);

        if (execution.status === 'completed' || execution.status === 'cancelled') {
            return `Workflow ${executionId} is already ${execution.status}. No steps to resume.`;
        }

        const workflow = WORKFLOW_REGISTRY[execution.workflowId];
        if (!workflow) throw new Error(`Workflow ${execution.workflowId} not found in registry.`);

        const traceId = uuidv4();
        logger.info(`[Orchestration] Resuming workflow: ${workflow.name}, execution: ${executionId}, trace: ${traceId}`);

        return this.runSteps(executionId, workflow, context, userId, traceId);
    }

    /**
     * Core step execution loop. Processes each step sequentially,
     * persisting state after every step completion or failure.
     */
    private async runSteps(
        executionId: string,
        workflow: WorkflowDefinition,
        context: AgentContext,
        userId: string,
        traceId: string
    ): Promise<string> {
        let report = `# 🚀 Workflow Report: ${workflow.name}\n\n**Description**: ${workflow.description}\n\n---\n\n`;

        // Get current execution state to know which steps to skip
        const execution = await workflowStateService.getExecution(userId, executionId);
        if (!execution) throw new Error(`Execution ${executionId} not found.`);

        for (let i = 0; i < workflow.steps.length; i++) {
            const step = workflow.steps[i];
            if (!step) continue;

            const stepExec = execution.steps[i];
            if (!stepExec) continue;

            // Skip already completed steps (for resume scenarios)
            if (stepExec.status === 'step_complete') {
                const statusIcon = '⏭️';
                report += `## ${statusIcon} Step ${i + 1}: ${step.agentId.toUpperCase()} (skipped — already complete)\n`;
                report += `${stepExec.result || 'Previously completed'}\n\n---\n\n`;
                continue;
            }

            // Skip cancelled steps
            if (stepExec.status === 'cancelled') {
                continue;
            }

            try {
                // Mark step as executing
                await workflowStateService.markStepExecuting(userId, executionId, i);

                // Execute via Maestro Batching (single-step batch)
                const tasks = [{
                    agentId: step.agentId,
                    prompt: step.prompt,
                    description: step.prompt,
                    params: { projectId: context.projectId, traceId },
                    context,
                    priority: step.priority,
                    traceId,
                }];

                const results = await maestroBatchingService.executeBatch(tasks);
                const res: any = results[0];

                const resultText = res?.text || res?.message || 'No output';
                const success = res?.success !== false;

                if (success) {
                    // Persist step completion
                    await workflowStateService.advanceStep(userId, executionId, i, resultText);
                    const statusIcon = '✅';
                    report += `## ${statusIcon} Step ${i + 1}: ${step.agentId.toUpperCase()}\n`;
                    report += `${resultText}\n\n---\n\n`;
                } else {
                    // Persist step failure — subsequent steps remain 'planned' for resumability
                    const errorMsg = res?.error || 'Unknown error';
                    await workflowStateService.failStep(userId, executionId, i, errorMsg);
                    report += `## ❌ Step ${i + 1}: ${step.agentId.toUpperCase()} (FAILED)\n`;
                    report += `${errorMsg}\n\n---\n\n`;
                    report += `⚠️ **Workflow paused at step ${i + 1}.** Remaining steps preserved for resumption.\n`;
                    report += `Resume with execution ID: \`${executionId}\`\n`;
                    return report;
                }
            } catch (error: unknown) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                await workflowStateService.failStep(userId, executionId, i, errorMsg);
                logger.error(`[Orchestration] Step ${i} failed:`, error);
                report += `## ❌ Step ${i + 1}: ${step.agentId.toUpperCase()} (EXCEPTION)\n`;
                report += `${errorMsg}\n\n---\n\n`;
                report += `⚠️ **Workflow interrupted.** Resume with execution ID: \`${executionId}\`\n`;
                return report;
            }
        }

        report += `✅ **Orchestration Complete.** All steps processed with persistent state tracking.`;
        return report;
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
