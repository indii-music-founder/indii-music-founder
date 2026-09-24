import { describe, expect, it } from 'vitest';
import { planConnectedIntelligenceAction, planMusicActionExecution, type MusicActionExecutionRequest } from './musicActionExecution.js';

const base: MusicActionExecutionRequest = {
  actionId: 'registration.submit',
  subjectEntityId: 'recording_internal_123',
  checkpoints: [],
  capabilities: {},
};

describe('planMusicActionExecution', () => {
  it.each([
    [{ officialApiAvailable: true, oauthApiAvailable: true, browserAutomationAvailable: true, desktopControlAvailable: true, autonomousComputerControlAuthorized: true }, 'OFFICIAL_API'],
    [{ oauthApiAvailable: true, browserAutomationAvailable: true, desktopControlAvailable: true, autonomousComputerControlAuthorized: true }, 'OAUTH_API'],
    [{ browserAutomationAvailable: true, desktopControlAvailable: true, autonomousComputerControlAuthorized: true }, 'BROWSER_AUTOMATION'],
    [{ browserAutomationAvailable: true, autonomousComputerControlAuthorized: false }, 'GUIDED_MANUAL'],
    [{ desktopControlAvailable: true, autonomousComputerControlAuthorized: true }, 'DESKTOP_CONTROL'],
    [{ desktopControlAvailable: true, autonomousComputerControlAuthorized: false }, 'GUIDED_MANUAL'],
    [{ desktopControlAvailable: true }, 'GUIDED_MANUAL'],
    [{}, 'GUIDED_MANUAL'],
  ] as const)('selects the highest-priority permitted route (%s)', (capabilities, expectedRoute) => {
    expect(planMusicActionExecution({ ...base, capabilities }).route).toBe(expectedRoute);
  });

  it.each([
    'HUMAN_REVIEW',
    'MFA',
    'LEGAL_ATTESTATION',
    'SIGNATURE',
    'PAYMENT',
    'BINDING_CHOICE',
    'OWNERSHIP_CONFIRMATION',
    'TERMS_ACCEPTANCE',
  ] as const)('pauses at the %s human checkpoint before browser or desktop automation', (checkpoint) => {
    const plan = planMusicActionExecution({
      ...base,
      checkpoints: [checkpoint],
      capabilities: { browserAutomationAvailable: true, desktopControlAvailable: true, autonomousComputerControlAuthorized: true },
    });
    expect(plan.route).toBe('GUIDED_MANUAL');
    expect(plan.status).toBe('AWAITING_HUMAN');
    expect(plan.checkpoints).toEqual([checkpoint]);
  });

  it('allows an API route to prepare work but still records a human checkpoint', () => {
    const plan = planMusicActionExecution({
      ...base,
      checkpoints: ['OWNERSHIP_CONFIRMATION'],
      capabilities: { officialApiAvailable: true },
    });
    expect(plan.route).toBe('OFFICIAL_API');
    expect(plan.status).toBe('AWAITING_HUMAN');
    expect(plan.executionAuthorized).toBe(false);
  });

  it('consumes a Phase 9 advisory action without promoting it to execution authority', () => {
    const action = {
      actionId: 'connected_intelligence:event:planned:REVIEW_RIGHTS:recording:canonical-1',
      code: 'REVIEW_RIGHTS' as const,
      source: 'RIGHTS' as const,
      subject: { entityId: 'recording:canonical-1', entityType: 'sound_recording' as const },
      subjectEntityId: 'recording:canonical-1',
      title: 'Review rights',
      detail: 'A rights review is required.',
      evidence: [],
      requiresHumanReview: true as const,
      executionAuthorized: false as const,
    };
    const plan = planConnectedIntelligenceAction(action, {
      officialApiAvailable: true,
      oauthApiAvailable: true,
      browserAutomationAvailable: true,
      desktopControlAvailable: true,
      autonomousComputerControlAuthorized: true,
    });

    expect(plan).toMatchObject({
      actionId: action.actionId,
      subjectEntityId: action.subjectEntityId,
      sourceAction: action,
      route: 'GUIDED_MANUAL',
      status: 'AWAITING_HUMAN',
      checkpoints: ['HUMAN_REVIEW'],
      executionAuthorized: false,
    });
  });

  it('rejects a malformed or authority-promoted Phase 9 action', () => {
    const action = {
      actionId: 'connected_intelligence:action', code: 'REVIEW_RIGHTS', source: 'RIGHTS',
      subject: { entityId: 'recording:canonical-1', entityType: 'sound_recording' },
      subjectEntityId: 'recording:canonical-1', title: 'Review rights', detail: 'Review.', evidence: [],
      requiresHumanReview: true, executionAuthorized: false,
    };
    expect(() => planConnectedIntelligenceAction({ ...action, executionAuthorized: true } as never)).toThrow();
    expect(() => planConnectedIntelligenceAction({ ...action, subjectEntityId: 'ISRC:USAAA2600001' } as never)).toThrow();
  });

  it('preserves the full Phase 9 action ID bound when converting into an execution plan', () => {
    const action = {
      actionId: `connected_intelligence:${'e'.repeat(160)}:${'scope'.repeat(20)}`.slice(0, 300),
      code: 'REVIEW_RIGHTS' as const,
      source: 'RIGHTS' as const,
      subject: { entityId: 'recording:canonical-1', entityType: 'sound_recording' as const },
      subjectEntityId: 'recording:canonical-1',
      title: 'Review rights', detail: 'A rights review is required.', evidence: [],
      requiresHumanReview: true as const, executionAuthorized: false as const,
    };
    expect(planConnectedIntelligenceAction(action).actionId).toBe(action.actionId);
  });

  it('never selects browser automation without explicit AOP authorization', () => {
    const plan = planMusicActionExecution({
      ...base,
      capabilities: { browserAutomationAvailable: true },
    });
    expect(plan.route).toBe('GUIDED_MANUAL');
    expect(plan.reason).toMatch(/Artist Operating Profile authorization/);
  });

  it('deduplicates repeated checkpoints and never promotes external identifiers to canonical entity identity', () => {
    const plan = planMusicActionExecution({ ...base, checkpoints: ['MFA', 'MFA'] });
    expect(plan.checkpoints).toEqual(['MFA']);
    expect(() => planMusicActionExecution({ ...base, subjectEntityId: 'ISRC:USAAA2600001' })).toThrow();
  });

  it('rejects unknown fields instead of accepting caller-asserted authority', () => {
    expect(() => planMusicActionExecution({ ...base, ownershipCleared: true } as MusicActionExecutionRequest)).toThrow();
  });
});
