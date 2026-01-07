import { db } from '@/services/firebase';
import { collection, doc, setDoc, updateDoc, arrayUnion, serverTimestamp, query, where } from 'firebase/firestore';
import { AgentTrace, TraceStep, TraceStatus } from './types';

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
            // Use a more resilient way to get ID that works with both real Firebase and common mocks
            let traceId: string;
            try {
                const docRef = doc(collection(db, this.COLLECTION));
                traceId = docRef?.id || crypto.randomUUID();
            } catch (e) {
                traceId = crypto.randomUUID();
            }

            const ref = doc(db, this.COLLECTION, traceId);

            const trace: Partial<AgentTrace> = {
                id: traceId,
                userId,
                agentId,
                input,
                status: 'pending',
                startTime: serverTimestamp(),
                steps: [],
                swarmId: metadata?.swarmId || (parentTraceId ? null : traceId), // Use provided swarmId, or self if root
                metadata: {
                    ...(metadata || {}),
                    ...(parentTraceId ? { parentTraceId } : {})
                }
            };

            await setDoc(ref, trace);
            return traceId;
        } catch (error) {
            console.error('[TraceService] Failed to start trace:', error);
            // Fallback for tests or disconnected mode: return a raw UUID so execution can continue
            return crypto.randomUUID();
        }
    }

    /**
     * Add a step to an existing trace
     */
    static async addStep(traceId: string, type: TraceStep['type'], content: any, metadata?: Record<string, any>): Promise<void> {
        if (!traceId) return;

        const step: TraceStep = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            type,
            content,
            metadata
        };

        const ref = doc(db, this.COLLECTION, traceId);

        try {
            await updateDoc(ref, {
                steps: arrayUnion(step)
            });
        } catch (error) {
            console.error(`[TraceService] Failed to add step to trace ${traceId}:`, error);
        }
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
