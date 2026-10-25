function escapeVCard(value: string): string {
    return value.trim().replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

/** A phone-scannable contact card; email is included only after an explicit choice. */
export function buildArtistShareCard(name: string, email?: string): string {
    const safeName = escapeVCard(name);
    if (!safeName) throw new Error('Set your artist name before sharing a card.');
    const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${safeName}`, `N:;${safeName};;;`];
    if (email?.trim()) lines.push(`EMAIL;TYPE=INTERNET:${escapeVCard(email)}`);
    lines.push('END:VCARD');
    return lines.join('\r\n');
}
