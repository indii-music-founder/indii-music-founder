import { GenAI } from '@/services/ai/GenAI';
import { logger } from '@/utils/logger';
import { JSONSchemaObject } from '@/services/agent/instruments/InstrumentTypes';
import { AI_MODELS } from '@/core/config/ai-models';
import { db } from '../../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getFineTunedModel } from '../fine-tuned-models';
import type { ValidAgentId } from '../types';

export interface TraceMessage {
    role: 'user' | 'model' | 'system' | 'tool';
    content: string;
}

export interface AutoraterScore {
    goalCompletion: number; // 0-10
    adherence: number;      // 0-10
    coherence: number;      // 0-10
    toolEfficiency: number; // 0-10
    reasoning: string;      // Explanation for the scores
    overallPass: boolean;   // Whether the trace is acceptable
}

export class MultiTurnAutorater {
    /**
     * Evaluates a multi-turn conversation trace for quality and adherence.
     * Maps to GEAP Pillar 4: Optimize (Multi-turn autoraters).
     */
    static async evaluateTrace(
        traceId: string,
        messages: TraceMessage[],
        goalDescription: string,
        guidelines: string[] = []
    ): Promise<AutoraterScore | null> {
        try {
            const prompt = `
            You are an expert AI Autorater for the Gemini Enterprise Agent Platform. Your job is to evaluate a multi-turn conversation trace between a user and an AI agent.
            
            Goal of the conversation:
            ${goalDescription}
            
            Guidelines the agent must follow:
            ${guidelines.length > 0 ? guidelines.map((g, i) => `${i + 1}. ${g}`).join('\n') : 'None specified.'}
            
            Conversation Trace:
            ${messages.map(m => `[${m.role.toUpperCase()}]: ${m.content}`).join('\n\n')}
            
            Please evaluate the agent's performance and provide scores from 0 to 10 for:
            - Goal Completion
            - Adherence to Guidelines
            - Coherence & Logic
            - Tool Efficiency (Did it use tools well, without unnecessary loops?)
            
            Return the evaluation in structured JSON matching the requested schema.
            `;

            const schema: JSONSchemaObject = {
                type: 'object',
                properties: {
                    goalCompletion: { type: 'number', description: 'Score from 0-10 for goal completion' },
                    adherence: { type: 'number', description: 'Score from 0-10 for adherence to guidelines' },
                    coherence: { type: 'number', description: 'Score from 0-10 for conversation coherence' },
                    toolEfficiency: { type: 'number', description: 'Score from 0-10 for efficient tool usage' },
                    reasoning: { type: 'string', description: 'Detailed reasoning for the scores' },
                    overallPass: { type: 'boolean', description: 'Whether the trace passes the minimum quality bar' }
                },
                required: ['goalCompletion', 'adherence', 'coherence', 'toolEfficiency', 'reasoning', 'overallPass']
            };

            const result = await GenAI.generateStructuredData<AutoraterScore>(
                prompt,
                schema as Record<string, unknown>,
                undefined,
                undefined,
                AI_MODELS.TEXT.AGENT
            );

            if (!result) {
                logger.warn(`[MultiTurnAutorater] Received empty evaluation for trace ${traceId}`);
                return null;
            }

            return result;
        } catch (error) {
            logger.error(`[MultiTurnAutorater] Error evaluating trace ${traceId}:`, error);
            return null;
        }
    }

    /**
     * Evaluates a trace and automatically registers high-quality traces for fine-tuning.
     * This acts as the feedback loop for continuous agent improvement.
     */
    static async evaluateAndRegister(
        userId: string,
        agentId: ValidAgentId,
        traceId: string,
        messages: TraceMessage[],
        goalDescription: string,
        guidelines: string[] = []
    ): Promise<AutoraterScore | null> {
        const score = await this.evaluateTrace(traceId, messages, goalDescription, guidelines);
        
        // Threshold: Must pass overall and have high goal completion and efficiency
        if (score && score.overallPass && score.goalCompletion >= 8 && score.toolEfficiency >= 7) {
            await this.registerForFineTuning(userId, agentId, traceId, messages, score);
        }
        
        return score;
    }

    /**
     * Registers a high-quality trace into the fine-tuning dataset in Firestore.
     * Includes the current fine-tuned model mapping for tracking provenance.
     */
    private static async registerForFineTuning(
        userId: string,
        agentId: ValidAgentId,
        traceId: string,
        messages: TraceMessage[],
        score: AutoraterScore
    ): Promise<void> {
        try {
            const datasetRef = collection(db, 'users', userId, 'fineTuningDataset');
            const targetModel = getFineTunedModel(agentId) || 'base_model';
            
            await addDoc(datasetRef, {
                agentId,
                traceId,
                targetModel,
                score: {
                    goalCompletion: score.goalCompletion,
                    adherence: score.adherence,
                    coherence: score.coherence,
                    toolEfficiency: score.toolEfficiency,
                    reasoning: score.reasoning
                },
                messages,
                createdAt: serverTimestamp(),
                status: 'pending_export' // for the R5 jobs
            });
            logger.info(`[MultiTurnAutorater] Trace ${traceId} registered for fine-tuning (Agent: ${agentId})`);
        } catch (error) {
            logger.error(`[MultiTurnAutorater] Failed to register trace ${traceId} for fine-tuning:`, error);
        }
    }
}
