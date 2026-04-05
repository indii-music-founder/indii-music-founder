/* eslint-disable @typescript-eslint/no-explicit-any -- Dynamic types: XML/IPC/observability */
import { db } from '@/services/firebase';
import { collection, doc, setDoc, updateDoc, arrayUnion, serverTimestamp, query, where, getDoc } from 'firebase/firestore';
import { AgentTrace, TraceStep, UsageMetrics } from './types';
import { MODEL_PRICING, getModelKey } from '@/core/config/ai-models';
import { cleanFirestoreData } from '@/services/utils/firebase';
import { remoteConfig } from '@/services/firebase';
import { getValue } from 'firebase/remote-config';
import { RemoteAIConfigSchema } from '@/services/ai/config/RemoteAIConfig';
import { logger } from '@/utils/logger';

export class TraceService {
    private static readonly COLLECTION = 'agent_traces';

    // Part 1: Map to track local start times for duration calculation
    private static startTimeMap: Map<string, number> = new Map();

    /**
     * Start a new execution trace
     */
    static async startTrace(
        userId: string,
        agentId: string,
        input: string,
        metadata?: Record<string, any>,
        parentTraceId?: string
    ): Promise<string> {
        if (!userId) {
            logger.warn('[TraceService] No userId provided, skipping trace.');
            return '';
        }

        try {
            if (!db) {
                logger.warn('[TraceService] DB not initialized, returning mock ID');
                return crypto.randomUUID();
            }

            const docRef = doc(collection(db, this.COLLECTION));
            const traceId = docRef?.id || crypto.randomUUID();

            // Record local start time for duration calculation
            this.startTimeMap.set(traceId, performance.now());

            const trace: Partial<AgentTrace> = {
                id: traceId,
                userId,
                agentId,
                input,
                status: 'pending',
                startTime: serverTimestamp() as unknown as import('firebase/firestore').Timestamp,

                steps: [],
                swarmId: metadata?.swarmId || (parentTraceId ? null : traceId),
                metadata: {
                    ...(metadata || {}),
                    ...(parentTraceId ? { parentTraceId } : {})
                }
            };

            await setDoc(doc(db, this.COLLECTION, traceId), cleanFirestoreData(trace));
            return traceId;
        } catch (error: unknown) {
            logger.error('[TraceService] Failed to start trace: (Non-blocking)', error);
            return crypto.randomUUID();
        }
    }

    /**
     * Calculate estimated cost for a step
     */
    private static calculateCost(modelId: string, usage: any): number {
        // 1. Validations
        if (!modelId || !usage) return 0;

        let pricing: any = MODEL_PRICING[modelId as keyof typeof MODEL_PRICING];

        // 2. Check Remote Config for overrides
        try {
            const configStr = getValue(remoteConfig, 'ai_system_config').asString();
            if (configStr) {
                const parsed = JSON.parse(configStr);
                const validated = RemoteAIConfigSchema.safeParse(parsed);

                if (validated.success) {
                    const dynamicConfig = validated.data;

                    // Check logic A: Is the modelId itself an override?
                    // (Caller usually passes the *actual* modelId used, e.g "gemini-4-ultra")
                    // If so, we check if there is pricing for it.
                    if (dynamicConfig.pricing[modelId]) {
                        pricing = dynamicConfig.pricing[modelId];
                    }
                    // Check logic B: Did we override a standard key?
                    else {
                        const key = getModelKey(modelId);
                        if (key && dynamicConfig.overrides[key]) {
                            const overrideId = dynamicConfig.overrides[key];
                            if (dynamicConfig.pricing[overrideId]) {
                                pricing = dynamicConfig.pricing[overrideId];
                            }
                        }
                    }
                }
            }
        } catch (e: unknown) {
            // Ignore config errors, fall back to static pricing
        }

        // 3. Calculate
        if (!pricing) return 0;

        if (pricing.perGeneration) {
            return pricing.perGeneration;
        }

        if (usage.promptTokenCount !== undefined && usage.candidatesTokenCount !== undefined) {
            // Pricing is usually per 1M tokens
            const inputCost = (usage.promptTokenCount / 1_000_000) * (pricing.input || 0);
            const outputCost = (usage.candidatesTokenCount / 1_000_000) * (pricing.output || 0);
            return inputCost + outputCost;
        }

        return 0;
    }

    /**
     * Add a step with usage metrics
     */
    static async addStepWithUsage(
        traceId: string,
        type: TraceStep['type'],
        content: any,
        modelId: string,
        rawUsage?: any,
        metadata?: Record<string, any>
    ): Promise<void> {
        if (!traceId) return;

        let usage: UsageMetrics | undefined;
        if (rawUsage) {
            usage = {
                promptTokens: rawUsage.promptTokenCount || 0,
                candidatesTokens: rawUsage.candidatesTokenCount || 0,
                totalTokens: rawUsage.totalTokenCount || 0,
                cachedContentTokens: rawUsage.cachedContentTokenCount,
                estimatedCost: this.calculateCost(modelId, rawUsage)
            };
        }

        const step: TraceStep = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            type,
            content,
            metadata,
            usage
        };

        const ref = doc(db, this.COLLECTION, traceId);

        try {
            await updateDoc(ref, cleanFirestoreData({
                steps: arrayUnion(step)
            }));

            // If we have usage, also update the total trace usage
            if (usage) {
                const traceDoc = await getDoc(ref);
                const currentTrace = traceDoc.data() as AgentTrace;
                const totalUsage = currentTrace.totalUsage || {
                    promptTokens: 0,
                    candidatesTokens: 0,
                    totalTokens: 0,
                    estimatedCost: 0
                };

                await updateDoc(ref, cleanFirestoreData({
                    totalUsage: {
                        promptTokens: totalUsage.promptTokens + (usage.promptTokens || 0),
                        candidatesTokens: totalUsage.candidatesTokens + (usage.candidatesTokens || 0),
                        totalTokens: totalUsage.totalTokens + (usage.totalTokens || 0),
                        estimatedCost: (totalUsage.estimatedCost || 0) + (usage.estimatedCost || 0)
                    }
                }));
            }
        } catch (error: unknown) {
            logger.error(`[TraceService] Failed to add step with usage to trace ${traceId}: (Non-blocking)`, error);
            // Non-blocking: We don't throw here to ensure the main agent flow continues
        }
    }

    /**
     * Legacy method for adding steps without explicit usage
     */
    static async addStep(traceId: string, type: TraceStep['type'], content: any, metadata?: Record<string, any>): Promise<void> {
        return this.addStepWithUsage(traceId, type, content, '', undefined, metadata);
    }

    /**
     * Mark trace as completed
     */
    static async completeTrace(traceId: string, output?: any): Promise<void> {
        if (!traceId) return;

        const ref = doc(db, this.COLLECTION, traceId);
        const startTime = this.startTimeMap.get(traceId);
        const durationMs = startTime ? Math.round(performance.now() - startTime) : undefined;
        this.startTimeMap.delete(traceId);

        try {
            await updateDoc(ref, cleanFirestoreData({
                status: 'completed',
                endTime: serverTimestamp(),
                durationMs,
                ...(output ? { output } : {})
            }));
        } catch (error: unknown) {
            logger.error(`[TraceService] Failed to complete trace ${traceId}: (Non-blocking)`, error);
        }
    }

    /**
     * Mark trace as failed
     */
    static async failTrace(traceId: string, error: string): Promise<void> {
        if (!traceId) return;

        const ref = doc(db, this.COLLECTION, traceId);
        const startTime = this.startTimeMap.get(traceId);
        const durationMs = startTime ? Math.round(performance.now() - startTime) : undefined;
        this.startTimeMap.delete(traceId);

        try {
            await updateDoc(ref, cleanFirestoreData({
                status: 'failed',
                endTime: serverTimestamp(),
                durationMs,
                error
            }));
        } catch (e: unknown) {
            logger.error(`[TraceService] Failed to fail trace ${traceId}: (Non-blocking)`, e);
        }
    }

    /**
     * Get all traces in a swarm
     */
    static getSwarmQuery(swarmId: string) {
        return query(
            collection(db, this.COLLECTION),
            where('swarmId', '==', swarmId)
        );
    }
}
