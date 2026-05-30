import { MessageEnvelope } from '@/services/security/E2EEncryptionService';

export interface RouterCallContext {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runAgent: (agentId: string, task: string, context: any, traceId?: string, attachments?: any) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parentContext?: any;
  traceId?: string;
  streamAgent?: (agentId: string, task: string, onChunk: (chunk: string) => void) => Promise<void>;
}

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: Record<string, any>;
  id?: string | number;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  postPlain(payload: JsonRpcRequest): Promise<any>;

  /**
   * Fetch the agent discovery document { agents: AgentCard[] }.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
