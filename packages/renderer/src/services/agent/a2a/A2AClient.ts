import { e2eEncryptionService, MessageEnvelope } from '@/services/security/E2EEncryptionService';
import { DigitalHandshake } from '@/services/agent/governance/DigitalHandshake';
import { Directive } from '@/services/directive/DirectiveTypes';
import { AgentCard, AgentCardSchema } from './AgentCard';
import { z } from 'zod';

const SIDECAR_URL = 'http://localhost:50080/a2a';
const MY_AGENT_ID = 'indiiOS-conductor'; // This could be dynamic later

export class A2AClient {
  private isInitialized = false;

  /**
   * Discovers available agents and their cards.
   */
  async discover(): Promise<AgentCard[]> {
    const response = await fetch(`${SIDECAR_URL}/discovery`);
    if (!response.ok) {
      throw new Error(`Failed to discover agents: ${response.statusText}`);
    }
    const data = await response.json();
    const cards = z.array(AgentCardSchema).parse(data.agents);

    if (!this.isInitialized) {
      await e2eEncryptionService.initialize(MY_AGENT_ID);
      this.isInitialized = true;
    }

    const myKey = await e2eEncryptionService.exportPublicKey(MY_AGENT_ID);

    for (const card of cards) {
      if (card.publicKeyJwk) {
        await e2eEncryptionService.registerPeerPublicKey(card.agentId, card.publicKeyJwk);
        
        // Exchange our public key with the sidecar
        await fetch(`${SIDECAR_URL}/rpc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'key.exchange',
            params: { senderId: MY_AGENT_ID, publicKeyJwk: myKey },
            id: crypto.randomUUID(),
          }),
        });
      }
    }

    return cards;
  }

  /**
   * Synchronous JSON-RPC invocation
   */
  async invoke(
    agentId: string,
    method: string,
    params: Record<string, unknown>,
    directive: Directive
  ): Promise<unknown> {
    const approved = await DigitalHandshake.require(
      directive,
      `Consult specialist ${agentId} via A2A sync`,
      false,
      'a2a:consult'
    );

    if (!approved) {
      throw new Error('A2A invocation paused for Digital Handshake approval');
    }

    const payload = {
      jsonrpc: '2.0',
      method,
      params,
      id: crypto.randomUUID(),
    };

    const envelope = await e2eEncryptionService.encryptMessage(payload, agentId, MY_AGENT_ID);

    const response = await fetch(`${SIDECAR_URL}/rpc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(envelope),
    });

    if (!response.ok) {
      throw new Error(`A2A invoke failed: ${response.statusText}`);
    }

    const responseEnvelope = (await response.json()) as MessageEnvelope;
    const decrypted = await e2eEncryptionService.decryptMessage(responseEnvelope, MY_AGENT_ID);
    
    if ('error' in decrypted) {
      throw new Error(`RPC Error: ${JSON.stringify(decrypted.error)}`);
    }

    return decrypted.result;
  }

  /**
   * Server-Sent Events stream for long-running processes
   */
  async *stream(
    agentId: string,
    method: string,
    params: Record<string, unknown>,
    directive: Directive
  ): AsyncIterable<unknown> {
    const approved = await DigitalHandshake.require(
      directive,
      `Consult specialist ${agentId} via A2A stream`,
      false,
      'a2a:consult'
    );

    if (!approved) {
      throw new Error('A2A stream paused for Digital Handshake approval');
    }

    // First initiate the stream via RPC to get a requestId
    const payload = {
      jsonrpc: '2.0',
      method: 'stream.init',
      params: { ...params, targetMethod: method },
      id: crypto.randomUUID(),
    };

    const envelope = await e2eEncryptionService.encryptMessage(payload, agentId, MY_AGENT_ID);
    const initResponse = await fetch(`${SIDECAR_URL}/rpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope),
    });

    if (!initResponse.ok) {
      throw new Error(`Failed to initialize A2A stream: ${initResponse.statusText}`);
    }

    const initEnvelope = (await initResponse.json()) as MessageEnvelope;
    const decryptedInit = await e2eEncryptionService.decryptMessage(initEnvelope, MY_AGENT_ID);
    
    if ('error' in decryptedInit) {
      throw new Error(`RPC Error initializing stream: ${JSON.stringify(decryptedInit.error)}`);
    }

    const requestId = (decryptedInit.result as { requestId: string }).requestId;

    // Now connect via EventSource
    const eventSource = new EventSource(`${SIDECAR_URL}/stream/${requestId}`);

    try {
      while (true) {
        const event = await new Promise<MessageEvent>((resolve, reject) => {
          eventSource.onmessage = resolve;
          eventSource.onerror = reject;
        });

        if (event.data === '[DONE]') {
          break;
        }

        const eventEnvelope = JSON.parse(event.data) as MessageEnvelope;
        const decryptedEvent = await e2eEncryptionService.decryptMessage(eventEnvelope, MY_AGENT_ID);
        yield decryptedEvent;
      }
    } finally {
      eventSource.close();
    }
  }
}

export const a2aClient = new A2AClient();
