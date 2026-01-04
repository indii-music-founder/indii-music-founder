// Using global console

export enum CircuitState {
    CLOSED = 'CLOSED',
    OPEN = 'OPEN',
    HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerConfig {
    failureThreshold: number;
    resetTimeoutMs: number;
    fallbackResponse?: any;
}

export class CircuitBreaker {
    private state: CircuitState = CircuitState.CLOSED;
    private failureCount: number = 0;
    private lastFailureTime: number = 0;
    private readonly config: CircuitBreakerConfig;

    constructor(config: CircuitBreakerConfig) {
        this.config = config;
    }

    public async execute<T>(action: () => Promise<T>, fallback?: T): Promise<T> {
        if (this.state === CircuitState.OPEN) {
            if (Date.now() - this.lastFailureTime > this.config.resetTimeoutMs) {
                this.state = CircuitState.HALF_OPEN;
                console.info('CircuitBreaker: Custom State changed to HALF_OPEN. Testing service...');
            } else {
                console.warn('CircuitBreaker: Circuit is OPEN. Returning fallback or throwing.');
                if (fallback !== undefined) return fallback;
                if (this.config.fallbackResponse !== undefined) return this.config.fallbackResponse;
                throw new Error('CircuitBreaker: Service is currently unavailable (Circuit OPEN).');
            }
        }

        try {
            const result = await action();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure(error);
            if (fallback !== undefined) return fallback;
            if (this.config.fallbackResponse !== undefined) return this.config.fallbackResponse;
            throw error;
        }
    }

    private onSuccess() {
        if (this.state === CircuitState.HALF_OPEN) {
            this.state = CircuitState.CLOSED;
            this.failureCount = 0;
            console.info('CircuitBreaker: Service recovered. State changed to CLOSED.');
        } else {
            // Reset failure count on success in CLOSED state if we want strict consecutive counting
            // Alternatively, some breakers use a time window. We'll stick to consecutive for simplicity as per plan.
            this.failureCount = 0;
        }
    }

    private onFailure(error: any) {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        console.error(`CircuitBreaker: Action failed. Count: ${this.failureCount}/${this.config.failureThreshold}`, error);

        if (this.state === CircuitState.HALF_OPEN) {
            this.state = CircuitState.OPEN;
            console.warn('CircuitBreaker: Custom Recovery failed. State changed back to OPEN.');
        } else if (this.failureCount >= this.config.failureThreshold) {
            this.state = CircuitState.OPEN;
            console.error('CircuitBreaker: Failure threshold reached. State changed to OPEN.');
        }
    }

    public getState(): CircuitState {
        return this.state;
    }
}
