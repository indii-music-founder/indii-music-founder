import { CircuitBreakerConfig } from '../utils/CircuitBreaker';

/**
 * Configuration for Intelligence Service Circuit Breakers.
 * Defines thresholds and timeouts for different types of Autonomous operations.
 */
export const BREAKER_CONFIGS: Record<string, CircuitBreakerConfig> = {
    /**
     * Text generation and structured data.
     * moderate threshold, fast reset as these are critical.
     */
    CONTENT_GENERATION: {
        failureThreshold: 20,
        resetTimeoutMs: 15000, // 15s
    },
    /**
     * Media generation (Image, Video).
     * Higher latency operations, so we allow fewer failures but longer reset.
     */
    MEDIA_GENERATION: {
        failureThreshold: 10,
        resetTimeoutMs: 30000, // 30s
    },
    /**
     * Auxiliary services (Embedding, etc.)
     */
    AUX_SERVICES: {
        failureThreshold: 20,
        resetTimeoutMs: 10000, // 10s
    }
};
