type Filing = {
  ownerUid?: unknown;
  caseId?: unknown;
  manifestHash?: unknown;
  state?: unknown;
  evidenceSource?: unknown;
} | undefined;

/** A user attestation can reopen preparation only after the hosted worker is confirmed gone. */
export function canReopenUncertainFiling(
  filing: Filing,
  capacity: Record<string, unknown>,
  identity: { uid: string; caseId: string; manifestHash: string },
): boolean {
  if (Object.values(capacity).some(entry =>
    typeof entry === 'object' && entry !== null && (entry as { uid?: unknown }).uid === identity.uid
  )) return false;
  return filing?.ownerUid === identity.uid
    && filing.caseId === identity.caseId
    && filing.manifestHash === identity.manifestHash
    && filing.state === 'outcome_unknown'
    && (!filing.evidenceSource || filing.evidenceSource === 'none');
}
