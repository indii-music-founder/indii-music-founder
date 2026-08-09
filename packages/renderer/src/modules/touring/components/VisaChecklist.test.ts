import { beforeEach, describe, expect, it } from 'vitest';

import { createVisaPlanningEntry, loadVisaPlanningEntries } from './VisaPlanning';

describe('visa planning truth boundary', () => {
    beforeEach(() => localStorage.clear());

    it('creates an unverified organizational checklist without legal determinations', () => {
        const entry = createVisaPlanningEntry('Canada', 'entry-1');

        expect(entry).toMatchObject({
            id: 'entry-1',
            country: 'Canada',
            visaType: 'Official immigration classification not verified',
            processingDays: null,
        });
        expect(entry.docs.every(document => document.required === false && document.checked === false)).toBe(true);
    });

    it('discards legacy hard-coded visa claims during local-state migration', () => {
        localStorage.setItem('indii_visa_checklist_entries', JSON.stringify([{
            id: 'legacy-entry',
            country: 'Mexico',
            visaType: 'FM3 Work Visa',
            processingDays: 30,
            docs: [{ id: 'legacy-doc', label: 'Guaranteed requirement', required: true, checked: true }],
        }]));

        const [entry] = loadVisaPlanningEntries();

        expect(entry?.id).toBe('legacy-entry');
        expect(entry?.visaType).toBe('Official immigration classification not verified');
        expect(entry?.processingDays).toBeNull();
        expect(entry?.docs.some(document => document.label.includes('Guaranteed'))).toBe(false);
        expect(entry?.docs.every(document => document.checked === false)).toBe(true);
    });
});
