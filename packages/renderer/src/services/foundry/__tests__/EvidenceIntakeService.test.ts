import { describe, it, expect } from 'vitest';
import { EvidenceIntakeService } from '../EvidenceIntakeService';

describe('EvidenceIntakeService sensitivity classification (ISSUE-1443)', () => {
    it('classifies non-USD royalty statements as sensitive_financial', async () => {
        // Old bug: only 'Earnings' / 'USD' / 'Total Earned' counted — a EUR
        // statement with translated headers slipped past masking.
        const item = await EvidenceIntakeService.ingestEvidence(
            'statement.csv',
            'Title;Artist;Nettoeinnahmen;Territory\nSong A;Artist B;"1.234,56";DE',
        );
        expect(item.constraints.classification).toBe('sensitive_financial');
    });

    it('classifies UK-format royalty lines as sensitive_financial', async () => {
        const item = await EvidenceIntakeService.ingestEvidence(
            'report.csv',
            'Track,Artist,Net Receipts\nSong,Artist,"£1,024.00",GB',
        );
        expect(item.constraints.classification).toBe('sensitive_financial');
    });

    it('classifies content with no financial indicators as confidential_artist', async () => {
        const item = await EvidenceIntakeService.ingestEvidence(
            'notes.txt',
            'Band meeting notes: setlist discussion for the Detroit show.',
        );
        expect(item.constraints.classification).toBe('confidential_artist');
    });

    it('honours an explicit classification override', async () => {
        const item = await EvidenceIntakeService.ingestEvidence(
            'statement.csv',
            'Artist;Nettoeinnahmen\nSong;"1.234,56"',
            { classification: 'public' },
        );
        expect(item.constraints.classification).toBe('public');
    });
});
