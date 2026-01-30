/**
 * SecretsBroker - TypeScript client for the Python auth_broker sidecar.
 *
 * Implements the Ephemeral Secrets Broker pattern from the Hybrid Agentic Architecture:
 * - Request opaque handles instead of raw secrets
 * - Handles are time-limited and auto-expire
 * - Zeroization clears all handles after task completion
 * - Frontend never sees actual secret values
 */

export interface HandleResponse {
    status: 'success' | 'error';
    handle?: string;
    expires_in?: number;
    error?: string;
}

export interface ZeroizeResponse {
    status: 'success' | 'error';
    message?: string;
    handles_cleared?: number;
    error?: string;
}

export interface VerifyIntentResponse {
    status: 'success' | 'error';
    gatekeeper_token?: string;
    verified_at?: number;
    error?: string;
}

export interface ActiveHandle {
    handle: string;
    secret_id: string;
    expires_in: number;
}

export interface ListHandlesResponse {
    status: 'success' | 'error';
    active_handles?: number;
    handles?: ActiveHandle[];
    error?: string;
}

/**
 * Known secret IDs that can be requested from the broker.
 * These map to environment variables in the Docker container.
 */
export type SecretId = 'google_api' | 'gemini_api' | 'embedding_model';

class SecretsBrokerService {
    private readonly brokerUrl: string;
    private readonly timeout: number;

    constructor() {
        // Broker runs inside the Agent Zero Docker container
        this.brokerUrl = 'http://127.0.0.1:50080/auth_broker';
        this.timeout = 10000; // 10s timeout for broker requests
    }

    /**
     * Request an opaque handle for a secret.
     * The actual secret is never returned to the frontend.
     *
     * @param secretId - The identifier for the secret (e.g., 'google_api')
     * @returns The opaque handle to pass to the agent
     */
    async getHandle(secretId: SecretId): Promise<string> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(this.brokerUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'generate_handle', secret_id: secretId }),
                signal: controller.signal
            });

            const data: HandleResponse = await response.json();

            if (data.status !== 'success' || !data.handle) {
                throw new Error(data.error || 'Failed to generate handle');
            }

            if (import.meta.env.DEV) {
                console.debug(`[SecretsBroker] Handle generated for ${secretId}, expires in ${data.expires_in}s`);
            }

            return data.handle;
        } catch (error: any) {
            if (error.name === 'AbortError') {
                throw new Error('Secrets broker request timed out');
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Zeroize all handles for the current session.
     * Call this after a task completes or when the user logs out.
     *
     * @param instruction - Optional instruction context for audit logging
     */
    async zeroize(instruction?: string): Promise<number> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(this.brokerUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'zeroize_session',
                    instruction: instruction || 'manual_zeroization'
                }),
                signal: controller.signal
            });

            const data: ZeroizeResponse = await response.json();

            if (data.status !== 'success') {
                throw new Error(data.error || 'Zeroization failed');
            }

            if (import.meta.env.DEV) {
                console.debug(`[SecretsBroker] Zeroized ${data.handles_cleared} handles`);
            }

            return data.handles_cleared || 0;
        } catch (error: any) {
            if (error.name === 'AbortError') {
                throw new Error('Zeroization request timed out');
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Request gatekeeper approval for high-privilege actions.
     * Part of the R2A2 security layer.
     *
     * @param intent - What the agent intends to do
     * @param proposedAction - The specific action being proposed
     * @returns A gatekeeper token if approved
     */
    async verifyIntent(intent: string, proposedAction: string): Promise<string> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(this.brokerUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'verify_intent',
                    intent,
                    proposed_action: proposedAction
                }),
                signal: controller.signal
            });

            const data: VerifyIntentResponse = await response.json();

            if (data.status !== 'success' || !data.gatekeeper_token) {
                throw new Error(data.error || 'Intent verification failed');
            }

            return data.gatekeeper_token;
        } catch (error: any) {
            if (error.name === 'AbortError') {
                throw new Error('Intent verification timed out');
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * List active handles (for debugging/admin purposes).
     * Does not expose actual secret values.
     */
    async listActiveHandles(): Promise<ActiveHandle[]> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(this.brokerUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'list_handles' }),
                signal: controller.signal
            });

            const data: ListHandlesResponse = await response.json();

            if (data.status !== 'success') {
                throw new Error(data.error || 'Failed to list handles');
            }

            return data.handles || [];
        } catch (error: any) {
            if (error.name === 'AbortError') {
                throw new Error('List handles request timed out');
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Check if the broker is available.
     */
    async isAvailable(): Promise<boolean> {
        try {
            const handles = await this.listActiveHandles();
            return Array.isArray(handles);
        } catch {
            return false;
        }
    }
}

// Export singleton instance
export const secretsBroker = new SecretsBrokerService();
