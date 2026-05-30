import { MessageEnvelope } from '@/services/security/E2EEncryptionService';

export interface RouterCallContext {
  runAgent: (agentId: string, task: string, context: any, traceId?: string, attachments?: any) => Promise<any>;
  parentContext?: any;
  traceId?: string;
  streamAgent?: (agentId: string, task: string, onChunk: (chunk: string) => void) => Promise<void>;
}

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, any>;
  id?: string | number;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  result?: any;
  error?: { code: number; message: string; data?: any };
  id?: string | number;
}

export interface A2ATransport {
  /**
   * Send a JSON-RPC envelope (E2E-encrypted) and return the response envelope.
   * For loopback transport, localCtx provides the live runAgent function.
   */
  rpc(envelope: MessageEnvelope, localCtx?: RouterCallContext): Promise<MessageEnvelope>;

  /**
   * Send plaintext JSON-RPC requests that precede key exchange (discovery, key.exchange).
   */
  postPlain(payload: JsonRpcRequest): Promise<any>;

  /**
   * Fetch the agent discovery document { agents: AgentCard[] }.
   */
  discovery(): Promise<{ agents: any[] }>;

  /**
   * Open an SSE-equivalent async stream for a previously-initiated requestId.
   */
  openStream(requestId: string): AsyncIterable<MessageEnvelope>;

  /**
   * Cheap liveness probe used by the circuit breaker.
   */
  isAvailable(): Promise<boolean>;

  /**
   * Transport kind for logging/debugging.
   */
  readonly kind: 'http' | 'loopback';
}
