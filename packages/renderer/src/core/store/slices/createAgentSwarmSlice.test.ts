import { describe, it, expect } from 'vitest';
import { createAgentSwarmSlice, AgentSwarmSlice } from './createAgentSwarmSlice';

describe('createAgentSwarmSlice', () => {
  it('initializes with default active state and empty logs', () => {
    let state = {} as AgentSwarmSlice;
    const set = (partial: Partial<AgentSwarmSlice> | ((s: AgentSwarmSlice) => Partial<AgentSwarmSlice>)) => {
      const next = typeof partial === 'function' ? partial(state) : partial;
      state = { ...state, ...next };
    };

    const slice = createAgentSwarmSlice(set, () => state, {} as any);
    state = slice;

    expect(slice.isSwarmActive).toBe(true);
    expect(slice.agentLogs).toEqual([]);
    expect(slice.campaignMetrics).toEqual([]);
  });

  it('toggles swarm active status', () => {
    let state = {} as AgentSwarmSlice;
    const set = (partial: Partial<AgentSwarmSlice> | ((s: AgentSwarmSlice) => Partial<AgentSwarmSlice>)) => {
      const next = typeof partial === 'function' ? partial(state) : partial;
      state = { ...state, ...next };
    };

    const slice = createAgentSwarmSlice(set, () => state, {} as any);
    state = slice;

    slice.toggleSwarmStatus(false);
    expect(state.isSwarmActive).toBe(false);

    slice.toggleSwarmStatus(true);
    expect(state.isSwarmActive).toBe(true);
  });
});
