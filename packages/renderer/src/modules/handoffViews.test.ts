// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { resolveBrandManagerTab, resolveTouringTab, resolveMerchViewMode } from './handoffViews';

describe('handoff view resolution', () => {
    it('defaults marketing handoffs to the visuals tab', () => {
        expect(resolveBrandManagerTab()).toBe('visuals');
        expect(resolveBrandManagerTab('release')).toBe('release');
        expect(resolveBrandManagerTab('bad-tab')).toBe('visuals');
    });

    it('defaults touring handoffs to the plan tab', () => {
        expect(resolveTouringTab()).toBe('plan');
        expect(resolveTouringTab('tour-book')).toBe('tour-book');
        expect(resolveTouringTab('bad-tab')).toBe('plan');
    });

    it('defaults merch handoffs to the design view', () => {
        expect(resolveMerchViewMode()).toBe('design');
        expect(resolveMerchViewMode('showroom')).toBe('showroom');
        expect(resolveMerchViewMode('bad-view')).toBe('design');
    });
});
