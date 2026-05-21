import { env } from '@/config/env';
import { logger } from '@/utils/logger';

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
        const endpoint = `${this.baseUrl}/api/agent/${agentId}/trigger`;
        logger.debug(`[AgentAPIClient] Triggering agent ${agentId} at ${endpoint}`);

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                // Return mock response if baseUrl is empty or if we are in local development testing mode
                if (!this.baseUrl || env.DEV) {
                    logger.debug(`[AgentAPIClient] Local/Dev mode active: returning mock response for agent ${agentId}`);
                    return {
                        success: true,
                        text: `[MOCK_RESPONSE] Agent '${agentId}' successfully processed courtroom request.`,
                        thoughtSignature: `mock-sig-${Date.now()}`
                    };
                }

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${env.VITE_API_KEY || ''}`
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
                }

                const data = await response.json() as AgentTriggerResponse;
                return data;
            } catch (error: unknown) {
                const isLastAttempt = attempt === retries;
                const errMessage = error instanceof Error ? error.message : String(error);
                logger.warn(`[AgentAPIClient] Attempt ${attempt} failed to trigger agent ${agentId}: ${errMessage}`);

                if (isLastAttempt) {
                    logger.error(`[AgentAPIClient] Terminal failure: all retry attempts exhausted for agent ${agentId}`);
                    return {
                        success: false,
                        error: `Failed to contact specialist agent ${agentId} after ${retries} attempts: ${errMessage}`
                    };
                }

                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt - 1)));
            }
        }

        return {
            success: false,
            error: 'Unknown error occurred during API dispatch.'
        };
    }
}
