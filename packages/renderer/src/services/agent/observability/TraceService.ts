import { db } from '@/services/firebase';
import { collection, doc, setDoc, updateDoc, arrayUnion, increment, serverTimestamp, query, where, getDoc } from 'firebase/firestore';
import { AgentTrace, TraceStep, UsageMetrics } from './types';
import { MODEL_PRICING, getModelKey } from '@/core/config/intelligence-models';
import { cleanFirestoreData } from '@/services/utils/firebase';
import { remoteConfig } from '@/services/firebase';
import { getValue } from 'firebase/remote-config';
import { RemoteIntelligenceConfigSchema } from '@/services/intelligence/config/RemoteIntelligenceConfig';
import { logger } from '@/utils/logger';
import { isFirebaseE2EMockEnabled } from '@/utils/e2eMode';

export class TraceService {
    private static readonly COLLECTION = 'agent_traces';
    static readonly MAX_DELEGATION_DEPTH = 3;

    // Part 1: Map to track local start times for duration calculation
    private static startTimeMap: Map<string, number> = new Map();

    private static get isE2EMode(): boolean {
        return isFirebaseE2EMockEnabled();
    }

    /**
     * Start a new execution trace
     */
    static async startTrace(
        userId: string,
        agentId: string,
        input: string,
        metadata?: Record<string, unknown>,
        parentTraceId?: string
    ): Promise<string> {
        if (this.isE2EMode) {
            return crypto.randomUUID();
        }

        if (!userId) {
            logger.warn('[TraceService] No userId provided, skipping trace.');
            return '';
        }

        try {
            if (!db) {
                logger.warn('[TraceService] DB not initialized, trace skipped.');
                return '';
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
                steps: [],
                swarmId: (metadata?.swarmId as string | undefined) || (parentTraceId ? null : traceId),
                metadata: {
                    ...(metadata || {}),
                    ...(parentTraceId ? { parentTraceId } : {})
                }
            };

            await setDoc(doc(db, this.COLLECTION, traceId), {
                ...cleanFirestoreData(trace),
                startTime: serverTimestamp()
            });
            return traceId;
        } catch (error: unknown) {
            logger.error('[TraceService] Failed to start trace: (Non-blocking)', error);
            return '';
        }
    }

    /**
     * Calculate estimated cost for a step
     */
    private static calculateCost(modelId: string, usage: Record<string, unknown>): number {
        // 1. Validations
        if (!modelId || !usage) return 0;

        let pricing: Record<string, unknown> | undefined = MODEL_PRICING[modelId as keyof typeof MODEL_PRICING];

        // 2. Check Remote Config for overrides
        try {
            const configStr = getValue(remoteConfig, 'ai_system_config').asString();
            if (configStr) {
                const parsed = JSON.parse(configStr);
                const validated = RemoteIntelligenceConfigSchema.safeParse(parsed);

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
        } catch (_e: unknown) {
            // Ignore config errors, fall back to static pricing
        }

        // 3. Calculate
        if (!pricing) return 0;

        const perGen = pricing.perGeneration as number | undefined;
        if (perGen) {
            return perGen;
        }

        const promptTokens = usage.promptTokenCount as number | undefined;
        const candidateTokens = usage.candidatesTokenCount as number | undefined;
        if (promptTokens !== undefined && candidateTokens !== undefined) {
            // Pricing is usually per 1M tokens
            const inputPrice = pricing.input as number || 0;
            const outputPrice = pricing.output as number || 0;
            const inputCost = (promptTokens / 1_000_000) * inputPrice;
            const outputCost = (candidateTokens / 1_000_000) * outputPrice;
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
        content: unknown,
        modelId: string,
        rawUsage?: Record<string, unknown>,
        metadata?: Record<string, unknown>
    ): Promise<void> {
        if (this.isE2EMode) return;
        if (!traceId) return;

        let usage: UsageMetrics | undefined;
        if (rawUsage) {
            usage = {
                promptTokens: (rawUsage.promptTokenCount as number) || 0,
                candidatesTokens: (rawUsage.candidatesTokenCount as number) || 0,
                totalTokens: (rawUsage.totalTokenCount as number) || 0,
                cachedContentTokens: rawUsage.cachedContentTokenCount as number | undefined,
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
        const cleanStep = cleanFirestoreData({ step }).step;
        const stepAppend = arrayUnion(cleanStep);

        const ref = doc(db, this.COLLECTION, traceId);

        try {
            if (usage) {
                // Server transforms atomically append the step and add its usage,
                // without a client read that can race with another writer.
                await updateDoc(ref, {
                    steps: stepAppend,
                    'totalUsage.promptTokens': increment(usage.promptTokens),
                    'totalUsage.candidatesTokens': increment(usage.candidatesTokens),
                    'totalUsage.totalTokens': increment(usage.totalTokens),
                    'totalUsage.estimatedCost': increment(usage.estimatedCost || 0)
                });
            } else {
                await updateDoc(ref, { steps: stepAppend });
            }
        } catch (error: unknown) {
            logger.error(`[TraceService] Failed to add step with usage to trace ${traceId}: (Non-blocking)`, error);
            // Non-blocking: We don't throw here to ensure the main agent flow continues
        }
    }

    /**
     * Legacy method for adding steps without explicit usage
     */
    static async addStep(traceId: string, type: TraceStep['type'], content: unknown, metadata?: Record<string, unknown>): Promise<void> {
        return this.addStepWithUsage(traceId, type, content, '', undefined, metadata);
    }

    /**
     * Mark trace as completed
     */
    static async completeTrace(traceId: string, output?: unknown): Promise<void> {
        if (this.isE2EMode) return;
        if (!traceId) return;

        const ref = doc(db, this.COLLECTION, traceId);
        const startTime = this.startTimeMap.get(traceId);
        const durationMs = startTime ? Math.round(performance.now() - startTime) : undefined;
        this.startTimeMap.delete(traceId);

        try {
            await updateDoc(ref, {
                status: 'completed',
                endTime: serverTimestamp(),
                ...(durationMs !== undefined ? { durationMs } : {}),
                ...(output !== undefined ? { output: cleanFirestoreData({ output }).output } : {})
            });
        } catch (error: unknown) {
            logger.error(`[TraceService] Failed to complete trace ${traceId}: (Non-blocking)`, error);
        }
    }

    /**
     * Mark trace as failed
     */
    static async failTrace(traceId: string, error: string): Promise<void> {
        if (this.isE2EMode) return;
        if (!traceId) return;

        const ref = doc(db, this.COLLECTION, traceId);
        const startTime = this.startTimeMap.get(traceId);
        const durationMs = startTime ? Math.round(performance.now() - startTime) : undefined;
        this.startTimeMap.delete(traceId);

        try {
            await updateDoc(ref, {
                status: 'failed',
                endTime: serverTimestamp(),
                ...(durationMs !== undefined ? { durationMs } : {}),
                error
            });
        } catch (e: unknown) {
            logger.error(`[TraceService] Failed to fail trace ${traceId}: (Non-blocking)`, e);
        }
    }

    /** Resolve the bounded parent chain. Unknown or unreadable ancestry blocks delegation. */
    static async getTraceDepth(traceId: string): Promise<number> {
        if (this.isE2EMode) return 0;
        if (!traceId || !db) return this.MAX_DELEGATION_DEPTH;

        try {
            const visited = new Set<string>();
            let currentId = traceId;
            let depth = 0;
            while (depth < this.MAX_DELEGATION_DEPTH) {
                if (visited.has(currentId)) return this.MAX_DELEGATION_DEPTH;
                visited.add(currentId);
                const trace = await getDoc(doc(db, this.COLLECTION, currentId));
                if (!trace.exists()) return this.MAX_DELEGATION_DEPTH;
                const parentId = (trace.data() as AgentTrace).metadata?.parentTraceId;
                if (parentId === undefined || parentId === null || parentId === '') return depth;
                if (typeof parentId !== 'string') return this.MAX_DELEGATION_DEPTH;
                currentId = parentId;
                depth += 1;
            }
            return this.MAX_DELEGATION_DEPTH;
        } catch {
            logger.error('[TraceService] Could not verify delegation depth');
            return this.MAX_DELEGATION_DEPTH;
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
