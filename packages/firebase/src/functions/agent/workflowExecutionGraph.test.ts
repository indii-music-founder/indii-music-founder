import { describe, expect, it } from 'vitest';
import { findReadyWorkflowStep, hasActiveWorkflowStep, isCurrentWorkflowStepClaim } from './workflowExecutionGraph';

describe('workflow dependency execution', () => {
  it('releases only roots and steps whose dependencies have completed or skipped', () => {
    const steps = {
      root: { stepId: 'root', status: 'STEP_COMPLETE' },
      blocked: { stepId: 'blocked', status: 'PLANNED' },
      ready: { stepId: 'ready', status: 'PLANNED' },
    };
    expect(findReadyWorkflowStep(steps, [
      { from: 'root', to: 'blocked' },
      { from: 'missing', to: 'blocked' },
      { from: 'root', to: 'ready' },
    ])?.stepId).toBe('ready');
  });

  it('does not mark the workflow failed while another step is still active', () => {
    expect(hasActiveWorkflowStep([{ stepId: 'one', status: 'FAILED' }, { stepId: 'two', status: 'EXECUTING_GENERATION' }])).toBe(true);
    expect(hasActiveWorkflowStep([{ stepId: 'one', status: 'FAILED' }])).toBe(false);
  });

  it('rejects stale, cancelled, or superseded worker results', () => {
    const current = { status: 'EXECUTING', steps: { draft: { status: 'EXECUTING_GENERATION', idempotencyKey: 'key-2' } } };
    expect(isCurrentWorkflowStepClaim(current, 'draft', 'key-2')).toBe(true);
    expect(isCurrentWorkflowStepClaim(current, 'draft', 'key-1')).toBe(false);
    expect(isCurrentWorkflowStepClaim({ ...current, status: 'CANCELLED' }, 'draft', 'key-2')).toBe(false);
  });
});
