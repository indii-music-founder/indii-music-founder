export type DisputeLifecycleEventType =
  | 'charge.dispute.created'
  | 'charge.dispute.updated'
  | 'charge.dispute.closed'
  | 'charge.dispute.funds_withdrawn'
  | 'charge.dispute.funds_reinstated';

const priority: Record<DisputeLifecycleEventType, number> = {
  'charge.dispute.created': 0,
  'charge.dispute.updated': 1,
  'charge.dispute.funds_withdrawn': 2,
  'charge.dispute.closed': 3,
  'charge.dispute.funds_reinstated': 4,
};
const terminal = new Set(['won', 'lost', 'warning_closed']);

/** Keep a late or same-second webhook from reverting a terminal finance record. */
export function shouldAdvanceDisputeSummary(
  previous: { lastEventCreated?: unknown; lastEventType?: unknown; status?: unknown } | undefined,
  incoming: { created: number; type: DisputeLifecycleEventType; status: string },
): boolean {
  if (!Number.isSafeInteger(incoming.created) || incoming.created <= 0) throw new Error('Invalid dispute event time');
  if (terminal.has(String(previous?.status)) && !terminal.has(incoming.status)) return false;
  if (!terminal.has(String(previous?.status)) && terminal.has(incoming.status)) return true;
  const last = previous?.lastEventCreated;
  if (typeof last !== 'number' || !Number.isSafeInteger(last)) return true;
  if (incoming.created !== last) return incoming.created > last;
  const oldType = previous?.lastEventType as DisputeLifecycleEventType;
  return priority[incoming.type] >= (priority[oldType] ?? -1);
}
