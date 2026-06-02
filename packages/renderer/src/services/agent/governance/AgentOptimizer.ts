import { logger } from '@/utils/logger';
import { workflowStateService } from '../WorkflowStateService';
import { WorkflowExecutionStatusEnum, WorkflowStepStatusEnum } from '@indii/shared';
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
            
            // Build metrics per agent
            for (const execution of allExecutions) {
                const steps = Object.values(execution.steps) as any[];
                for (const step of steps) {
                    if (!step) continue;
                    let metrics = this.metricsCache[step.agentId];
                    if (!metrics) {
                        metrics = {
                            totalInvocations: 0,
                            successCount: 0,
                            failureCount: 0,
                            averageLatencyMs: 0,
                            shieldTriggers: 0
                        };
                        this.metricsCache[step.agentId] = metrics;
                    }
                    
                    metrics.totalInvocations++;
                    if (step.status === 'STEP_COMPLETE' || step.status === WorkflowStepStatusEnum.enum.STEP_COMPLETE) metrics.successCount++;
                    if (step.status === 'FAILED' || step.status === WorkflowExecutionStatusEnum.enum.FAILED) metrics.failureCount++;
                }
            }

            // Generate suggestions based on metrics
            for (const [agentId, metrics] of Object.entries(this.metricsCache)) {
                if (metrics.totalInvocations === 0) continue;
                
                const failureRate = metrics.failureCount / metrics.totalInvocations;
                
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
