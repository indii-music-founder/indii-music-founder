/* eslint-disable @typescript-eslint/no-explicit-any -- Service with dynamic external data */
import { logger } from '@/utils/logger';

export function safeJsonParse<T = any>(str: string, fallback?: T): T | undefined {
    try {
        return JSON.parse(str) as T;
    } catch (e: unknown) {
        logger.warn('[safeJsonParse] Failed to parse JSON:', e);
        return fallback;
    }
}
