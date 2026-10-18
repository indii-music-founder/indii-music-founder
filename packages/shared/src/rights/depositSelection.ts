import type { RightsSessionFence } from './contracts.js';

export interface PendingRightsDepositSelection {
  requestId: string;
  multiple: boolean;
  workIds: readonly string[];
  generation: number;
  navigation: number;
}
export interface RightsDepositCommand { requestId: string; workIds: string[]; generation: number }

/** Resolve only the current artist-opened picker; commands cannot name paths or other filings. */
export function selectRightsDeposits(pending: PendingRightsDepositSelection | undefined, command: RightsDepositCommand, fence: RightsSessionFence): string[] | undefined {
  if (!pending || fence.control !== 'human' || command.requestId !== pending.requestId
    || command.generation !== fence.controlGeneration || pending.generation !== fence.controlGeneration
    || pending.navigation !== fence.navigationGeneration) return undefined;
  const ids = command.workIds;
  if (!Array.isArray(ids) || !ids.length || ids.length > 40 || new Set(ids).size !== ids.length
    || (!pending.multiple && ids.length !== 1) || ids.some(id => !pending.workIds.includes(id))) return undefined;
  return [...ids];
}
