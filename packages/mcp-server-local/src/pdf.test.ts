import { afterEach, describe, expect, it } from 'vitest';
import { jsPDF } from 'jspdf';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { extractPdfContractText } from './pdf.js';

describe('extractPdfContractText', () => {
    let tempDir: string;

    afterEach(() => {
        if (tempDir) {
            rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('extracts text from a generated PDF contract', async () => {
        tempDir = mkdtempSync(path.join(tmpdir(), 'indii-mcp-pdf-'));
        const filePath = path.join(tempDir, 'contract.pdf');
        const doc = new jsPDF({ unit: 'pt', format: 'a4' });

        doc.text('Indii Music Contract', 72, 72);
        doc.text('All rights reserved.', 72, 96);

        writeFileSync(filePath, Buffer.from(doc.output('arraybuffer')));

        const result = await extractPdfContractText(filePath);

        expect(result.filePath).toBe(filePath);
        expect(result.pageCount).toBe(1);
        expect(result.hasSelectableText).toBe(true);
        expect(result.text).toContain('Indii Music Contract');
        expect(result.text).toContain('All rights reserved.');
        expect(result.pages[0]?.text).toContain('Indii Music Contract');
    });

    it('throws a clear error when the PDF is missing', async () => {
        await expect(extractPdfContractText('/does/not/exist.pdf')).rejects.toThrow('File not found: /does/not/exist.pdf');
    });
});
