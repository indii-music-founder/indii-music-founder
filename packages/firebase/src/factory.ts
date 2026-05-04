/**
 * Firebase Cloud Functions — Generation Abstraction Layer
 * ========================================================
 *
 * This module provides a future-proof factory for defining Cloud Functions.
 * When Google releases a new generation (Gen 3, Gen 4, etc.), you only need
 * to update THIS file — all business logic in individual function files
 * remains untouched.
 *
 * Usage:
 *   import { defineCallable, defineScheduled, defineHttps, HttpsError } from '../factory';
 *
 *   export const myFunction = defineCallable(
 *       { region: 'us-west1', memory: '1GiB', secrets: [mySecret] },
 *       async (request) => {
 *           if (!request.auth) throw new HttpsError('unauthenticated', '...');
 *           const data = request.data as MyType;
 *           return { result: 'ok' };
 *       }
 *   );
 *
 * Migration checklist (when upgrading to Gen N+1):
 *   1. Update the import path below (e.g., firebase-functions/v3/https)
 *   2. Adjust the option mapping if the new API renames fields
 *   3. Re-run `npx tsc --noEmit` to catch any type mismatches
 *   4. Deploy — all function files stay unchanged
 */

// ════════════════════════════════════════════════════════════════════════════
// CURRENT GENERATION: Gen 2 (firebase-functions/v2)
// ════════════════════════════════════════════════════════════════════════════

import {
    onCall,
    onRequest,
    HttpsError,
    type CallableRequest,
    type CallableOptions,
    type HttpsOptions,
} from 'firebase-functions/v2/https';
import type { SecretParam } from 'firebase-functions/params';

import {
    onSchedule,
    type ScheduleOptions,
} from 'firebase-functions/v2/scheduler';

import {
    onDocumentWritten,
    type DocumentOptions,
} from 'firebase-functions/v2/firestore';

import {
    onObjectFinalized,
} from 'firebase-functions/v2/storage';

// Re-export HttpsError so consumers don't import the SDK directly
export { HttpsError };

// ════════════════════════════════════════════════════════════════════════════
// TYPES — Stable contract that won't change across generations
// ════════════════════════════════════════════════════════════════════════════

/**
 * Common options shared across all function types.
 * These map to the current generation's option shape.
 */
export interface FunctionOptions {
    /** GCP region(s). Default: 'us-central1' */
    region?: string | string[];
    /** Memory allocation. Default: '256MiB' */
    memory?: '128MiB' | '256MiB' | '512MiB' | '1GiB' | '2GiB' | '4GiB' | '8GiB' | '16GiB';
    /** Timeout in seconds. Default: 60 */
    timeoutSeconds?: number;
    /** Minimum instances (keep warm). Default: 0 */
    minInstances?: number;
    /** Maximum instances. Default: 100 */
    maxInstances?: number;
    /** CPU allocation. Default: 1 */
    cpu?: number | 'gcf_gen1';
    /** Secret references */
    secrets?: (string | SecretParam)[];
    /** Whether to enforce App Check. Default: false */
    enforceAppCheck?: boolean;
    /** Concurrency per instance. Default: 80 */
    concurrency?: number;
    /** Ingress settings */
    ingress?: 'ALLOW_ALL' | 'ALLOW_INTERNAL_ONLY' | 'ALLOW_INTERNAL_AND_GCLB';
}

/**
 * The stable request shape that handler functions receive.
 * Wraps the generation-specific request object.
 */
export interface StableCallableRequest<T = unknown> {
    /** The authenticated user, or undefined if unauthenticated */
    auth?: {
        uid: string;
        token: Record<string, unknown>;
    };
    /** The request payload */
    data: T;
    /** Raw IP address of the caller */
    rawRequest?: unknown;
}

// ════════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Maps our stable FunctionOptions to the current generation's option format.
 * This is the ONLY function that needs updating when upgrading generations.
 */
function mapOptions(opts: FunctionOptions): CallableOptions {
    return {
        region: opts.region || 'us-central1',
        memory: opts.memory,
        timeoutSeconds: opts.timeoutSeconds,
        minInstances: opts.minInstances,
        maxInstances: opts.maxInstances,
        cpu: opts.cpu,
        secrets: opts.secrets as any,
        enforceAppCheck: opts.enforceAppCheck,
        concurrency: opts.concurrency,
        ingress: opts.ingress,
    };
}

/**
 * Define a callable Cloud Function (invoked from client SDK via httpsCallable).
 *
 * @param options - Function configuration
 * @param handler - Business logic handler
 * @returns A deployed Cloud Function
 */
export function defineCallable<TData = unknown, TResponse = unknown>(
    options: FunctionOptions,
    handler: (request: StableCallableRequest<TData>) => Promise<TResponse>
) {
    const mappedOptions = mapOptions(options);
    return onCall(mappedOptions, async (request: CallableRequest<TData>) => {
        // Normalize the request into our stable shape
        const stableRequest: StableCallableRequest<TData> = {
            auth: request.auth ? {
                uid: request.auth.uid,
                token: request.auth.token as Record<string, unknown>,
            } : undefined,
            data: request.data,
            rawRequest: request.rawRequest,
        };
        return handler(stableRequest);
    });
}

/**
 * Define an HTTP Cloud Function (invoked via direct URL).
 *
 * @param options - Function configuration
 * @param handler - Express-compatible request handler
 * @returns A deployed Cloud Function
 */
export function defineHttps(
    options: FunctionOptions,
    handler: (req: unknown, res: unknown) => void | Promise<void>
) {
    const mappedOptions = mapOptions(options) as HttpsOptions;
    return onRequest(mappedOptions, handler as Parameters<typeof onRequest>[1]);
}

/**
 * Define a scheduled Cloud Function (cron job).
 *
 * @param schedule - Cron expression (e.g., 'every 5 minutes')
 * @param options - Function configuration
 * @param handler - Business logic handler
 * @returns A deployed Cloud Function
 */
export function defineScheduled(
    schedule: string,
    options: FunctionOptions,
    handler: () => Promise<void>
) {
    const scheduleOptions: ScheduleOptions = {
        schedule,
        region: options.region || 'us-central1',
        memory: options.memory,
        timeoutSeconds: options.timeoutSeconds,
    };
    return onSchedule(scheduleOptions, async () => {
        await handler();
    });
}

/**
 * Define a Firestore-triggered Cloud Function.
 *
 * @param documentPath - Firestore document path pattern (e.g., 'users/{userId}')
 * @param options - Function configuration
 * @param handler - Business logic handler receiving the change event
 * @returns A deployed Cloud Function
 */
export function defineFirestoreTrigger(
    documentPath: string,
    options: FunctionOptions,
    handler: (event: { data?: unknown; params: Record<string, string> }) => Promise<void>
) {
    const docOptions: DocumentOptions = {
        document: documentPath,
        region: options.region || 'us-central1',
        memory: options.memory,
        timeoutSeconds: options.timeoutSeconds,
    };
    return onDocumentWritten(docOptions, async (event) => {
        await handler({
            data: event.data,
            params: event.params,
        });
    });
}

/**
 * Define a Storage-triggered Cloud Function.
 *
 * @param bucket - Storage bucket name (optional, uses default)
 * @param options - Function configuration
 * @param handler - Business logic handler receiving the storage event
 * @returns A deployed Cloud Function
 */
export function defineStorageTrigger(
    bucket: string | undefined,
    options: FunctionOptions,
    handler: (event: { data: { name: string; bucket: string; contentType?: string; size?: number } }) => Promise<void>
) {
    const storageOpts = {
        bucket,
        region: options.region || 'us-central1',
        memory: options.memory,
        timeoutSeconds: options.timeoutSeconds,
    };
    return onObjectFinalized(storageOpts, async (event) => {
        await handler({
            data: {
                name: event.data.name,
                bucket: event.data.bucket,
                contentType: event.data.contentType,
                size: Number(event.data.size) || 0,
            },
        });
    });
}
