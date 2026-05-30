// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { e2eEncryptionService, MessageEnvelope } from '@/services/security/E2EEncryptionService';
import { DigitalHandshake } from '@/services/agent/governance/DigitalHandshake';
import { Directive } from '@/services/directive/DirectiveTypes';
import { AgentCard, AgentCardSchema } from './AgentCard';
import { A2ATransport, RouterCallContext } from './transport/A2ATransport';
import { LoopbackA2ATransport } from './transport/LoopbackA2ATransport';
import { HttpA2ATransport } from './transport/HttpA2ATransport';
import { resolveA2AConfig, invalidateA2AConfig, MY_AGENT_ID } from './A2AConfig';
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
  private keyExchangeDone = false;
  private cachedCards: AgentCard[] = [];
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
      this.resetTransport(); // re-probe sidecar availability on next call
    } else {
      throw new A2ATransportUnavailableError('A2A transport breaker is tripped');
    }
  }

  /**
   * Drop the cached transport + config so the next call re-resolves which
   * transport to use (sidecar may have come online/offline).
   */
  private resetTransport(): void {
    this.transport = null;
    this.keyExchangeDone = false;
    invalidateA2AConfig();
  }

  /**
   * Trip the circuit breaker on a genuine TRANSPORT failure.
   *
   * Only HTTP transport network failures should trip the breaker (so the next
   * call falls back to in-process). Loopback runs in-process and cannot have a
   * "transport down" condition — its errors are logic errors (bad request,
   * decrypt/encrypt failure) that must surface as normal errors, not trip the
   * breaker (there is nothing to fall back to; loopback IS the fallback).
   */
  private tripBreaker(error: unknown): void {
    if (error instanceof A2ATransportUnavailableError) return; // Already tripped
    if (this.transport?.kind !== 'http') return; // Loopback errors never trip
    logger.warn('[A2AClient] Circuit breaker tripped due to:', error);
    this.breaker.isTripped = true;
    this.breaker.tripTime = Date.now();
    this.resetTransport(); // next call re-probes and likely falls back to loopback
  }

  /**
   * Ensure the conductor's keypair exists, the router endpoint key is registered,
   * and the router has the conductor's public key (so it can encrypt replies back).
   * Idempotent — safe to call before every invoke/stream.
   *
   * Single-router-identity model: all requests are encrypted to MY_AGENT_ID (the
   * router) and the targetAgentId rides inside the params.
   */
  private async ensureKeyExchange(transport: A2ATransport): Promise<void> {
    if (this.keyExchangeDone) return;

    if (!this.isInitialized) {
      await e2eEncryptionService.initialize(MY_AGENT_ID);
      this.isInitialized = true;
    }

    // Discover the router endpoint key (every card carries the router's key in
    // the single-router-identity model). Register it as the recipient we encrypt to.
    const data = await transport.discovery();
    const cards = z.array(AgentCardSchema).parse(data.agents);
    const routerKey = cards.find((c) => c.publicKeyJwk)?.publicKeyJwk;
    if (routerKey) {
      await e2eEncryptionService.registerPeerPublicKey(MY_AGENT_ID, routerKey as JsonWebKey);
    }

    // Hand the router OUR public key so it can encrypt replies back to us.
    const myKey = await e2eEncryptionService.exportPublicKey(MY_AGENT_ID);
    await transport.postPlain({
      jsonrpc: '2.0',
      method: 'key.exchange',
      params: { senderId: MY_AGENT_ID, publicKeyJwk: myKey },
      id: crypto.randomUUID(),
    });

    this.cachedCards = cards;
    this.keyExchangeDone = true;
  }

  /**
   * Discovers available agents and their cards.
   */
  async discover(): Promise<AgentCard[]> {
    this.checkBreaker();

    try {
      const transport = await this.getTransport();
      await this.ensureKeyExchange(transport);
      return this.cachedCards;
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
      await this.ensureKeyExchange(transport);

      const payload = {
        jsonrpc: '2.0',
        method,
        params: { ...params, senderId: MY_AGENT_ID, targetAgentId: agentId },
        id: crypto.randomUUID(),
      };

      // Encrypt TO the router (MY_AGENT_ID). The targetAgentId rides in params.
      const envelope = await e2eEncryptionService.encryptMessage(payload, MY_AGENT_ID, MY_AGENT_ID);

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
      await this.ensureKeyExchange(transport);

      const payload = {
        jsonrpc: '2.0',
        method: 'stream.init',
        params: { ...params, targetMethod: method, targetAgentId: agentId, senderId: MY_AGENT_ID },
        id: crypto.randomUUID(),
      };

      // Encrypt TO the router (MY_AGENT_ID). The targetAgentId rides in params.
      const envelope = await e2eEncryptionService.encryptMessage(payload, MY_AGENT_ID, MY_AGENT_ID);
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
