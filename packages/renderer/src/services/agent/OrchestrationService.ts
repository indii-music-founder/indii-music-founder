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

    private hasCycles(workflow: WorkflowDefinition): boolean {
        const visited = new Set<string>();
        const recursionStack = new Set<string>();

        const dfs = (nodeId: string): boolean => {
            if (recursionStack.has(nodeId)) return true;
            if (visited.has(nodeId)) return false;

            visited.add(nodeId);
            recursionStack.add(nodeId);

            const step = workflow.steps.find(s => s.id === nodeId);
            if (step && step.dependencies) {
                for (const dep of step.dependencies) {
                    if (dfs(dep)) return true;
                }
            }

            recursionStack.delete(nodeId);
            return false;
        };

        for (const step of workflow.steps) {
            if (dfs(step.id)) return true;
        }

        return false;
    }

    /**
     * Core graph execution loop. Processes parallel steps using batch execution,
     * resolving dependencies and persisting state.
     */
    private async runSteps(
        executionId: string,
        workflow: WorkflowDefinition,
        context: AgentContext,
        userId: string,
        traceId: string
    ): Promise<string> {
        if (this.hasCycles(workflow)) {
            throw new Error(`Workflow ${workflow.id} contains a cyclic dependency.`);
        }

        let report = `# 🚀 Workflow Report: ${workflow.name}\n\n**Description**: ${workflow.description}\n\n---\n\n`;

        let executing = true;
        while (executing) {
            const execution = await workflowStateService.getExecution(userId, executionId);
            if (!execution) throw new Error(`Execution ${executionId} not found.`);

            // Find all steps that are ready to run
            const readySteps = workflow.steps.filter(step => {
                const state = execution.steps[step.id];
                if (!state) return false;
                if (state.status !== 'planned' && state.status !== 'failed') return false;

                if (!step.dependencies || step.dependencies.length === 0) return true;

                // Check if all dependencies are complete or skipped
                return step.dependencies.every(depId => {
                    const depState = execution.steps[depId];
                    return depState && (depState.status === 'step_complete' || depState.status === 'skipped');
                });
            });

            if (readySteps.length === 0) {
                executing = false;
                break;
            }

            const stepsToRun = [];
            let stepsSkipped = false;

            for (const step of readySteps) {
                let shouldExecute = true;
                if (step.condition) {
                    try {
                        shouldExecute = step.condition(execution);
                    } catch (error) {
                        logger.warn(`[Orchestration] Condition evaluation threw an error for step ${step.id}, defaulting to skip`, error);
                        shouldExecute = false;
                    }
                }

                if (shouldExecute) {
                    stepsToRun.push(step);
                    await workflowStateService.markStepExecuting(userId, executionId, step.id);
                } else {
                    await workflowStateService.skipStep(userId, executionId, step.id, 'Condition not met');
                    report += `## ⏭️ Step: ${step.id} [${step.agentId.toUpperCase()}] (SKIPPED)\n`;
                    report += `Condition evaluated to false.\n\n---\n\n`;
                    stepsSkipped = true;
                }
            }

            if (stepsToRun.length === 0) {
                if (stepsSkipped) {
                    // Loop again because skipping steps may have unlocked dependent steps
                    continue;
                } else {
                    // This shouldn't happen, but just in case
                    executing = false;
                    break;
                }
            }

            const tasks = stepsToRun.map(step => ({
                agentId: step.agentId,
                prompt: step.prompt,
                description: step.prompt,
                params: { projectId: context.projectId, traceId },
                context,
                priority: step.priority,
                traceId
            }));

            try {
                const results = await maestroBatchingService.executeBatch(tasks);

                let batchFailed = false;
                for (let i = 0; i < stepsToRun.length; i++) {
                    const step = stepsToRun[i];
                    const res: any = results[i];

                    const resultText = res?.text || res?.message || 'No output';
                    const success = res?.success !== false;

                    if (success) {
                        await workflowStateService.advanceStep(userId, executionId, step.id, resultText);
                        const statusIcon = '✅';
                        report += `## ${statusIcon} Step: ${step.id} [${step.agentId.toUpperCase()}]\n`;
                        report += `${resultText}\n\n---\n\n`;
                    } else {
                        const errorMsg = res?.error || 'Unknown error';
                        await workflowStateService.failStep(userId, executionId, step.id, errorMsg);
                        report += `## ❌ Step: ${step.id} [${step.agentId.toUpperCase()}] (FAILED)\n`;
                        report += `${errorMsg}\n\n---\n\n`;
                        batchFailed = true;
                    }
                }

                if (batchFailed) {
                    report += `⚠️ **Workflow paused due to failure.** Remaining steps preserved for resumption.\n`;
                    report += `Resume with execution ID: \`${executionId}\`\n`;
                    return report;
                }
            } catch (error: unknown) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                for (const step of stepsToRun) {
                    await workflowStateService.failStep(userId, executionId, step.id, errorMsg);
                }
                logger.error(`[Orchestration] Batch failed:`, error);
                report += `## ❌ Batch Execution Failed (EXCEPTION)\n`;
                report += `${errorMsg}\n\n---\n\n`;
                report += `⚠️ **Workflow interrupted.** Resume with execution ID: \`${executionId}\`\n`;
                return report;
            }
        }

        const finalExecution = await workflowStateService.getExecution(userId, executionId);
        const allCompleteOrSkipped = Object.values(finalExecution!.steps).every(s => s.status === 'step_complete' || s.status === 'skipped');
        
        if (allCompleteOrSkipped) {
            report += `✅ **Orchestration Complete.** All graph steps processed successfully or skipped.`;
        } else {
            if (finalExecution?.status === 'cancelled') {
                 report += `🛑 **Workflow Cancelled.**`;
            } else if (finalExecution?.status !== 'failed') {
                 report += `⚠️ **Workflow stuck.** Unresolved dependencies.`;
            }
        }

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

        // indii Growth Protocol
        if (lower.includes('growth protocol') || (lower.includes('28-day') && lower.includes('frontloaded')) || lower.includes('deploy protocol')) {
            if (!context.projectId) throw new Error("A project must be active to launch the Growth Protocol.");
            return this.executeWorkflow('INDII_GROWTH_PROTOCOL', context);
        }

        return null;
    }
}

export const orchestrationService = new OrchestrationService();
