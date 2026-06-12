import { HttpsError } from 'firebase-functions/v2/https';

export interface CircuitBreakerOptions {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
    timeoutMs?: number;
}

/**
 * Exponential Backoff Circuit Breaker
 * Protects downstream DSP and PRO APIs from being flooded during distribution outages.
 */
export async function withCircuitBreaker<T>(
    operationName: string,
    operation: () => Promise<T>,
    options: CircuitBreakerOptions = { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 10000 }
): Promise<T> {
    let attempt = 0;
    
    while (attempt < options.maxRetries) {
        try {
            if (options.timeoutMs && options.timeoutMs > 0) {
                let timer: NodeJS.Timeout;
                const timeoutPromise = new Promise<never>((_, reject) => {
                    timer = setTimeout(() => {
                        reject(new Error(`Operation timed out after ${options.timeoutMs}ms`));
                    }, options.timeoutMs);
                });
                try {
                    const result = await Promise.race([operation(), timeoutPromise]);
                    clearTimeout(timer!);
                    return result;
                } catch (err) {
                    clearTimeout(timer!);
                    throw err;
                }
            } else {
                return await operation();
            }
        } catch (error: any) {
            attempt++;
            console.error(`[CircuitBreaker] ${operationName} failed on attempt ${attempt}:`, error);

            if (attempt >= options.maxRetries) {
                console.error(`[CircuitBreaker] ${operationName} exhausted all retries. Opening circuit.`);
                throw new HttpsError('unavailable', `Operation ${operationName} failed after ${options.maxRetries} attempts.`);
            }

            // Exponential backoff with jitter
            const jitter = Math.random() * 500;
            const delay = Math.min(options.baseDelayMs * Math.pow(2, attempt - 1) + jitter, options.maxDelayMs);
            
            console.log(`[CircuitBreaker] Waiting ${Math.round(delay)}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw new HttpsError('internal', 'Circuit breaker reached an unexpected state.');
}
