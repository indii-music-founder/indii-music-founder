import { describe, expect, it } from 'vitest';
import { predictNextWorkflows } from './workflowPrediction.js';
import type { WorkflowExecution } from './workflowState.js';

const baseTime = Date.parse('2026-09-01T00:00:00.000Z');

function completed(id: string, workflowId: string, userId = 'artist-1', time = 0): WorkflowExecution {
  const createdAt = baseTime + time;
  const completedAt = createdAt + 1_000;
  return {
    id,
    workflowId,
    userId,
    status: 'COMPLETED',
    steps: {
      step: { stepId: 'step', agentId: 'generalist', status: 'STEP_COMPLETE', idempotencyKey: `key-${id}`, startedAt: createdAt, completedAt },
    },
    edges: [],
    createdAt,
    updatedAt: completedAt,
  };
}

describe('predictNextWorkflows', () => {
  it('suggests only repeatedly observed next workflows from the same user’s verified history', () => {
    const executions = [
      completed('a1', 'release-plan', 'artist-1', 0),
      completed('b1', 'release-review', 'artist-1', 2_000),
      completed('a2', 'release-plan', 'artist-1', 4_000),
      completed('b2', 'release-review', 'artist-1', 6_000),
      completed('a3', 'release-plan', 'artist-1', 8_000),
    ];

    const prediction = predictNextWorkflows({ userId: 'artist-1', executions, evaluatedAt: '2026-09-25T00:00:00.000Z' });

    expect(prediction?.predictions).toEqual([expect.objectContaining({
      workflowId: 'release-review',
      followsWorkflowId: 'release-plan',
      supportCount: 2,
      observedTransitionCount: 2,
      observedRate: 1,
    })]);
    expect(prediction?.scope).toBe('CURRENT_USER_ONLY');
    expect(prediction?.advisoryOnly).toBe(true);
    expect(prediction?.executionAuthorized).toBe(false);
  });

  it('does not infer a prediction from one observation or other users’ records', () => {
    const executions = [
      completed('a1', 'release-plan', 'artist-1', 0),
      completed('b1', 'release-review', 'artist-1', 2_000),
      completed('a2', 'release-plan', 'artist-1', 4_000),
      completed('b2', 'release-review', 'artist-2', 6_000),
      completed('a3', 'release-plan', 'artist-1', 8_000),
    ];
    expect(predictNextWorkflows({ userId: 'artist-1', executions, evaluatedAt: '2026-09-25T00:00:00.000Z' })).toBeNull();
  });

  it.each(['FAILED', 'CANCELLED', 'AWAITING_HUMAN'] as const)('ignores a latest %s execution', status => {
    const previous = completed('a1', 'release-plan');
    const current = { ...completed('current', 'release-plan', 'artist-1', 4_000), status } as WorkflowExecution;
    expect(predictNextWorkflows({ userId: 'artist-1', executions: [previous, current], evaluatedAt: '2026-09-25T00:00:00.000Z' })).toBeNull();
  });

  it('ignores transitions that overlap and executions with unverified step completion timestamps', () => {
    const first = completed('a1', 'release-plan', 'artist-1', 0);
    const overlap = completed('b1', 'release-review', 'artist-1', 500);
    const latest = completed('a2', 'release-plan', 'artist-1', 4_000);
    const withoutCompletionTime = completed('b2', 'release-review', 'artist-1', 6_000);
    delete withoutCompletionTime.steps.step.completedAt;
    expect(predictNextWorkflows({
      userId: 'artist-1',
      executions: [first, overlap, latest, withoutCompletionTime],
      evaluatedAt: '2026-09-25T00:00:00.000Z',
    })).toBeNull();
  });

  it('returns no recommendation when the newest workflow is unfinished, even if older patterns exist', () => {
    const executions = [
      completed('a1', 'release-plan', 'artist-1', 0),
      completed('b1', 'release-review', 'artist-1', 2_000),
      completed('a2', 'release-plan', 'artist-1', 4_000),
      completed('b2', 'release-review', 'artist-1', 6_000),
      { ...completed('pending', 'release-plan', 'artist-1', 8_000), status: 'EXECUTING' as const },
    ];
    expect(predictNextWorkflows({ userId: 'artist-1', executions, evaluatedAt: '2026-09-25T00:00:00.000Z' })).toBeNull();
  });
});
