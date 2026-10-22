import type { AgentDispatchTask } from '@/services/agent/RemoteRelayService';

/** Firestore rejects undefined fields. Payloads are flat; timestamps stay outside this conversion. */
export function serializeDispatchPayload(payload: AgentDispatchTask['payload']): AgentDispatchTask['payload'] {
    return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}
