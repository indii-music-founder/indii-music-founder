/** Approval is reversible only before transport has been claimed. Never re-arm a sent file. */
export function canApproveCwrExport(state: unknown): boolean {
  return state === 'exported' || state === 'approved_export';
}
