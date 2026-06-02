import { logger } from '@/utils/logger';
import { workflowStateService } from '../WorkflowStateService';
import { WorkflowStepStatusEnum, normalizeWorkflowStepStatus } from '@indii/shared';
import { ArmorViolation } from './ModelArmor';

export interface OptimizationSuggestion {
    id: string;
    agentId: string;
    type: 'prompt_tweak' | 'tool_clarification' | 'routing_adjustment';
    description: string;
    impactScore: number; // 0-100
    createdAt: number;
}

export interface AgentMetrics {
    totalInvocations: number;
    successCount: number;
    failureCount: number;
    averageLatencyMs: number;
    shieldTriggers: number;
}

export class AgentOptimizer {

    private metricsCache: Record<string, AgentMetrics> = {};

    /**
     * Analyzes historical workflow execution performance to generate optimization suggestions.
     * GEAP Optimization Primitive.
     */
    async analyzePerformance(userId: string): Promise<OptimizationSuggestion[]> {
        logger.info(`[AgentOptimizer] Analyzing historical performance for user ${userId}`);

        const suggestions: OptimizationSuggestion[] = [];

        try {
            const allExecutions = await workflowStateService.getExecutionsByUser(userId);

            // Build metrics per agent locally for this analysis to prevent cross-run state corruption
            const localMetrics: Record<string, AgentMetrics> = {};

            for (const execution of allExecutions) {
                const steps = Object.values(execution.steps);
                for (const step of steps) {
                    if (!step) continue;
                    let metrics = localMetrics[step.agentId];
                    if (!metrics) {
                        metrics = {
                            totalInvocations: 0,
                            successCount: 0,
                            failureCount: 0,
                            averageLatencyMs: 0,
                            shieldTriggers: this.metricsCache[step.agentId]?.shieldTriggers || 0
                        };
                        localMetrics[step.agentId] = metrics;
                    }

                    const status = normalizeWorkflowStepStatus(step.status);
                    metrics.totalInvocations++;
                    if (status === WorkflowStepStatusEnum.enum.STEP_COMPLETE) metrics.successCount++;
                    if (status === WorkflowStepStatusEnum.enum.FAILED) metrics.failureCount++;
                }
            }

            // Also include any agents that only have shield triggers but no executions in this batch
            for (const [agentId, cached] of Object.entries(this.metricsCache)) {
                if (!localMetrics[agentId] && cached.shieldTriggers > 0) {
                     localMetrics[agentId] = {
                         totalInvocations: 0,
                         successCount: 0,
                         failureCount: 0,
                         averageLatencyMs: 0,
                         shieldTriggers: cached.shieldTriggers
                     };
                }
            }

            // Generate suggestions based on metrics
            for (const [agentId, metrics] of Object.entries(localMetrics)) {
                if (metrics.totalInvocations === 0 && metrics.shieldTriggers === 0) continue;

                const failureRate = metrics.totalInvocations > 0 ? metrics.failureCount / metrics.totalInvocations : 0;

                if (failureRate > 0.3) {
                    suggestions.push({
                        id: `opt_${Date.now()}_${agentId}`,
                        agentId,
                        type: 'prompt_tweak',
                        description: `Agent [${agentId}] has a ${Math.round(failureRate * 100)}% failure rate. Consider simplifying its system prompt or adding robust error handling.`,
                        impactScore: 85,
                        createdAt: Date.now()
                    });
                }

                if (metrics.shieldTriggers > 0) {
                     suggestions.push({
                        id: `opt_${Date.now()}_${agentId}_shield`,
                        agentId,
                        type: 'tool_clarification',
                        description: `Agent [${agentId}] triggered Model Armor shields ${metrics.shieldTriggers} times. Review input validation or strict tool schema definitions.`,
                        impactScore: 70,
                        createdAt: Date.now()
                    });
                }
            }

        } catch (error) {
            logger.error(`[AgentOptimizer] Failed to analyze performance:`, error);
        }

        return suggestions;
    }

    /**
     * Record a Model Armor shield trigger for an agent.
     */
    recordShieldTrigger(agentId: string, violations: ArmorViolation[]) {
        if (!this.metricsCache[agentId]) {
            this.metricsCache[agentId] = {
                totalInvocations: 0,
                successCount: 0,
                failureCount: 0,
                averageLatencyMs: 0,
                shieldTriggers: 0
            };
        }
        this.metricsCache[agentId].shieldTriggers += violations.length;
        logger.debug(`[AgentOptimizer] Recorded ${violations.length} shield triggers for ${agentId}.`);
    }
}

export const agentOptimizer = new AgentOptimizer();
