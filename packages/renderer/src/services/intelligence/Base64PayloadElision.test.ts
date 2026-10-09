import { describe, expect, it } from 'vitest';
import { elideBase64Payloads } from './Base64PayloadElision';

describe('print-sized base64 prompt elision', () => {
    it('handles a 20 MB literal payload without overflowing the regex stack', () => {
        const text = `Success: {"dataUrl":"data:image/png;base64,${'A'.repeat(20_000_000)}","width":3000,"dpi":300}`;
        expect(elideBase64Payloads(text)).toBe('Success: {"dataUrl":"data:image/png;base64,[elided 14648KB — delivered to the model as inlineData when needed]","width":3000,"dpi":300}');
    });

    it('preserves surrounding metadata, short URIs and delimiters across multiple exports', () => {
        const first = 'data:image/png;base64,' + 'A'.repeat(1024);
        const second = 'data:image/jpeg;base64,' + '/+B='.repeat(512);
        const result = elideBase64Payloads(`before data:image/png;base64,AQID ${first} | ${second} after`);
        expect(result).toContain('before data:image/png;base64,AQID ');
        expect(result).toContain('data:image/png;base64,[elided 1KB');
        expect(result).toContain(' | data:image/jpeg;base64,[elided 2KB');
        expect(result).toMatch(/\] after$/);
        expect(result).not.toContain('A'.repeat(1024));
    });

    it('leaves ordinary text, empty payloads and subthreshold payloads unchanged', () => {
        for (const text of ['', 'ordinary text', 'data:image/png;base64,', 'data:image/png;base64,' + 'A'.repeat(1023)]) {
            expect(elideBase64Payloads(text)).toBe(text);
        }
    });
});
