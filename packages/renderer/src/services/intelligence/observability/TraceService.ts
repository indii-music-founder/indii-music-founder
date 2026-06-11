import { db } from '@/services/firebase';
import { Timestamp, FieldValue, collection, doc, addDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { logger } from '@/utils/logger';

export interface TraceStep {
    type: 'thought' | 'tool_call' | 'tool_result' | 'routing' | 'error';
    content: unknown;
    timestamp: number;
    model?: string;
    usage?: {
        promptTokenCount: number;
        candidatesTokenCount: number;
        totalTokenCount: number;
    };
}

export interface TraceData {
    id?: string;
    userId: string;
    agentId: string;
    input: string;
    output?: unknown;
    status: 'pending' | 'completed' | 'failed';
    steps: TraceStep[];
    metadata?: Record<string, unknown>;
    parentTraceId?: string;
    swarmId?: string;
    createdAt: Timestamp | FieldValue;
    updatedAt: Timestamp | FieldValue;
}

export class TraceService {
    private static COLLECTION = 'agent_traces';

    /**
     * Start a new agent execution trace.
     */
    static async startTrace(
        userId: string,
        agentId: string,
        input: string,
        metadata?: Record<string, unknown>,
        parentTraceId?: string
    ): Promise<string> {
        try {
            const docRef = await addDoc(collection(db, this.COLLECTION), {
                userId,
                agentId,
                input,
                status: 'pending',
                steps: [],
                metadata: metadata?.context || {},
                swarmId: metadata?.swarmId || parentTraceId || null,
                parentTraceId: parentTraceId || null,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            return docRef.id;
        } catch (error: unknown) {
            logger.error('[TraceService] Failed to start trace:', error);
            return `local_${Date.now()}`; // Fallback ID for non-blocking execution
        }
    }

    /**
     * Add a granular step to an existing trace.
     */
    static async addStep(traceId: string, type: TraceStep['type'], content: unknown): Promise<void> {
        if (traceId.startsWith('local_')) return;

        try {
            const traceRef = doc(db, this.COLLECTION, traceId);
            await updateDoc(traceRef, {
                steps: arrayUnion({
                    type,
                    content,
                    timestamp: Date.now()
                }),
                updatedAt: serverTimestamp()
            });
        } catch (error: unknown) {
            logger.error('[TraceService] Failed to add step:', error);
        }
    }

    /**
     * Add a step with associated model usage data.
     */
    static async addStepWithUsage(
        traceId: string,
        type: TraceStep['type'],
        content: unknown,
        model: string,
        usage: TraceStep['usage']
    ): Promise<void> {
        if (traceId.startsWith('local_')) return;

        try {
            const traceRef = doc(db, this.COLLECTION, traceId);
            await updateDoc(traceRef, {
                steps: arrayUnion({
                    type,
                    content,
                    model,
                    usage,
                    timestamp: Date.now()
                }),
                updatedAt: serverTimestamp()
            });
        } catch (error: unknown) {
            logger.error('[TraceService] Failed to add step with usage:', error);
        }
    }

    /**
     * Mark a trace as successfully completed.
     */
    static async completeTrace(traceId: string, output: unknown): Promise<void> {
        if (traceId.startsWith('local_')) return;

        try {
            const traceRef = doc(db, this.COLLECTION, traceId);
            await updateDoc(traceRef, {
                output,
                status: 'completed',
                updatedAt: serverTimestamp()
            });
        } catch (error: unknown) {
            logger.error('[TraceService] Failed to complete trace:', error);
        }
    }

    /**
     * Mark a trace as failed with an error message.
     */
    static async failTrace(traceId: string, error: string): Promise<void> {
        if (traceId.startsWith('local_')) return;

        try {
            const traceRef = doc(db, this.COLLECTION, traceId);
            await updateDoc(traceRef, {
                error,
                status: 'failed',
                updatedAt: serverTimestamp()
            });
        } catch (error: unknown) {
            logger.error('[TraceService] Failed to fail trace:', error);
        }
    }
}
