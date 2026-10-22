import type { FieldContactRole } from '@/types/contacts';

export interface ManualContactFields {
    name: string;
    phone: string;
    email: string;
    organization: string;
    notes: string;
    role: FieldContactRole;
}

/** Manual input is the evidence; it must not wait for, or be replaced by, AI extraction. */
export function manualContactRecord(fields: ManualContactFields) {
    const normalized = {
        name: fields.name.trim(), phone: fields.phone.trim(), email: fields.email.trim(),
        organization: fields.organization.trim(), notes: fields.notes.trim(), role: fields.role,
    };
    if (!normalized.name) throw new Error('Enter a contact name.');
    const limits = { name: 200, phone: 80, email: 320, organization: 300, notes: 2000 };
    for (const [field, max] of Object.entries(limits)) {
        if (normalized[field as keyof typeof limits].length > max) throw new Error(`${field} must be ${max} characters or fewer. Your entry has been kept.`);
    }
    if (!['musician', 'promoter', 'venue_staff', 'engineer', 'manager', 'fan', 'industry', 'media', 'other'].includes(normalized.role)) throw new Error('Choose a contact role.');
    return {
        fields: normalized,
        source: 'manual' as const,
        status: 'completed' as const,
        reviewStatus: 'confirmed' as const,
        analysisCoverage: 'Manually entered and confirmed by the user. No AI extraction was performed.',
    };
}
