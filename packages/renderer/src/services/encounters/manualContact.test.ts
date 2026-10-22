import { describe, expect, it } from 'vitest';
import { manualContactRecord, type ManualContactFields } from './manualContact';

const fields: ManualContactFields = {
    name: '  Example Artist  ', phone: ' +1 555 0100 ', email: ' artist@example.com ',
    organization: ' Independent label ', notes: 'Meet after soundcheck.\nBring the release artwork.', role: 'musician',
};

describe('manual contact input contract (pure logic)', () => {
    it('keeps every entered field and marks it as confirmed manual input', () => {
        expect(manualContactRecord(fields)).toEqual({
            fields: { ...fields, name: 'Example Artist', phone: '+1 555 0100', email: 'artist@example.com', organization: 'Independent label' },
            source: 'manual', status: 'completed', reviewStatus: 'confirmed',
            analysisCoverage: 'Manually entered and confirmed by the user. No AI extraction was performed.',
        });
    });
    it('accepts a name-only contact without inventing any other details', () => {
        expect(manualContactRecord({ name: 'Name only', phone: '', email: '', organization: '', notes: '', role: 'other' }).fields).toEqual({ name: 'Name only', phone: '', email: '', organization: '', notes: '', role: 'other' });
    });
    it('rejects an empty name', () => {
        expect(() => manualContactRecord({ ...fields, name: '  ' })).toThrow(/name/);
    });
    it('preserves a full-length note and refuses overlong data rather than silently truncating it', () => {
        expect(manualContactRecord({ ...fields, notes: 'a'.repeat(2000) }).fields.notes).toHaveLength(2000);
        expect(() => manualContactRecord({ ...fields, notes: 'a'.repeat(2001) })).toThrow(/entry has been kept/);
    });
    it.each([['name', 201], ['phone', 81], ['email', 321], ['organization', 301]] as const)('refuses an overlong %s', (key, length) => {
        expect(() => manualContactRecord({ ...fields, [key]: 'a'.repeat(length) })).toThrow(key);
    });
});
