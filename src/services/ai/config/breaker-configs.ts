import { CircuitBreakerConfig } from '../utils/CircuitBreaker';

/**
 * Configuration for AI Service Circuit Breakers.
 * Defines thresholds and timeouts for different types of AI operations.
 */
export const BREAKER_CONFIGS: Record<string, CircuitBreakerConfig> = {
    /**
     * Text generation and structured data.
     * moderate threshold, fast reset as these are critical.
     */
    CONTENT_GENERATION: {
        failureThreshold: 5,
        resetTimeoutMs: 30000, // 30s
    },
    /**
     * Media generation (Image, Video).
     * Higher latency operations, so we allow fewer failures but longer reset.
     */
    MEDIA_GENERATION: {
        failureThreshold: 3,
        resetTimeoutMs: 60000, // 60s
    },
    /**
     * Auxiliary services (Embedding, etc.)
     */
    AUX_SERVICES: {
        failureThreshold: 10,
        resetTimeoutMs: 15000, // 15s
    }
};
