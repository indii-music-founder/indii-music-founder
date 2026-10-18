import { describe, expect, it } from 'vitest';
import { selectRightsDeposits } from './depositSelection.js';
import type { RightsSessionFence } from './contracts.js';
const fence: RightsSessionFence = { sessionId: 'session', control: 'human', controlGeneration: 3, navigationGeneration: 2, viewportVersion: 1, lastSequence: 0 };
const picker = { requestId: 'picker', multiple: true, workIds: ['composition', 'recording'], generation: 3, navigation: 2 };
const command = { requestId: 'picker', workIds: ['recording'], generation: 3 };
describe('artist deposit selection boundary', () => {
  it('selects the requested subset without implicitly including other works', () => expect(selectRightsDeposits(picker, command, fence)).toEqual(['recording']));
  it('rejects local paths, unknown works, duplicates and empty selections', () => {
    for (const workIds of [['/tmp/secret'], ['another-filing'], ['recording', 'recording'], []]) expect(selectRightsDeposits(picker, { ...command, workIds }, fence)).toBeUndefined();
  });
  it('respects a single-file portal picker', () => expect(selectRightsDeposits({ ...picker, multiple: false }, { ...command, workIds: ['composition', 'recording'] }, fence)).toBeUndefined());
  it('rejects stale navigation, stale control and absent artist authority', () => {
    for (const state of [{ ...fence, navigationGeneration: 3 }, { ...fence, controlGeneration: 4 }, { ...fence, control: 'agent' as const }, { ...fence, control: 'none' as const }]) expect(selectRightsDeposits(picker, command, state)).toBeUndefined();
  });
  it('rejects commands for a different or consumed picker', () => {
    expect(selectRightsDeposits(picker, { ...command, requestId: 'old-picker' }, fence)).toBeUndefined();
    expect(selectRightsDeposits(undefined, command, fence)).toBeUndefined();
  });
});
