import { e2eEncryptionService, MessageEnvelope } from '@/services/security/E2EEncryptionService';
import { DigitalHandshake } from '@/services/agent/governance/DigitalHandshake';
import { Directive } from '@/services/directive/DirectiveTypes';
import { AgentCard, AgentCardSchema } from './AgentCard';
import { A2ATransport, RouterCallContext } from './transport/A2ATransport';
import { LoopbackA2ATransport } from './transport/LoopbackA2ATransport';
import { HttpA2ATransport } from './transport/HttpA2ATransport';
import { resolveA2AConfig, MY_AGENT_ID } from './A2AConfig';
import { z } from 'zod';
import { logger } from '@/utils/logger';

export class A2ATransportUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'A2ATransportUnavailableError';
  }
}

export class A2AClient {
  private isInitialized = false;
  private transport: A2ATransport | null = null;
  private breaker = { isTripped: false, tripTime: 0, cooldown: 30000 };

  /**
   * Get or initialize the transport based on configuration.
   */
  private async getTransport(): Promise<A2ATransport> {
    if (this.transport) return this.transport;

    const config = await resolveA2AConfig();
    if (config.mode === 'http') {
      this.transport = new HttpA2ATransport(config.baseUrl);
    } else {
      this.transport = new LoopbackA2ATransport();
    }

    logger.info(`[A2AClient] Using ${this.transport.kind} transport`);
    return this.transport;
  }

  /**
   * Check and update circuit breaker state.
   */
  private checkBreaker(): void {
    if (!this.breaker.isTripped) return;

    const now = Date.now();
    if (now - this.breaker.tripTime > this.breaker.cooldown) {
      logger.info('[A2AClient] Circuit breaker cooldown expired, resetting');
      this.breaker.isTripped = false;
    } else {
      throw new A2ATransportUnavailableError('A2A transport breaker is tripped');
    }
  }

  /**
   * Trip the circuit breaker on network error.
   */
  private tripBreaker(error: any): void {
    if (error instanceof A2ATransportUnavailableError) return; // Already tripped
    logger.warn('[A2AClient] Circuit breaker tripped due to:', error);
    this.breaker.isTripped = true;
    this.breaker.tripTime = Date.now();
  }

  /**
   * Discovers available agents and their cards.
   */
  async discover(): Promise<AgentCard[]> {
    this.checkBreaker();

    try {
      const transport = await this.getTransport();

      if (!this.isInitialized) {
        await e2eEncryptionService.initialize(MY_AGENT_ID);
        this.isInitialized = true;
      }

      // Use discovery() to get the agent cards
      const data = await transport.discovery();
      const cards = z.array(AgentCardSchema).parse(data.agents);

      // Exchange keys with each agent
      const myKey = await e2eEncryptionService.exportPublicKey(MY_AGENT_ID);

      for (const card of cards) {
        if (card.publicKeyJwk) {
          await e2eEncryptionService.registerPeerPublicKey(card.agentId, card.publicKeyJwk);

          // Exchange our public key
          await transport.postPlain({
            jsonrpc: '2.0',
            method: 'key.exchange',
            params: { senderId: MY_AGENT_ID, publicKeyJwk: myKey },
            id: crypto.randomUUID(),
          });
        }
      }

      return cards;
    } catch (error) {
      if (!(error instanceof A2ATransportUnavailableError)) {
        this.tripBreaker(error);
      }
      throw error;
    }
  }

  /**
   * Synchronous JSON-RPC invocation with circuit breaker + fallback.
   */
  async invoke(
    agentId: string,
    method: string,
    params: Record<string, unknown>,
    directive: Directive,
    localCtx?: RouterCallContext
  ): Promise<unknown> {
    this.checkBreaker();

    const approved = await DigitalHandshake.require(
      directive,
      `Consult specialist ${agentId} via A2A sync`,
      false,
      'a2a:consult'
    );

    if (!approved) {
      throw new Error('A2A invocation paused for Digital Handshake approval');
    }

    try {
      const transport = await this.getTransport();

      const payload = {
        jsonrpc: '2.0',
        method,
        params: { ...params, senderId: MY_AGENT_ID, targetAgentId: agentId },
        id: crypto.randomUUID(),
      };

      const envelope = await e2eEncryptionService.encryptMessage(payload, agentId, MY_AGENT_ID);

      // Call with localCtx for loopback to use
      const responseEnvelope = await transport.rpc(envelope, localCtx);
      const decrypted = await e2eEncryptionService.decryptMessage(responseEnvelope, MY_AGENT_ID);

      if ('error' in decrypted) {
        throw new Error(`RPC Error: ${JSON.stringify(decrypted.error)}`);
      }

      return decrypted.result;
    } catch (error) {
      if (!(error instanceof A2ATransportUnavailableError)) {
        this.tripBreaker(error);
      }
      throw error;
    }
  }

  /**
   * Server-Sent Events stream for long-running processes.
   */
  async *stream(
    agentId: string,
    method: string,
    params: Record<string, unknown>,
    directive: Directive,
    localCtx?: RouterCallContext
  ): AsyncIterable<unknown> {
    this.checkBreaker();

    const approved = await DigitalHandshake.require(
      directive,
      `Consult specialist ${agentId} via A2A stream`,
      false,
      'a2a:consult'
    );

    if (!approved) {
      throw new Error('A2A stream paused for Digital Handshake approval');
    }

    try {
      const transport = await this.getTransport();

      const payload = {
        jsonrpc: '2.0',
        method: 'stream.init',
        params: { ...params, targetMethod: method, targetAgentId: agentId, senderId: MY_AGENT_ID },
        id: crypto.randomUUID(),
      };

      const envelope = await e2eEncryptionService.encryptMessage(payload, agentId, MY_AGENT_ID);
      const responseEnvelope = await transport.rpc(envelope, localCtx);
      const decryptedInit = await e2eEncryptionService.decryptMessage(responseEnvelope, MY_AGENT_ID);

      if ('error' in decryptedInit) {
        throw new Error(`RPC Error initializing stream: ${JSON.stringify(decryptedInit.error)}`);
      }

      const requestId = (decryptedInit.result as { requestId: string }).requestId;

      // Consume the stream
      for await (const eventEnvelope of transport.openStream(requestId)) {
        const decryptedEvent = await e2eEncryptionService.decryptMessage(eventEnvelope, MY_AGENT_ID);
        yield decryptedEvent;
      }
    } catch (error) {
      if (!(error instanceof A2ATransportUnavailableError)) {
        this.tripBreaker(error);
      }
      throw error;
    }
  }
}

export const a2aClient = new A2AClient();
