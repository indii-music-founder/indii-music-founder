import { db } from '@/services/firebase';
import { collection, doc, setDoc, updateDoc, arrayUnion, serverTimestamp, query, where, getDoc } from 'firebase/firestore';
import { AgentTrace, TraceStep, UsageMetrics } from './types';
import { MODEL_PRICING } from '@/core/config/ai-models';

export class TraceService {
    private static readonly COLLECTION = 'agent_traces';

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
            console.warn('[TraceService] No userId provided, skipping trace.');
            return '';
        }

        try {
            if (!db) {
                console.warn('[TraceService] DB not initialized, returning mock ID');
                return crypto.randomUUID();
            }

            const docRef = doc(collection(db, this.COLLECTION));
            const traceId = docRef?.id || crypto.randomUUID();

            const trace: Partial<AgentTrace> = {
                id: traceId,
                userId,
                agentId,
                input,
                status: 'pending',
                startTime: serverTimestamp(),
                steps: [],
                swarmId: metadata?.swarmId || (parentTraceId ? null : traceId),
                metadata: {
                    ...(metadata || {}),
                    ...(parentTraceId ? { parentTraceId } : {})
                }
            };

            await setDoc(doc(db, this.COLLECTION, traceId), trace);
            return traceId;
        } catch (error) {
            console.error('[TraceService] Failed to start trace:', error);
            return crypto.randomUUID();
        }
    }

    /**
     * Calculate estimated cost for a step
     */
    private static calculateCost(modelId: string, usage: any): number {
        const pricing: any = MODEL_PRICING[modelId as keyof typeof MODEL_PRICING];
        if (!pricing) return 0;

        if (pricing.perGeneration) {
            return pricing.perGeneration;
        }

        if (usage.promptTokenCount && usage.candidatesTokenCount) {
            const inputCost = (usage.promptTokenCount / 1_000_000) * pricing.input;
            const outputCost = (usage.candidatesTokenCount / 1_000_000) * pricing.output;
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
            await updateDoc(ref, {
                steps: arrayUnion(step)
            });

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

                await updateDoc(ref, {
                    totalUsage: {
                        promptTokens: totalUsage.promptTokens + (usage.promptTokens || 0),
                        candidatesTokens: totalUsage.candidatesTokens + (usage.candidatesTokens || 0),
                        totalTokens: totalUsage.totalTokens + (usage.totalTokens || 0),
                        estimatedCost: (totalUsage.estimatedCost || 0) + (usage.estimatedCost || 0)
                    }
                });
            }
        } catch (error) {
            console.error(`[TraceService] Failed to add step with usage to trace ${traceId}:`, error);
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

        try {
            await updateDoc(ref, {
                status: 'completed',
                endTime: serverTimestamp(),
                ...(output ? { output } : {})
            });
        } catch (error) {
            console.error(`[TraceService] Failed to complete trace ${traceId}:`, error);
        }
    }

    /**
     * Mark trace as failed
     */
    static async failTrace(traceId: string, error: string): Promise<void> {
        if (!traceId) return;

        const ref = doc(db, this.COLLECTION, traceId);

        try {
            await updateDoc(ref, {
                status: 'failed',
                endTime: serverTimestamp(),
                error
            });
        } catch (e) {
            console.error(`[TraceService] Failed to fail trace ${traceId}:`, e);
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
