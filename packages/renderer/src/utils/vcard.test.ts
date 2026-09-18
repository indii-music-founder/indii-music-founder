import { describe, it, expect } from 'vitest';
import { generateVCard } from './vcard';
import type { FieldContact } from '@/types/contacts';
import { Timestamp } from 'firebase/firestore';

describe('vCard Generator for iOS Contacts', () => {
    it('creates a valid RFC 6350 vCard with complete fields', () => {
        const contact: FieldContact = {
            id: 'c1',
            name: 'Marcus Vance',
            phone: '+1-313-555-0199',
            email: 'marcus@livenation.com',
            organization: 'Live Nation',
            role: 'manager',
            instagram: 'marcusvance',
            notes: 'Met at Fillmore backstage',
            capturedContext: 'Detroit Techno Showcase',
            capturedAt: Timestamp.now(),
            source: 'encounter_ai',
        };

        const vcard = generateVCard(contact);

        expect(vcard).toContain('BEGIN:VCARD');
        expect(vcard).toContain('VERSION:3.0');
        expect(vcard).toContain('FN:Marcus Vance');
        expect(vcard).toContain('N:Vance;Marcus;;;');
        expect(vcard).toContain('ORG:Live Nation');
        expect(vcard).toContain('TITLE:MANAGER');
        expect(vcard).toContain('TEL;TYPE=CELL,VOICE:+1-313-555-0199');
        expect(vcard).toContain('EMAIL;TYPE=INTERNET,WORK:marcus@livenation.com');
        expect(vcard).toContain('X-SOCIALPROFILE;TYPE=instagram:https://instagram.com/marcusvance');
        expect(vcard).toContain('END:VCARD');
    });

    it('handles single-word names gracefully', () => {
        const contact: FieldContact = {
            id: 'c2',
            name: 'Skrillex',
            role: 'musician',
            capturedAt: Timestamp.now(),
            source: 'quick_capture',
        };

        const vcard = generateVCard(contact);
        expect(vcard).toContain('FN:Skrillex');
        expect(vcard).toContain('N:;Skrillex;;;');
    });
});
