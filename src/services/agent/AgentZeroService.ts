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
            baseUrl: 'http://localhost:50080',
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
        const rawString = `${runtimeId}:${authLogin}:${authPassword}`;

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
            'Authorization': `Bearer ${this.token}`, // Agent Zero might expect specific header, usually 'Authorization'
            // Based on api_message.py, it checks LoginRequired. login.py usually checks a cookie or header.
            // Let's verify how Agent Zero expects the token. 
            // Looking at `api.py` or standard Flask expectations. 
            // Often it's 'X-API-Key' or similar if it's a custom token.
            // BUT: The UI uses a cookie 'auth_token'. 
            // Let's try sending it as a Cookie header if possible, or looking for a specific header key.
            // If it's a standard Bearer token for API, Authorization is standard.
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

            // Note: Since we are calling localhost from the renderer (browser context),
            // we might hit CORS issues if the Docker container doesn't allow it.
            // Electron webSecurity might need to be disabled or we proxy through Main process.
            // For now, we assume standard fetch.
            const response = await fetch(`${this.config.baseUrl}/api/message`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Agent Zero API Error (${response.status}): ${errorText}`);
            }

            const data = await response.json();
            return data;
        } catch (e) {
            console.error('[AgentZeroService] Send Message Failed:', e);
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
