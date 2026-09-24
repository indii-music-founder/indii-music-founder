import { describe, expect, it } from 'vitest';
import { planMusicActionExecution, type MusicActionExecutionRequest } from './musicActionExecution.js';

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
    [{ desktopControlAvailable: true, autonomousComputerControlAuthorized: true }, 'DESKTOP_CONTROL'],
    [{ desktopControlAvailable: true, autonomousComputerControlAuthorized: false }, 'GUIDED_MANUAL'],
    [{ desktopControlAvailable: true }, 'GUIDED_MANUAL'],
    [{}, 'GUIDED_MANUAL'],
  ] as const)('selects the highest-priority permitted route (%s)', (capabilities, expectedRoute) => {
    expect(planMusicActionExecution({ ...base, capabilities }).route).toBe(expectedRoute);
  });

  it.each([
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
