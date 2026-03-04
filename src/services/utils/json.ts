export function safeJsonParse<T = any>(str: string, fallback?: T): T | undefined {
    try {
        return JSON.parse(str) as T;
    } catch (e) {
        logger.warn('[safeJsonParse] Failed to parse JSON:', e);
        return fallback;
    }
}
