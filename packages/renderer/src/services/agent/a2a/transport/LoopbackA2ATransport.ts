import { A2ATransport, RouterCallContext } from './A2ATransport';
import { MessageEnvelope } from '@/services/security/E2EEncryptionService';
import { logger } from '@/utils/logger';

/**
 * In-process loopback transport for A2A.
 * Routes encrypted JSON-RPC envelopes directly to the A2ARouter (declared below to avoid circular dep).
 * This is the default transport and is always available.
 */
export class LoopbackA2ATransport implements A2ATransport {
  readonly kind = 'loopback' as const;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private router: any = null; // Lazy-loaded to avoid circular dep

  /**
   * Ensure the router is loaded.
   */
  private async getRouter() {
    if (!this.router) {
      const { a2aRouter } = await import('../A2ARouter');
      this.router = a2aRouter;
    }
    return this.router;
  }

  async rpc(envelope: MessageEnvelope, localCtx?: RouterCallContext): Promise<MessageEnvelope> {
    const router = await this.getRouter();
    return router.handleEncrypted(envelope, localCtx);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async postPlain(payload: any): Promise<any> {
    const router = await this.getRouter();
    return router.handlePlain(payload);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async discovery(): Promise<{ agents: any[] }> {
    const router = await this.getRouter();
    const cards = await router.buildDiscovery();
    return { agents: cards };
  }

  async *openStream(requestId: string): AsyncIterable<MessageEnvelope> {
    const router = await this.getRouter();
    const generator = router.getStreamGenerator(requestId);
    if (!generator) {
      logger.warn(`[LoopbackA2ATransport] No stream generator for requestId: ${requestId}`);
      return;
    }
    for await (const message of generator) {
      yield message;
    }
  }

  async isAvailable(): Promise<boolean> {
    // Loopback is always available (runs in-process)
    return true;
  }
}
