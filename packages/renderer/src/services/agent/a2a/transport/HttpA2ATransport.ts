import { A2ATransport, RouterCallContext } from './A2ATransport';
import { MessageEnvelope } from '@/services/security/E2EEncryptionService';
import { logger } from '@/utils/logger';
import { fetchWithRetry } from '@/lib/fetchWithRetry';

/**
 * HTTP transport for A2A.
 * Routes encrypted JSON-RPC envelopes to a remote sidecar at baseUrl via HTTP fetch.
 */
export class HttpA2ATransport implements A2ATransport {
  readonly kind = 'http' as const;

  constructor(private baseUrl: string) {}

  // localCtx is accepted for interface parity with LoopbackA2ATransport but is
  // intentionally ignored: an out-of-process HTTP sidecar cannot use the
  // in-process runAgent closure. Kept so the A2ATransport contract is uniform.
  async rpc(envelope: MessageEnvelope, _localCtx?: RouterCallContext): Promise<MessageEnvelope> {
    const response = await fetchWithRetry(`${this.baseUrl}/rpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope),
      throwOnHttpError: false,
    });

    if (!response.ok) {
      throw new Error(`A2A HTTP RPC failed: ${response.statusText} (${response.status})`);
    }

    return response.json();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async postPlain(payload: any): Promise<any> {
    const response = await fetchWithRetry(`${this.baseUrl}/rpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      throwOnHttpError: false,
    });

    if (!response.ok) {
      throw new Error(`A2A HTTP plaintext RPC failed: ${response.statusText}`);
    }

    return response.json();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async discovery(): Promise<{ agents: any[] }> {
    const response = await fetchWithRetry(`${this.baseUrl}/discovery`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      throwOnHttpError: false,
    });

    if (!response.ok) {
      throw new Error(`A2A discovery failed: ${response.statusText}`);
    }

    return response.json();
  }

  async *openStream(requestId: string): AsyncIterable<MessageEnvelope> {
    const eventSource = new EventSource(`${this.baseUrl}/stream/${requestId}`);

    try {
      while (true) {
        const event = await new Promise<MessageEvent>((resolve, reject) => {
          eventSource.onmessage = resolve;
          eventSource.onerror = () => reject(new Error('EventSource error'));
        });

        if (event.data === '[DONE]') {
          break;
        }

        yield JSON.parse(event.data);
      }
    } finally {
      eventSource.close();
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetchWithRetry(`${this.baseUrl}/discovery`, {
        method: 'HEAD',
        timeoutMs: 2000,
        maxRetries: 0,
        throwOnHttpError: false,
      });
      return response.ok;
    } catch (e) {
      logger.debug(`[HttpA2ATransport] Sidecar unavailable: ${e}`);
      return false;
    }
  }
}
