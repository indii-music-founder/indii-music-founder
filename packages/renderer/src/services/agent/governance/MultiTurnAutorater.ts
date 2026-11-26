import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';
import { INTELLIGENCE_MODELS } from '@/core/config/intelligence-models';
import { logger } from '@/utils/logger';
import { JSONSchemaObject } from '@/services/agent/instruments/InstrumentTypes';
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

const MAX_AUTORATER_MESSAGE_CHARS = 4_000;
const MAX_AUTORATER_TRACE_CHARS = 24_000;

function stripControlChars(input: string): string {
    let out = '';
    for (let i = 0; i < input.length; i++) {
        const code = input.charCodeAt(i);
        // Preserve tab (9), LF (10), CR (13); drop other ASCII C0/DEL control codes.
        if ((code >= 32 && code !== 127) || code === 9 || code === 10 || code === 13) {
            out += input[i];
        }
    }
    return out;
}

function sanitizeAutoraterMessage(content: string): string {
    // Strip ASCII control characters (except newline/tab) and cap huge raw tool dumps
    // so evaluation prompts stay bounded and avoid WAF/token blowups (ISSUE-1711).
    const cleaned = stripControlChars(content);
    if (cleaned.length <= MAX_AUTORATER_MESSAGE_CHARS) {
        return cleaned;
    }
    return `${cleaned.slice(0, MAX_AUTORATER_MESSAGE_CHARS)}\n...[truncated ${cleaned.length - MAX_AUTORATER_MESSAGE_CHARS} chars]`;
}

function formatBoundedTrace(messages: TraceMessage[]): string {
    const formatted: string[] = [];
    let totalChars = 0;
    for (const m of messages) {
        const entry = `[${m.role.toUpperCase()}]: ${sanitizeAutoraterMessage(m.content)}`;
        if (totalChars + entry.length > MAX_AUTORATER_TRACE_CHARS) {
            const remaining = MAX_AUTORATER_TRACE_CHARS - totalChars;
            if (remaining > 64) {
                formatted.push(`${entry.slice(0, remaining)}\n...[trace truncated]`);
            }
            break;
        }
        formatted.push(entry);
        totalChars += entry.length + 2;
    }
    return formatted.join('\n\n');
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
            const boundedTrace = formatBoundedTrace(messages);
            const prompt = `
You are an expert Intelligence Autorater for the Gemini Enterprise Agent Platform. Your job is to evaluate a multi-turn conversation trace between a user and an Autonomous agent.

Goal of the conversation:
${goalDescription}

Guidelines the agent must follow:
${guidelines.length > 0 ? guidelines.map((g, i) => `${i + 1}. ${g}`).join('\n') : 'None specified.'}

Conversation Trace:
${boundedTrace}

Please evaluate the agent's performance and provide scores from 0 to 10 for:
- Goal Completion
- Adherence to Guidelines
- Coherence & Logic
- Tool Efficiency (Did it use tools well, without unnecessary loops?)

Return the evaluation in structured JSON matching the requested schema.
`.replace(/^\s+/gm, '').trim();

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

            const result = await AutonomousIntelligence.generateStructuredData<AutoraterScore>(
                prompt,
                schema as unknown as Record<string, unknown>,
                undefined,
                undefined,
                INTELLIGENCE_MODELS.TEXT.FAST
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
        // A "10/10" mindset requires high bars for automated data collection.
        if (score && score.overallPass && score.goalCompletion >= 9 && score.toolEfficiency >= 9) {
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
            const targetModel = getFineTunedModel(agentId);
            
            // Calculate quality average for easy sorting/filtering in the ADK Export phase
            const qualityAverage = (score.goalCompletion + score.adherence + score.coherence + score.toolEfficiency) / 4;

            await addDoc(datasetRef, {
                agentId,
                traceId,
                targetModel,
                qualityAverage,
                score: {
                    goalCompletion: score.goalCompletion,
                    adherence: score.adherence,
                    coherence: score.coherence,
                    toolEfficiency: score.toolEfficiency,
                    reasoning: score.reasoning
                },
                messages,
                metadata: {
                    evaluatedAt: new Date().toISOString(),
                    autoraterModel: INTELLIGENCE_MODELS.TEXT.FAST,
                    version: '1.1.0-platinum'
                },
                createdAt: serverTimestamp(),
                status: 'pending_export' // for the R5 jobs
            });
            logger.info(`[MultiTurnAutorater] Trace ${traceId} (Quality: ${qualityAverage.toFixed(1)}/10) registered for fine-tuning (Agent: ${agentId})`);
        } catch (error) {
            logger.error(`[MultiTurnAutorater] Failed to register trace ${traceId} for fine-tuning:`, error);
        }
    }
}
