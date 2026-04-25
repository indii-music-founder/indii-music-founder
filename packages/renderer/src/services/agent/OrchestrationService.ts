 
import { validateWorkflowGraph } from './WorkflowGraphUtils';
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
            workflow.edges,
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

    private async runSteps(
        executionId: string,
        workflow: WorkflowDefinition,
        context: AgentContext,
        userId: string,
        traceId: string
    ): Promise<string> {
        // Validate graph before execution to prevent cyclic dependency deadlocks
        validateWorkflowGraph(workflow);

        let report = `# 🚀 Workflow Report: ${workflow.name}\n\n**Description**: ${workflow.description}\n\n---\n\n`;

        let executing = true;
        const processedNodes = new Set<string>();

        while (executing) {
            const execution = await workflowStateService.getExecution(userId, executionId);
            if (!execution) throw new Error(`Execution ${executionId} lost during orchestration.`);

            // Find all steps that are ready to run (Graph-Based Identification)
            const readySteps = workflow.steps.filter(step => {
                const stepState = execution.steps[step.id];
                if (!stepState) return false;
                
                // Only process planned or failed (resumable) steps
                if (stepState.status !== 'planned' && stepState.status !== 'failed') return false;

                // Identify incoming edges
                const incomingEdges = workflow.edges.filter(edge => edge.to === step.id);
                
                // Roots (zero incoming edges) are immediately ready
                if (incomingEdges.length === 0) return true;

                // For non-roots, check if all upstream dependencies are resolved (complete or skipped)
                return incomingEdges.every(edge => {
                    const depState = execution.steps[edge.from];
                    return depState && (depState.status === 'step_complete' || depState.status === 'skipped');
                });
            });

            if (readySteps.length === 0) {
                // Check if we're actually done or just stuck
                const hasPending = workflow.steps.some(s => {
                    const status = execution.steps[s.id]?.status;
                    return status === 'planned' || status === 'executing' || status === 'failed';
                });
                
                if (!hasPending) {
                    logger.info(`[Orchestration] Workflow ${workflow.name} completed all reachable nodes.`);
                } else {
                    logger.warn(`[Orchestration] Workflow ${workflow.name} reached a deadlock. Unreachable pending nodes exist.`);
                }
                
                executing = false;
                break;
            }

            const stepsToRun: typeof workflow.steps = [];
            let stepsSkippedInThisIteration = false;

            for (const step of readySteps) {
                let shouldExecute = true;
                
                // Evaluate conditions on all active incoming paths
                const incomingEdges = workflow.edges.filter(edge => edge.to === step.id);
                for (const edge of incomingEdges) {
                    if (edge.condition) {
                        try {
                            // Conditions are evaluated against the current global execution state
                            if (!edge.condition(execution)) {
                                shouldExecute = false;
                                break;
                            }
                        } catch (error) {
                            logger.error(`[Orchestration] Condition failure for edge ${edge.from} -> ${edge.to}. Defaulting to skip.`, error);
                            shouldExecute = false;
                            break;
                        }
                    }
                }

                if (shouldExecute) {
                    stepsToRun.push(step);
                    await workflowStateService.markStepExecuting(userId, executionId, step.id);
                } else {
                    await workflowStateService.skipStep(userId, executionId, step.id, 'Graph condition evaluated to false');
                    report += `## ⏭️ Step: ${step.id} [${step.agentId.toUpperCase()}] (SKIPPED)\n`;
                    report += `Conditional path not taken.\n\n---\n\n`;
                    stepsSkippedInThisIteration = true;
                }
            }

            // If we only skipped steps, we immediately continue to find the next ready steps
            if (stepsToRun.length === 0) {
                if (stepsSkippedInThisIteration) continue;
                executing = false;
                break;
            }

            // Pillar 2: Maestro Batching & Parallelism
            // Convert graph steps into Maestro-compatible tasks
            const tasks = stepsToRun.map(step => ({
                agentId: step.agentId,
                prompt: step.prompt,
                description: `Workflow Step: ${step.id}`,
                params: { projectId: context.projectId, workflowId: workflow.id, traceId },
                context,
                priority: step.priority,
                traceId
            }));

            try {
                logger.info(`[Orchestration] Batching ${tasks.length} parallel steps for workflow ${workflow.id}`);
                const results = await maestroBatchingService.executeBatch(tasks);

                let batchFailed = false;
                for (let i = 0; i < stepsToRun.length; i++) {
                    const step = stepsToRun[i];
                    const res = results[i];

                    if (!step || !res) continue;

                    const resultText = res.text || res.message || 'Node executed successfully.';
                    const success = res.success !== false;

                    if (success) {
                        await workflowStateService.advanceStep(userId, executionId, step.id, resultText);
                        report += `## ✅ Step: ${step.id} [${step.agentId.toUpperCase()}]\n`;
                        report += `${resultText}\n\n---\n\n`;
                    } else {
                        const errorMsg = res.error || 'Execution failed without error message.';
                        await workflowStateService.failStep(userId, executionId, step.id, errorMsg);
                        report += `## ❌ Step: ${step.id} [${step.agentId.toUpperCase()}] (FAILED)\n`;
                        report += `${errorMsg}\n\n---\n\n`;
                        batchFailed = true;
                    }
                }

                if (batchFailed) {
                    report += `⚠️ **Workflow execution halted.** Address failures and resume via ID: \`${executionId}\`\n`;
                    return report;
                }
            } catch (error: any) {
                const errorMsg = error.message || 'Batch execution exception';
                logger.error(`[Orchestration] Critical failure in batch execution:`, error);
                
                for (const step of stepsToRun) {
                    await workflowStateService.failStep(userId, executionId, step.id, errorMsg);
                }
                
                report += `## ❌ Critical Batch Failure\n`;
                report += `${errorMsg}\n\n---\n\n`;
                return report;
            }
        }

        const finalState = await workflowStateService.getExecution(userId, executionId);
        const allDone = Object.values(finalState?.steps || {}).every(s => s.status === 'step_complete' || s.status === 'skipped');
        
        if (allDone) {
            report += `✅ **Graph Orchestration Complete.** All reachable nodes have been processed.`;
        } else if (finalState?.status === 'cancelled') {
            report += `🛑 **Workflow Cancelled.**`;
        } else {
             report += `⚠️ **Workflow terminated with unresolved nodes.** Check graph connectivity.`;
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
