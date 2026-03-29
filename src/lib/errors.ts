/**
 * Error Handling Utilities for indiiOS
 *
 * Centralizes repetitive try/catch patterns across services.
 * Uses the existing `AppException` from `@/shared/types/errors`.
 *
 * Usage:
 *   import { withServiceError, retryAsync } from '@/lib/errors';
 *
 *   // Wrap a service method to auto-catch and convert errors
 *   const result = await withServiceError('AgentService', 'executeTask', async () => {
 *     return await someRiskyOperation();
 *   });
 *
 *   // Auto-retry with exponential backoff
 *   const data = await retryAsync(() => fetchFromAPI(), { maxRetries: 3, baseDelayMs: 1000 });
 */

import { AppErrorCode, AppException } from '@/shared/types/errors';
import { logger } from '@/utils/logger';

/**
 * Wraps an async function with structured error handling.
 * Catches errors, logs them via the structured logger, and throws `AppException`.
 *
 * If the underlying error is already an `AppException`, it is re-thrown as-is.
 *
 * @param service  - Name of the service (for logging)
 * @param operation - Name of the operation (for logging)
 * @param fn - The async function to execute
 * @param fallback - Optional fallback value to return instead of throwing
 */
export async function withServiceError<T>(
    service: string,
    operation: string,
    fn: () => Promise<T>,
): Promise<T>;
export async function withServiceError<T>(
    service: string,
    operation: string,
    fn: () => Promise<T>,
    fallback: T,
): Promise<T>;
export async function withServiceError<T>(
    service: string,
    operation: string,
    fn: () => Promise<T>,
    fallback?: T,
): Promise<T> {
    try {
        return await fn();
    } catch (error: unknown) {
        if (error instanceof AppException) {
            logger.error(`[${service}] ${operation} failed: ${error.message}`);
            if (arguments.length === 4) return fallback as T;
            throw error;
        }

        const message = error instanceof Error ? error.message : String(error);
        logger.error(`[${service}] ${operation} failed: ${message}`, error);

        if (arguments.length === 4) return fallback as T;

        throw new AppException(
            AppErrorCode.INTERNAL_ERROR,
            `[${service}] ${operation}: ${message}`,
            { originalError: message, context: { service, operation } }
        );
    }
}

/**
 * Retries an async function with exponential backoff.
 * Useful for network calls, API requests, and other flaky operations.
 *
 * @param fn - The async function to retry
 * @param options - Configuration for retry behavior
 * @returns The result of the successful execution
 */
export interface RetryOptions {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    signal?: AbortSignal;
    shouldRetry?: (error: unknown, attempt: number) => boolean;
}

export async function retryAsync<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {},
): Promise<T> {
    const {
        maxRetries = 3,
        baseDelayMs = 1000,
        maxDelayMs = 30000,
        signal,
        shouldRetry = () => true,
    } = options;

    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (signal?.aborted) {
            throw new AppException(AppErrorCode.CANCELLED, 'Operation cancelled');
        }

        try {
            return await fn();
        } catch (error: unknown) {
            lastError = error;

            if (attempt >= maxRetries || !shouldRetry(error, attempt)) {
                throw error;
            }

            const delay = Math.min(
                baseDelayMs * Math.pow(2, attempt) + Math.random() * 100,
                maxDelayMs,
            );
            logger.warn(`[retry] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${Math.round(delay)}ms`);
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(resolve, delay);
                signal?.addEventListener('abort', () => {
                    clearTimeout(timeout);
                    reject(new AppException(AppErrorCode.CANCELLED, 'Operation cancelled during retry'));
                }, { once: true });
            });
        }
    }

    throw lastError;
}

/**
 * Wraps a synchronous function with error handling.
 * For use in non-async contexts (e.g., event handlers, reducers).
 */
export function withSafeExec<T>(
    label: string,
    fn: () => T,
    fallback: T,
): T {
    try {
        return fn();
    } catch (error: unknown) {
        logger.error(`[${label}] ${error instanceof Error ? error.message : String(error)}`);
        return fallback;
    }
}
