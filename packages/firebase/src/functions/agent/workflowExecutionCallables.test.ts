import { describe, expect, it } from 'vitest';
import { validateWorkflowExecutionInput } from './workflowExecutionCallables';

const valid = {
  workflowId: 'CAMPAIGN_LAUNCH',
  steps: [
    { id: 'draft', agentId: 'social', prompt: 'Draft three posts', priority: 'LOW' },
    { id: 'review', agentId: 'marketing', prompt: 'Review the posts', priority: 'MEDIUM' },
  ],
  edges: [{ from: 'draft', to: 'review' }],
};

describe('workflow execution callable input', () => {
  it('accepts a bounded acyclic graph while excluding caller-owned state', () => {
    const result = validateWorkflowExecutionInput(valid);
    expect(result.workflowId).toBe('CAMPAIGN_LAUNCH');
    expect(result).not.toHaveProperty('userId');
    expect(result).not.toHaveProperty('status');
    expect(() => validateWorkflowExecutionInput({ ...valid, userId: 'attacker', status: 'COMPLETED' })).toThrow();
  });

  it('rejects duplicate steps, invalid references, cycles, and oversized graphs', () => {
    expect(() => validateWorkflowExecutionInput({ ...valid, steps: [valid.steps[0], valid.steps[0]] })).toThrow();
    expect(() => validateWorkflowExecutionInput({ ...valid, edges: [{ from: 'draft', to: 'missing' }] })).toThrow();
    expect(() => validateWorkflowExecutionInput({ ...valid, edges: [{ from: 'draft', to: 'review' }, { from: 'review', to: 'draft' }] })).toThrow();
    expect(() => validateWorkflowExecutionInput({ ...valid, steps: Array.from({ length: 5 }, (_, i) => ({ ...valid.steps[0], id: `step-${i}` })), edges: [] })).toThrow();
  });

  it('rejects unsupported agents and unbounded prompts', () => {
    expect(() => validateWorkflowExecutionInput({ ...valid, steps: [{ ...valid.steps[0], agentId: 'admin' }] })).toThrow();
    expect(() => validateWorkflowExecutionInput({ ...valid, steps: [{ ...valid.steps[0], prompt: 'x'.repeat(4_001) }] })).toThrow();
  });
});
