import { PythonBridge } from './python-bridge';

export interface PythonExecutionResult<T = any> {
    status: 'success' | 'error';
    data?: T;
    error?: string;
    metadata?: {
        executionTimeMs: number;
    };
}

export interface SupervisorOptions {
    timeoutMs?: number;
    retries?: number;
}

export class AgentSupervisor {
    private static DEFAULT_TIMEOUT_MS = 30000; // 30 seconds default
    private static DEFAULT_RETRIES = 0;

    /**
     * Executes a Python script with strict timeout and schema validation.
     * Prevents infinite hangs from silent failures in the execution layer.
     */
    static async execute<T>(
        category: string,
        scriptName: string,
        args: string[] = [],
        options: SupervisorOptions = {},
        onProgress?: (progress: number, log?: string) => void,
        env: NodeJS.ProcessEnv = {},
        sensitiveArgsIndices: number[] = []
    ): Promise<T> {
        const timeoutMs = options.timeoutMs ?? this.DEFAULT_TIMEOUT_MS;
        const maxRetries = options.retries ?? this.DEFAULT_RETRIES;

        let attempts = 0;
        let lastError: Error | null = null;

        while (attempts <= maxRetries) {
            attempts++;
            const startTime = Date.now();

            try {
                // Execute with timeout wrapper
                let result = await this.executeWithTimeout<T>(
                    category,
                    scriptName,
                    args,
                    timeoutMs,
                    onProgress,
                    env,
                    sensitiveArgsIndices
                );

                // Add metadata to result if it's an object and extensible
                if (result && typeof result === 'object' && !Object.isFrozen(result)) {
                    (result as any)._supervisorMetadata = {
                        executionTimeMs: Date.now() - startTime,
                        attempts
                    };
                }

                return result;
            } catch (error: any) {
                lastError = error;
                console.warn(`[AgentSupervisor] Attempt ${attempts}/${maxRetries + 1} failed for ${scriptName}: ${error.message}`);

                if (attempts <= maxRetries) {
                    // Exponential backoff or simple delay before retry
                    await new Promise(res => setTimeout(res, 1000 * attempts));
                }
            }
        }

        throw new Error(`[AgentSupervisor] Script ${scriptName} failed after ${maxRetries + 1} attempts. Last error: ${lastError?.message}`);
    }

    private static executeWithTimeout<T>(
        category: string,
        scriptName: string,
        args: string[],
        timeoutMs: number,
        onProgress?: (progress: number, log?: string) => void,
        env?: NodeJS.ProcessEnv,
        sensitiveArgsIndices?: number[]
    ): Promise<T> {
        return new Promise((resolve, reject) => {
            let isCompleted = false;

            const timeoutId = setTimeout(() => {
                if (!isCompleted) {
                    isCompleted = true;
                    // Note: This rejects the promise, but doesn't actually kill the orphaned Python process.
                    // To do that, PythonBridge would need to return the ChildProcess or a generic abort mechanism.
                    // For now, we enforce the timeout at the Node level to unblock the UI.
                    reject(new Error(`Execution timeout: ${scriptName} exceeded ${timeoutMs}ms limit.`));
                }
            }, timeoutMs);

            PythonBridge.runScript(category, scriptName, args, onProgress, env, sensitiveArgsIndices)
                .then((rawOutput) => {
                    if (isCompleted) return;
                    isCompleted = true;
                    clearTimeout(timeoutId);

                    try {
                        const validatedResult = this.validateSchema<T>(rawOutput);
                        resolve(validatedResult);
                    } catch (validationError) {
                        reject(validationError);
                    }
                })
                .catch((error) => {
                    if (isCompleted) return;
                    isCompleted = true;
                    clearTimeout(timeoutId);
                    reject(error);
                });
        });
    }

    /**
     * Enforces that the Python script output matches the standard IPC schema.
     */
    private static validateSchema<T>(output: any): T {
        // If output is a string, it means PythonBridge couldn't parse it as JSON
        if (typeof output === 'string') {
            throw new Error(`IPC Schema Validation Error: Output is not JSON. Raw output: ${output.substring(0, 100)}...`);
        }

        // We expect a specific structure or at least we enforce that it doesn't contain an explicit "error" key at the top level
        // if we are standardizing on {"status": "success", "data": ...}

        // Let's implement schema flexibility during transition:
        // 1. Strict `{ status: 'success', data: ... }` format
        if (output && typeof output === 'object') {
            if (output.status === 'success' && 'data' in output) {
                return output.data as T;
            }
            if (output.status === 'error') {
                throw new Error(`Python Script Error: ${output.error || 'Unknown error'}`);
            }

            // 2. Legacy fallback format (e.g., direct error key)
            if (output.error) {
                throw new Error(`Python Script Legacy Error: ${output.error}`);
            }
        }

        // If it doesn't match the strict schema but is JSON, we return it as is for backward compatibility,
        // but log a warning to encourage migration to the strict schema.
        console.warn(`[AgentSupervisor] IPC Warning: Script output did not match strict schema {status, data}. Returning raw parsed JSON.`);
        return output as T;
    }
}
