import { describe, expect, it } from 'vitest';
import { backdropOpacityForStep, decayPulse, horizonIntensityForStep, pulseForStepChange } from './horizonMotion';

describe('horizonIntensityForStep', () => {
  it('is full strength on the hero and calmer for the wizard', () => {
    expect(horizonIntensityForStep(0)).toBe(1);
    expect(horizonIntensityForStep(1)).toBeLessThan(0.3);
  });

  it('rises monotonically through the five questions without crowding the text', () => {
    const values = [1, 2, 3, 4, 5].map(horizonIntensityForStep);
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThan(values[i - 1]);
    expect(Math.max(...values)).toBeLessThanOrEqual(0.45);
  });

  it('settles after the report', () => {
    expect(horizonIntensityForStep(6)).toBeLessThan(horizonIntensityForStep(5));
  });
});

describe('pulseForStepChange', () => {
  it('does nothing when the step does not change', () => {
    expect(pulseForStepChange(3, 3)).toBe(0);
  });

  it('leaves the hero plunge and the reset to their own motion', () => {
    expect(pulseForStepChange(0, 1)).toBe(0);
    expect(pulseForStepChange(6, 0)).toBe(0);
  });

  it('surges forward, is gentler going back, and flares once for the report', () => {
    expect(pulseForStepChange(1, 2)).toBe(1);
    expect(pulseForStepChange(3, 2)).toBe(0.5);
    expect(pulseForStepChange(5, 6)).toBeGreaterThan(pulseForStepChange(1, 2));
  });
});

describe('backdropOpacityForStep', () => {
  it('shows the photograph on the hero and quiets it behind the questions', () => {
    expect(backdropOpacityForStep(0)).toBe(0.55);
    expect(backdropOpacityForStep(3)).toBe(0.18);
    expect(backdropOpacityForStep(6)).toBe(0.18);
  });
});

describe('decayPulse', () => {
  it('decays toward zero and snaps to exactly zero', () => {
    expect(decayPulse(1, 0.1)).toBeLessThan(1);
    expect(decayPulse(1, 0.1)).toBeGreaterThan(0.5);
    expect(decayPulse(1, 10)).toBe(0);
  });
});
