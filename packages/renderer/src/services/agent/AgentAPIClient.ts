import { env } from '@/config/env';
import { logger } from '@/utils/logger';
import { fetchWithRetry } from '@/lib/fetchWithRetry';

export interface AgentTriggerPayload {
    prompt: string;
    context?: Record<string, unknown>;
    attachments?: Array<{ mimeType: string; base64: string }>;
}

export interface AgentTriggerResponse {
    success: boolean;
    text?: string;
    thoughtSignature?: string;
    error?: string;
}

/**
 * AgentAPIClient
 *
 * Premium high-fidelity HTTP client connecting courtroom and boardroom agents
 * to external and internal specialized execution endpoints with automated retry
 * logic and robust error boundary mitigations.
 */
export class AgentAPIClient {
    private static baseUrl = env.VITE_FUNCTIONS_URL || '';

    /**
     * Triggers a remote specialized agent with retry support and robust error logging.
     * Can trigger standard GCP Cloud Functions or direct GenAI APIs.
     */
    static async triggerAgent(
        agentId: string,
        payload: AgentTriggerPayload,
        retries = 3,
        delay = 1000
    ): Promise<AgentTriggerResponse> {
        if (import.meta.env.VITE_INTELLIGENCE_MOCK_MODE === 'true') {
            logger.error(`[AgentAPIClient] VITE_INTELLIGENCE_MOCK_MODE=true is no longer supported for agent ${agentId}`);
            return {
                success: false,
                error: 'Mock agent responses are disabled. Configure VITE_FUNCTIONS_URL and tuned agent endpoints.'
            };
        }

        if (!this.baseUrl) {
            logger.error(`[AgentAPIClient] Missing VITE_FUNCTIONS_URL; refusing mock response for agent ${agentId}`);
            return {
                success: false,
                error: 'VITE_FUNCTIONS_URL is required to trigger specialist agents. Mock responses are disabled.'
            };
        }

        const endpoint = `${this.baseUrl}/api/agent/${agentId}/trigger`;
        logger.debug(`[AgentAPIClient] Triggering agent ${agentId} at ${endpoint}`);

        try {
            const response = await fetchWithRetry(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${env.VITE_API_KEY || ''}`
                },
                body: JSON.stringify(payload),
                maxRetries: retries - 1, // triggerAgent retries logic passed 'retries' as total attempts, fetchWithRetry takes max retries
                baseDelayMs: delay,
                throwOnHttpError: true
            });

            const data = await response.json() as AgentTriggerResponse;
            return data;
        } catch (error: unknown) {
            const errMessage = error instanceof Error ? error.message : String(error);
            logger.error(`[AgentAPIClient] Terminal failure for agent ${agentId}: ${errMessage}`);
            return {
                success: false,
                error: `Failed to contact specialist agent ${agentId}: ${errMessage}`
            };
        }
    }
}
