import CryptoJS from 'crypto-js';

// Configuration interface
export interface AgentZeroConfig {
    baseUrl: string;
    runtimeId: string;
    authLogin: string;
    authPassword: string;
}

// Response interfaces
export interface AgentZeroResponse {
    message: string; // The text response
    tool_calls?: any[];
    attachments?: string[];
}

export interface HistoryItem {
    role: string;
    content: string;
    timestamp: number;
}

/**
 * Service to communicate with the Agent Zero Docker container.
 */
class AgentZeroService {
    private config: AgentZeroConfig;
    private token: string | null = null;

    constructor() {
        // Defaults - in production, these should be loaded from secure storage or env
        // For the single-user desktop app, we use the values we found/know.
        this.config = {
            baseUrl: 'http://127.0.0.1:50080',
            // Defaulting to the value found in the docker container. 
            // In a real app this should be configurable.
            runtimeId: import.meta.env.VITE_A0_RUNTIME_ID || 'c13febd01bf518de389462d4d48b2285',
            authLogin: import.meta.env.VITE_A0_AUTH_LOGIN || '',
            authPassword: import.meta.env.VITE_A0_AUTH_PASSWORD || '',
        };

        this.generateAuthToken();
    }

    /**
     * Generates the authentication token required by Agent Zero headers.
     * Logic: sha256(runtime_id:username:password) -> base64 -> first 16 chars
     */
    private generateAuthToken() {
        const { runtimeId, authLogin, authPassword } = this.config;

        // Match the working diagnostic pattern: 
        // If login/pass are empty, only use runtimeId + "::"
        // This is important because the container we probed works with this format.
        const rawString = authLogin || authPassword
            ? `${runtimeId}:${authLogin}:${authPassword}`
            : `${runtimeId}::`;

        // SHA256 Hash
        const hash = CryptoJS.SHA256(rawString);

        // Base64 Encode
        const base64 = CryptoJS.enc.Base64.stringify(hash);

        // URL Safe (replace + with -, / with _) and remove = padding
        const urlSafe = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

        // First 16 chars
        this.token = urlSafe.substring(0, 16);
        console.log('[AgentZeroService] Generated Token:', this.token);
    }

    private getHeaders() {
        if (!this.token) this.generateAuthToken();
        return {
            'Content-Type': 'application/json',
            'X-API-KEY': this.token || '',
            'X-Requested-With': 'XMLHttpRequest' // Helps bypass some simple CORS/security filters
        };
    }

    /**
     * Sends a message to Agent Zero.
     */
    async sendMessage(message: string, attachments?: { filename: string; base64: string }[], contextId?: string): Promise<AgentZeroResponse> {
        try {
            const payload: any = {
                message,
                context_id: contextId,
            };

            if (attachments && attachments.length > 0) {
                payload.attachments = attachments;
            }

            // Note: Endpoint is /api_message (defaults to 50080 port logic)
            const response = await fetch(`${this.config.baseUrl}/api_message`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                // Handle non-JSON error responses (like 404 HTML pages)
                if (errorText.includes('<html')) {
                    throw new Error(`Agent Zero API Error (${response.status}): Agent Zero might be down or unreachable.`);
                }
                throw new Error(`Agent Zero API Error (${response.status}): ${errorText}`);
            }

            const data = await response.json();
            // Map python 'response' key to 'message'
            return {
                message: data.response || data.message || "Agent Zero: No text response.",
                attachments: data.attachments || []
                // TODO: Parse tool calls if available in data
            };
        } catch (e: any) {
            console.error('[AgentZeroService] Send Message Failed:', {
                message: e.message,
                stack: e.stack,
                cause: e.cause
            });

            // Check for connection refusal (Docker container down)
            if (e.message && (e.message.includes('Failed to fetch') || e.message.includes('NetworkError'))) {
                throw new Error('Agent Zero Unreachable. Is Docker container running on port 50080? (Check CORS in Browser Console)');
            }

            throw e;
        }
    }

    async getHistory(contextId: string): Promise<HistoryItem[]> {
        const response = await fetch(`${this.config.baseUrl}/api/history/get`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ context_id: contextId })
        });

        if (!response.ok) throw new Error('Failed to fetch history');
        return await response.json();
    }
}

export const agentZeroService = new AgentZeroService();
