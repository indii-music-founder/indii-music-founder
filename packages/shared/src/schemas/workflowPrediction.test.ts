import { describe, expect, it } from 'vitest';
import { predictNextWorkflows } from './workflowPrediction.js';
import type { WorkflowExecution } from './workflowState.js';

const baseTime = Date.parse('2026-09-01T00:00:00.000Z');

function completed(id: string, workflowId: string, userId = 'user-1', time = 0, artistEntityId = 'canonical-artist-1'): WorkflowExecution {
  const createdAt = baseTime + time;
  const completedAt = createdAt + 1_000;
  return {
    id,
    workflowId,
    userId,
    artistEntityId,
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
      completed('a1', 'release-plan', 'user-1', 0),
      completed('b1', 'release-review', 'user-1', 2_000),
      completed('a2', 'release-plan', 'user-1', 4_000),
      completed('b2', 'release-review', 'user-1', 6_000),
      completed('a3', 'release-plan', 'user-1', 8_000),
    ];

    const prediction = predictNextWorkflows({ userId: 'user-1', artistEntityId: 'canonical-artist-1', executions, evaluatedAt: '2026-09-25T00:00:00.000Z' });

    expect(prediction?.predictions).toEqual([expect.objectContaining({
      workflowId: 'release-review',
      followsWorkflowId: 'release-plan',
      supportCount: 2,
      observedTransitionCount: 2,
      observedRate: 1,
    })]);
    expect(prediction?.scope).toBe('CURRENT_ARTIST_CONTEXT_ONLY');
    expect(prediction?.advisoryOnly).toBe(true);
    expect(prediction?.executionAuthorized).toBe(false);
  });

  it('does not infer a prediction from one observation or other users’ records', () => {
    const executions = [
      completed('a1', 'release-plan', 'user-1', 0),
      completed('b1', 'release-review', 'user-1', 2_000),
      completed('a2', 'release-plan', 'user-1', 4_000),
      completed('b2', 'release-review', 'user-2', 6_000),
      completed('a3', 'release-plan', 'user-1', 8_000),
    ];
    expect(predictNextWorkflows({ userId: 'user-1', artistEntityId: 'canonical-artist-1', executions, evaluatedAt: '2026-09-25T00:00:00.000Z' })).toBeNull();
  });

  it('does not mix another canonical artist scope even for the same signed-in user', () => {
    const executions = [
      completed('a1', 'release-plan', 'user-1', 0, 'artist-band-a'),
      completed('b1', 'release-review', 'user-1', 2_000, 'artist-band-a'),
      completed('a2', 'release-plan', 'user-1', 4_000, 'artist-band-a'),
      completed('b2', 'release-review', 'user-1', 6_000, 'artist-band-b'),
      completed('a3', 'release-plan', 'user-1', 8_000, 'artist-band-a'),
    ];
    expect(predictNextWorkflows({ userId: 'user-1', artistEntityId: 'artist-band-a', executions, evaluatedAt: '2026-09-25T00:00:00.000Z' })).toBeNull();
  });

  it('leaves pre-context legacy executions readable but never uses them as artist evidence', () => {
    const executions = [
      completed('a1', 'release-plan', 'user-1', 0),
      completed('b1', 'release-review', 'user-1', 2_000),
      completed('a2', 'release-plan', 'user-1', 4_000),
      completed('b2', 'release-review', 'user-1', 6_000),
      completed('a3', 'release-plan', 'user-1', 8_000),
    ].map(execution => {
      const legacyExecution = { ...execution } as WorkflowExecution;
      delete legacyExecution.artistEntityId;
      return legacyExecution;
    });
    expect(predictNextWorkflows({ userId: 'user-1', artistEntityId: 'canonical-artist-1', executions, evaluatedAt: '2026-09-25T00:00:00.000Z' })).toBeNull();
  });

  it('rejects external identifiers as prediction artist scope', () => {
    expect(() => predictNextWorkflows({
      userId: 'user-1',
      artistEntityId: 'isrc:USAAA1234567',
      executions: [],
      evaluatedAt: '2026-09-25T00:00:00.000Z',
    })).toThrow(/canonical artist entity IDs/i);
  });

  it.each(['FAILED', 'CANCELLED', 'AWAITING_HUMAN'] as const)('ignores a latest %s execution', status => {
    const previous = completed('a1', 'release-plan');
    const current = { ...completed('current', 'release-plan', 'user-1', 4_000), status } as WorkflowExecution;
    expect(predictNextWorkflows({ userId: 'user-1', artistEntityId: 'canonical-artist-1', executions: [previous, current], evaluatedAt: '2026-09-25T00:00:00.000Z' })).toBeNull();
  });

  it('ignores transitions that overlap and executions with unverified step completion timestamps', () => {
    const first = completed('a1', 'release-plan', 'user-1', 0);
    const overlap = completed('b1', 'release-review', 'user-1', 500);
    const latest = completed('a2', 'release-plan', 'user-1', 4_000);
    const withoutCompletionTime = completed('b2', 'release-review', 'user-1', 6_000);
    delete withoutCompletionTime.steps.step.completedAt;
    expect(predictNextWorkflows({
      userId: 'user-1',
      artistEntityId: 'canonical-artist-1',
      executions: [first, overlap, latest, withoutCompletionTime],
      evaluatedAt: '2026-09-25T00:00:00.000Z',
    })).toBeNull();
  });

  it('returns no recommendation when the newest workflow is unfinished, even if older patterns exist', () => {
    const executions = [
      completed('a1', 'release-plan', 'user-1', 0),
      completed('b1', 'release-review', 'user-1', 2_000),
      completed('a2', 'release-plan', 'user-1', 4_000),
      completed('b2', 'release-review', 'user-1', 6_000),
      { ...completed('pending', 'release-plan', 'user-1', 8_000), status: 'EXECUTING' as const },
    ];
    expect(predictNextWorkflows({ userId: 'user-1', artistEntityId: 'canonical-artist-1', executions, evaluatedAt: '2026-09-25T00:00:00.000Z' })).toBeNull();
  });
});
