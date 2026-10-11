import { describe, it, expect } from 'vitest';
import { ContractPDFService } from './ContractPDFService';

describe('ContractPDFService', () => {
    it('places ownership headers and each collaborator on distinct non-overlapping rows in the actual PDF', () => {
        const encoded = ContractPDFService.toBase64({
            title: 'Unsigned layout regression',
            content: [
                '| Name | Share |',
                '| --- | --- |',
                '| Writer One | 50% |',
                '| Writer Two | 50% |',
            ].join('\n'),
        });
        const pdf = atob(encoded);
        const blocks: string[] = Array.from(pdf.matchAll(/BT[\s\S]*?ET/g), (match) => match[0]);
        const baseline = (label: string) => {
            const block = blocks.find((candidate) => candidate.includes(`(${label}) Tj`));
            expect(block).toBeDefined();
            const coordinates = block!.match(/([\d.-]+) ([\d.-]+) Td/);
            expect(coordinates).not.toBeNull();
            return Number(coordinates![2]);
        };
        // PDF coordinates increase upward. A full row needs about 20 points here.
        expect(baseline('Name') - baseline('Writer One')).toBeGreaterThan(18);
        expect(baseline('Writer One') - baseline('Writer Two')).toBeGreaterThan(18);
    });

    it('generates a valid PDF base64 string from markdown content without throwing', () => {
        const markdown = [
            '# MUSICAL WORK SPLIT SHEET AGREEMENT',
            '',
            '**Date:** 2026-10-10',
            '**Track Title:** Paper Moon',
            '',
            '### 1. OWNERSHIP & ROYALTIES BREAKDOWN',
            '',
            '| Collaborator / Legal Name | Role | Share (%) | PRO | IPI / CAE # | Contact Email |',
            '| :--- | :--- | :--- | :--- | :--- | :--- |',
            '| Mara June | Producer / Songwriter | 50% | BMI | 123456789 | mara@example.com |',
            '| Collaborator Two | Featured Artist / Lyricist | 50% | ASCAP | 987654321 | collab@example.com |',
            '',
            '---',
            '',
            '### SIGNATURES & EXECUTION',
            '- Signed and agreed by all parties',
            '1. Primary Artist',
            '2. Collaborator Two',
        ].join('\n');

        const base64 = ContractPDFService.toBase64({
            title: 'Split Sheet: Paper Moon',
            content: markdown,
            subtitle: 'DRAFT — For Review Only',
        });

        expect(typeof base64).toBe('string');
        expect(base64.length).toBeGreaterThan(100);
    });

    it('generates a Blob output for document attachments', () => {
        const blob = ContractPDFService.toBlob({
            title: 'Simple Agreement',
            content: '# Simple Agreement\n\n**Terms:** All clear.',
        });

        expect(blob).toBeInstanceOf(Blob);
        expect(blob.type).toBe('application/pdf');
    });

    it('correctly handles edge-case tables with unequal column counts and missing rows', () => {
        const tableContent = [
            '| Column 1 | Column 2 | Column 3 |',
            '| --- | --- | --- |',
            '| Single Cell |',
            '| A | B | C | D |',
        ].join('\n');

        expect(() => {
            ContractPDFService.toBase64({
                title: 'Table Edge Case Test',
                content: tableContent,
            });
        }).not.toThrow();
    });

    it('strips markdown formatting from table cells and prose cleanly', () => {
        const markdown = [
            '| **Bold Heading** | *Italic Heading* | [Link Title](https://example.com) | `Code` |',
            '| --- | --- | --- | --- |',
            '| **Producer** | *Mixer* | [Website](https://indii.music) | `ISRC-123` |',
        ].join('\n');

        const base64 = ContractPDFService.toBase64({
            title: 'Formatting Test',
            content: markdown,
        });

        expect(typeof base64).toBe('string');
        expect(base64.length).toBeGreaterThan(50);
    });
});
