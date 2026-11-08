/**
 * AgentStreamingService
 *
 * Handles real-time streaming of agent responses via Server-Sent Events (SSE).
 * Integrates with Cloud Function v2 agentStreamResponse endpoint over HTTP POST.
 *
 * Features:
 * - Token-by-token streaming via fetch + ReadableStream reader
 * - Authenticated with Firebase ID token (Authorization: Bearer) and App Check
 * - Automatic exponential-backoff reconnection on network loss
 * - Clean cancellation via AbortController
 * - Metadata tracking (latency, token count, duration)
 */

import { logger } from '@/utils/logger';
import { importWithRetry } from '@/utils/dynamicImport';

interface StreamToken {
  token: string;
  index: number;
  timestamp: number;
}

interface StreamMetadata {
  totalTokens: number;
  duration: number;
  latency: number;
  completedAt: number;
}

interface StreamState {
  isStreaming: boolean;
  tokens: string[];
  metadata: Partial<StreamMetadata>;
  error: Error | null;
}

interface StreamRequestParams {
  input: string;
  agentId: string;
  userId: string;
  context?: Record<string, unknown>;
  costReservationId?: string;
  endpoint?: string;
}

export class AgentStreamingService {
  private abortController: AbortController | null = null;
  private currentParams: StreamRequestParams | null = null;
  private state: StreamState = {
    isStreaming: false,
    tokens: [],
    metadata: {},
    error: null,
  };
  private startTime: number = 0;
  private streamCallbacks: {
    onToken?: (token: string, index: number) => void;
    onComplete?: (metadata: StreamMetadata) => void;
    onError?: (error: Error) => void;
  } = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 1000;

  /**
   * Start streaming agent response
   */
  async stream(
    input: string,
    agentId: string,
    userId: string,
    context?: Record<string, unknown>,
    callbacks?: typeof this.streamCallbacks,
    options?: { costReservationId?: string; endpoint?: string },
  ): Promise<void> {
    try {
      if (this.state.isStreaming) {
        throw new Error('Stream already in progress');
      }

      this.currentParams = {
        input,
        agentId,
        userId,
        context,
        costReservationId: options?.costReservationId,
        endpoint: options?.endpoint,
      };

      this.streamCallbacks = callbacks || {};
      this.state.isStreaming = true;
      this.state.tokens = [];
      this.state.error = null;
      this.startTime = Date.now();
      this.reconnectAttempts = 0;
      this.abortController = new AbortController();

      await this.executeStream();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.state.error = err;
      this.state.isStreaming = false;
      this.streamCallbacks.onError?.(err);
      logger.error('[AgentStream] Stream initialization failed', err);
    }
  }

  /**
   * Stop streaming
   */
  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.state.isStreaming = false;
  }

  /**
   * Get current stream state
   */
  getState(): StreamState {
    return { ...this.state };
  }

  /**
   * Reset service state
   */
  reset(): void {
    this.stop();
    this.currentParams = null;
    this.state = {
      isStreaming: false,
      tokens: [],
      metadata: {},
      error: null,
    };
    this.streamCallbacks = {};
    this.reconnectAttempts = 0;
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private async executeStream(): Promise<void> {
    if (!this.currentParams) return;
    const { input, agentId, userId, context, costReservationId, endpoint: customEndpoint } = this.currentParams;

    if (!this.abortController) {
      this.abortController = new AbortController();
    }
    const controller = this.abortController;

    try {
      const idToken = await this.getIdToken();
      if (controller.signal.aborted) return;

      const appCheckToken = await this.getAppCheckToken();
      if (controller.signal.aborted) return;

      let targetUrl: string;
      if (customEndpoint) {
        targetUrl = customEndpoint;
      } else {
        const { endpointService } = await importWithRetry(() => import('@/core/config/EndpointService'));
        targetUrl = endpointService.getFunctionUrl('agentStreamResponse');
      }

      if (controller.signal.aborted) return;

      const requestBody = JSON.stringify({
        userId,
        agentId,
        input,
        ...(context ? { context } : {}),
        ...(costReservationId ? { costReservationId } : {}),
      });

      logger.info(`[AgentStream] Connecting POST stream to ${targetUrl} (agent=${agentId})`);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      };
      if (appCheckToken) {
        headers['X-Firebase-AppCheck'] = appCheckToken;
      }

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: requestBody,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`Stream request failed (${response.status}): ${errorText}`);
        if (response.status >= 400 && response.status < 500) {
          // Client or auth error (4xx) - fail immediately without retry loop
          this.state.error = error;
          this.state.isStreaming = false;
          this.streamCallbacks.onError?.(error);
          return;
        }
        throw error;
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported on response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr) continue;

          try {
            const data = JSON.parse(jsonStr) as Partial<StreamToken> & {
              complete?: boolean;
              totalTokens?: number;
              error?: string;
            };

            if (data.error) {
              throw new Error(data.error);
            }

            if (data.complete) {
              this.finishStream(data.totalTokens ?? this.state.tokens.length);
              return;
            } else if (data.token !== undefined) {
              const token = String(data.token);
              const index = typeof data.index === 'number' ? data.index : this.state.tokens.length;
              this.state.tokens.push(token);
              this.streamCallbacks.onToken?.(token, index);
            }
          } catch (err) {
            logger.error('[AgentStream] Failed to parse token frame:', err);
          }
        }
      }

      if (this.state.isStreaming) {
        this.finishStream(this.state.tokens.length);
      }
    } catch (error) {
      if (controller.signal.aborted) {
        logger.info('[AgentStream] Stream aborted by client.');
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      this.handleStreamError(message);
    } finally {
      if (this.abortController === controller) {
        this.abortController = null;
      }
    }
  }

  private finishStream(totalTokens: number): void {
    const duration = Date.now() - this.startTime;

    this.state.metadata = {
      totalTokens,
      duration,
      latency: 0,
      completedAt: Date.now(),
    };

    this.state.isStreaming = false;
    this.streamCallbacks.onComplete?.(this.state.metadata as StreamMetadata);

    logger.info(`[AgentStream] Stream completed: ${totalTokens} tokens in ${duration}ms`);
  }

  private handleStreamError(message: string): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts && this.currentParams) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

      logger.warn(
        `[AgentStream] Reconnecting (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`
      );

      setTimeout(() => {
        if (this.state.isStreaming) {
          void this.executeStream();
        }
      }, delay);
    } else {
      const error = new Error(`${message} - Max reconnect attempts reached`);
      this.state.error = error;
      this.state.isStreaming = false;
      this.streamCallbacks.onError?.(error);
      logger.error('[AgentStream] Stream failed after max retries', error);
    }
  }

  private async getIdToken(): Promise<string> {
    try {
      const { auth } = await importWithRetry(() => import('@/services/firebase'));
      if (!auth.currentUser) {
        throw new Error('User not authenticated');
      }
      return await auth.currentUser.getIdToken();
    } catch (error) {
      throw new Error(
        `Failed to get ID token: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async getAppCheckToken(): Promise<string | undefined> {
    try {
      const { appCheck } = await importWithRetry(() => import('@/services/firebase'));
      if (!appCheck) return undefined;
      const { getToken } = await import('firebase/app-check');
      const tokenResult = await getToken(appCheck);
      return tokenResult?.token;
    } catch (error) {
      logger.warn('[AgentStream] Could not obtain App Check token:', error);
      return undefined;
    }
  }
}

// ============================================================================
// Singleton
// ============================================================================

let agentStreamingService: AgentStreamingService | null = null;

export function initializeAgentStreamingService(): AgentStreamingService {
  agentStreamingService = new AgentStreamingService();
  return agentStreamingService;
}

export function getAgentStreamingService(): AgentStreamingService {
  if (!agentStreamingService) {
    agentStreamingService = new AgentStreamingService();
  }
  return agentStreamingService;
}
