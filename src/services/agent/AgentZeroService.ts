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

export interface AgentTaskRequest {
    project_id: string;
    instruction: string;
    agent_profile?: string;
    variables?: Record<string, any>;
}

export interface AgentTaskResponse {
    status: 'success' | 'error';
    data?: {
        response: string;
        project_id: string;
        files: string[];
    };
    message?: string;
}

export interface ProvisionProjectRequest {
    project_id: string; // e.g., "dept_legal" or "artist_uuid"
    role_type: string; // e.g., "legal_expert"
    initial_secrets?: Record<string, string>;
}

export interface SyncProjectRequest {
    project_id: string;
    sync_type: 'metadata_update' | 'asset_refresh';
    data: Record<string, any>;
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
        // Security: Token logging removed - only log in dev mode without exposing value
        if (import.meta.env.DEV) {
            console.debug('[AgentZeroService] Auth token generated');
        }
    }

    /**
     * Fetch wrapper with timeout support to prevent hung requests.
     * @param url - The URL to fetch
     * @param options - Fetch options
     * @param timeoutMs - Timeout in milliseconds (default: 30s, LLM ops use 60s)
     */
    private async fetchWithTimeout(
        url: string,
        options: RequestInit,
        timeoutMs: number = 30000
    ): Promise<Response> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            return response;
        } catch (error: any) {
            if (error.name === 'AbortError') {
                throw new Error(`Request timed out after ${timeoutMs}ms`);
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
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
     * Central API caller that handles Electron Proxy vs Web Fetch.
     * Electron proxy is preferred to bypass CORS for localhost:50080.
     */
    private async callApi(endpoint: string, payload: any, timeoutMs: number = 30000): Promise<any> {
        const fullUrl = endpoint.startsWith('http') ? endpoint : `${this.config.baseUrl}${endpoint}`;
        const headers = this.getHeaders();

        // 1. Try Electron Proxy (Full CORS bypass)
        if (typeof window !== 'undefined' && (window as any).electronAPI?.agent?.proxyZero) {
            console.debug(`[AgentZeroService] Using Electron Proxy for: ${fullUrl}`);
            const result = await (window as any).electronAPI.agent.proxyZero(fullUrl, payload, headers);

            if (!result.success) {
                if (result.status === 401) throw new Error('Agent Zero: Unauthorized (Invalid Token)');
                if (result.status === 404) throw new Error(`Agent Zero: Endpoint not found (${fullUrl})`);
                throw new Error(result.error || `Agent Zero Proxy Error (${result.status || 'Network'})`);
            }

            return result.data;
        }

        // 2. Fallback to standard fetch (Web mode)
        console.debug(`[AgentZeroService] Using Native Fetch for: ${fullUrl}`);
        const response = await this.fetchWithTimeout(
            fullUrl,
            {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            },
            timeoutMs
        );

        if (!response.ok) {
            const errorText = await response.text();
            if (errorText.includes('<html')) throw new Error(`Agent Zero API Error (${response.status}): Down or unreachable.`);
            throw new Error(`Agent Zero API Error (${response.status}): ${errorText}`);
        }

        return await response.json();
    }

    /**
     * Processes strings to find img:// URLs and append cache busting timestamps.
     */
    private processUrls(text: string): string {
        if (!text || typeof text !== 'string') return text;

        const timestamp = Date.now();
        // Regex to find img://... sequences
        // Note: We assume the image path ends with a space, newline, quote, or end of string
        return text.replace(/img:\/\/([^\s"']+)/g, (match, path) => {
            const separator = path.includes('?') ? '&' : '?';
            return `img://${path}${separator}t=${timestamp}`;
        });
    }

    /**
     * Sends a message to Agent Zero.
     */
    async sendMessage(message: string, attachments?: { filename: string; base64: string }[], contextId?: string, systemOverride?: string): Promise<AgentZeroResponse> {
        try {
            const payload: any = {
                message,
                context_id: contextId,
                ...(systemOverride && { system_override: systemOverride }),
            };

            if (attachments && attachments.length > 0) {
                payload.attachments = attachments;
            }

            // Using 60s timeout for LLM operations via callApi helper
            const data = await this.callApi('/api_message', payload, 60000);

            // Apply img:// cache busting
            const processedMessage = this.processUrls(data.response || data.message || "Agent Zero: No text response.");
            const processedAttachments = (data.attachments || []).map((a: string) => this.processUrls(a));

            return {
                message: processedMessage,
                attachments: processedAttachments
            };
        } catch (e: any) {
            console.error('[AgentZeroService] Send Message Failed:', {
                message: e.message,
                stack: e.stack,
                cause: e.cause
            });

            // Check for connection refusal (Docker container down)
            if (e.message && (e.message.includes('Failed to fetch') || e.message.includes('NetworkError') || e.message.includes('Proxy Error'))) {
                throw new Error('Agent Zero Unreachable. Is Docker container running on port 50080? (Main Process Proxy failed)');
            }

            throw e;
        }
    }

    async getHistory(contextId: string): Promise<HistoryItem[]> {
        const response = await this.fetchWithTimeout(
            `${this.config.baseUrl}/api/history/get`,
            {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ context_id: contextId })
            },
            30000 // 30s for history fetch
        );

        if (!response.ok) throw new Error('Failed to fetch history');
        const history: HistoryItem[] = await response.json();
        return history.map(item => ({
            ...item,
            content: this.processUrls(item.content)
        }));
    }

    /**
     * Executes a structured task via the custom Indii API handler.
     * Enforces project isolation and context switching.
     */
    async executeTask(request: AgentTaskRequest): Promise<AgentTaskResponse> {
        try {
            // Using 120s timeout for complex tasks via callApi helper
            const data = await this.callApi('/indii_task', request, 120000);

            if (data.agent_response) {
                data.agent_response = this.processUrls(data.agent_response);
            }
            return data;
        } catch (e: any) {
            console.error('[AgentZeroService] Execute Task Error:', e);
            throw e;
        }
    }

    /**
     * Provisions a new project environment (Department/Artist).
     * Mapped to /api/provision_project
     */
    async provisionProject(request: ProvisionProjectRequest): Promise<any> {
        const endpoint = `${this.config.baseUrl}/provision_project`;
        try {
            const response = await this.fetchWithTimeout(
                endpoint,
                {
                    method: 'POST',
                    headers: this.getHeaders(),
                    body: JSON.stringify(request)
                },
                30000 // 30s for provisioning
            );

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Provisioning Failed (${response.status}): ${text}`);
            }

            return await response.json();
        } catch (e: any) {
            console.error('[AgentZeroService] Provision Project Error:', e);
            throw e;
        }
    }

    /**
     * Synchronize state/metadata with the Agent.
     * Mapped to /api/indii_sync
     */
    async syncProject(request: SyncProjectRequest): Promise<any> {
        const endpoint = `${this.config.baseUrl}/indii_sync`;
        try {
            const response = await this.fetchWithTimeout(
                endpoint,
                {
                    method: 'POST',
                    headers: this.getHeaders(),
                    body: JSON.stringify(request)
                },
                30000 // 30s for sync
            );

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Sync Failed (${response.status}): ${text}`);
            }

            return await response.json();
        } catch (e: any) {
            console.error('[AgentZeroService] Sync Project Error:', e);
            throw e;
        }
    }
}

export const agentZeroService = new AgentZeroService();
