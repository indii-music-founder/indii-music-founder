/** Pure preparation contracts; no live society acceptance evidence. */
import { describe, expect, it } from 'vitest';
import { cwrPercentageUnits, cwrUnitsPercentage, SOCIETY_ONBOARDING, societyOnboardingChecklist } from './societyPreparation.js';
describe('society preparation', () => {
  it('converts exact decimal shares into integer units', () => {
    expect(cwrPercentageUnits('33.33')).toBe(3333);
    expect(cwrPercentageUnits('16.67')).toBe(1667);
    expect(cwrPercentageUnits('0')).toBe(0);
    expect(cwrPercentageUnits('100.00')).toBe(10000);
    expect(cwrPercentageUnits(' 0.5 ')).toBe(50);
  });
  it('restores all valid share units without floating point drift', () => {
    for (let units = 0; units <= 10000; units++) expect(cwrPercentageUnits(cwrUnitsPercentage(units))).toBe(units);
    for (const units of [-1, 10001, 0.5, Number.NaN]) expect(() => cwrUnitsPercentage(units)).toThrow();
  });
  it('requires explicit bounded shares without rounding or silently inventing ownership', () => {
    for (const text of ['', ' ', '-1', '100.01', '33.333', '1e2', 'NaN', '12%', '.5']) expect(() => cwrPercentageUnits(text)).toThrow();
  });
  it('keeps MusicMark routing separate from SESAC', () => {
    expect(SOCIETY_ONBOARDING.musicmark.label).toBe('ASCAP / BMI / SOCAN through MusicMark');
    expect(SOCIETY_ONBOARDING.sesac.exportSupported).toBe(true);
    expect(societyOnboardingChecklist('sesac')).toContain('MusicMark does not route to SESAC');
  });
  it('never represents a checklist or public API as production registration access', () => {
    for (const recipient of ['musicmark', 'the_mlc', 'sesac'] as const) {
      expect(societyOnboardingChecklist(recipient)).toContain('no works transmitted or registered');
      expect(societyOnboardingChecklist(recipient)).toContain(SOCIETY_ONBOARDING[recipient].guide);
    }
    expect(societyOnboardingChecklist('the_mlc')).toContain('test-file approval');
    expect(societyOnboardingChecklist('the_mlc')).toContain('public search API access does not register works');
  });
});
