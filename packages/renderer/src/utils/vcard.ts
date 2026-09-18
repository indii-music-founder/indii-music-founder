import type { FieldContact } from '@/types/contacts';

/**
 * Generates an RFC 6350 compliant vCard (version 3.0/4.0) string from a FieldContact.
 */
export function generateVCard(contact: FieldContact): string {
    const lines: string[] = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${contact.name.trim()}`,
    ];

    // N: FamilyName;GivenName;AdditionalNames;Prefix;Suffix
    const nameParts = contact.name.trim().split(/\s+/);
    if (nameParts.length > 1) {
        const given = nameParts[0];
        const family = nameParts.slice(1).join(' ');
        lines.push(`N:${family};${given};;;`);
    } else {
        lines.push(`N:;${contact.name.trim()};;;`);
    }

    if (contact.organization) {
        lines.push(`ORG:${contact.organization.trim()}`);
    }

    if (contact.role) {
        lines.push(`TITLE:${contact.role.toUpperCase()}`);
    }

    if (contact.phone) {
        lines.push(`TEL;TYPE=CELL,VOICE:${contact.phone.trim()}`);
    }

    if (contact.email) {
        lines.push(`EMAIL;TYPE=INTERNET,WORK:${contact.email.trim()}`);
    }

    if (contact.instagram) {
        lines.push(`X-SOCIALPROFILE;TYPE=instagram:https://instagram.com/${contact.instagram.replace(/^@/, '')}`);
    }

    const notesSummary = [
        contact.notes,
        contact.capturedContext ? `Context: ${contact.capturedContext}` : '',
        'Captured via indii Music Mobile Remote'
    ].filter(Boolean).join(' | ');

    if (notesSummary) {
        lines.push(`NOTE:${notesSummary.replace(/\n/g, '\\n')}`);
    }

    lines.push('END:VCARD');
    return lines.join('\r\n');
}

/**
 * Initiates an iOS-friendly export of the contact:
 * 1. Attempts Web Share API with a .vcf file (triggers native iOS Contacts sheet directly).
 * 2. Falls back to generating a data/blob URL download which iOS Safari prompts to "Open in Contacts".
 */
export async function exportContactToIPhone(contact: FieldContact): Promise<boolean> {
    const vcardString = generateVCard(contact);
    const sanitizedFilename = `${contact.name.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'contact'}.vcf`;

    try {
        const blob = new Blob([vcardString], { type: 'text/vcard;charset=utf-8' });

        // Method 1: Web Share API with file (iOS 15+)
        if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
            const file = new File([blob], sanitizedFilename, { type: 'text/vcard' });
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: contact.name,
                });
                return true;
            }
        }

        // Method 2: Blob URL trigger (Safari will offer to open in Contacts)
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = sanitizedFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        return true;
    } catch (err: unknown) {
        // User aborted share sheet is not a system failure
        if (err instanceof Error && err.name === 'AbortError') {
            return false;
        }
        console.error('[vCard] Export failed:', err);
        throw err;
    }
}
