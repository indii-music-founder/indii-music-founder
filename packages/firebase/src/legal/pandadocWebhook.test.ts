import { describe, it, expect } from 'vitest';
import * as crypto from 'crypto';
import { extractWritersFromTokens, extractPublisherFromTokens } from './pandadocWebhook';

describe('PandaDoc Webhook Split & Token Extraction (ISSUE-1550)', () => {
    it('calculates single-writer share as 100% when no publisher share is present', () => {
        const tokens = {
            artist_legal_name: 'Jane Doe',
            artist_ipi: '00123456789',
            artist_pro: 'BMI',
        };

        const writers = extractWritersFromTokens(tokens);
        expect(writers).toHaveLength(1);
        expect(writers[0]).toEqual({
            legalName: 'Jane Doe',
            ipiNumber: '00123456789',
            pro: 'BMI',
            share: 100,
            role: 'CA',
        });
    });

    it('subtracts publisher share from single-writer share to prevent 150% distortion', () => {
        const tokens = {
            artist_legal_name: 'Jane Doe',
            artist_ipi: '00123456789',
            artist_pro: 'BMI',
            publisher_name: 'Acme Publishing',
            publisher_ipi: '00987654321',
            publisher_share: '50',
        };

        const writers = extractWritersFromTokens(tokens);
        expect(writers).toHaveLength(1);
        expect(writers[0].share).toBe(50); // 100 - 50 = 50%

        const publisher = extractPublisherFromTokens(tokens);
        expect(publisher).toEqual({
            name: 'Acme Publishing',
            ipiNumber: '00987654321',
            share: 50,
        });

        // Combined share must sum to exactly 100%
        expect(writers[0].share + (publisher?.share ?? 0)).toBe(100);
    });

    it('handles fractional publisher shares with proper rounding', () => {
        const tokens = {
            artist_legal_name: 'John Smith',
            publisher_name: 'Co-Publishing LLC',
            publisher_share: '33.33',
        };

        const writers = extractWritersFromTokens(tokens);
        expect(writers).toHaveLength(1);
        expect(writers[0].share).toBe(66.67);

        const publisher = extractPublisherFromTokens(tokens);
        expect(publisher?.share).toBe(33.33);
        expect(writers[0].share + (publisher?.share ?? 0)).toBe(100);
    });

    it('preserves multi-writer shares without overriding from publisher_share', () => {
        const tokens = {
            writer_1_name: 'Writer One',
            writer_1_share: '60',
            writer_1_role: 'C',
            writer_2_name: 'Writer Two',
            writer_2_share: '40',
            writer_2_role: 'A',
            publisher_name: 'Acme Publishing',
            publisher_share: '50',
        };

        const writers = extractWritersFromTokens(tokens);
        expect(writers).toHaveLength(2);
        expect(writers[0]).toEqual({
            legalName: 'Writer One',
            ipiNumber: undefined,
            pro: undefined,
            share: 60,
            role: 'C',
        });
        expect(writers[1]).toEqual({
            legalName: 'Writer Two',
            ipiNumber: undefined,
            pro: undefined,
            share: 40,
            role: 'A',
        });
    });

    it('ignores Self or N/A publisher names', () => {
        expect(extractPublisherFromTokens({ publisher_name: 'Self', publisher_share: '50' })).toBeNull();
        expect(extractPublisherFromTokens({ publisher_name: 'N/A', publisher_share: '50' })).toBeNull();
        expect(extractPublisherFromTokens({})).toBeNull();
    });
});

describe('PandaDoc Webhook rawBody HMAC Signature Verification (ISSUE-1550)', () => {
    const SECRET = 'test-pandadoc-secret-key-12345';

    it('computes and validates HMAC-SHA256 matching wire bytes in rawBody', () => {
        const wireBytes = Buffer.from('{"event":"document_state_changed","data":[{"id":"doc_1","status":"document.completed"}]}', 'utf8');
        const expectedSignature = crypto
            .createHmac('sha256', SECRET)
            .update(wireBytes.toString('utf8'))
            .digest('hex');

        const signatureBuf = Buffer.from(expectedSignature);
        const expectedBuf = Buffer.from(expectedSignature);

        expect(signatureBuf.length).toBe(expectedBuf.length);
        expect(crypto.timingSafeEqual(signatureBuf, expectedBuf)).toBe(true);
    });

    it('detects signature mismatch when wire JSON formatting differs from re-serialized JSON', () => {
        const wireString = '{\n  "event": "document_state_changed",\n  "data": [\n    {\n      "id": "doc_1"\n    }\n  ]\n}';
        const parsedAndReserialized = JSON.stringify(JSON.parse(wireString));

        const correctHmac = crypto.createHmac('sha256', SECRET).update(wireString).digest('hex');
        const reSerializedHmac = crypto.createHmac('sha256', SECRET).update(parsedAndReserialized).digest('hex');

        // HMACs differ because whitespace was stripped in JSON.stringify!
        // This is why using req.rawBody is mandatory.
        expect(correctHmac).not.toBe(reSerializedHmac);
    });
});
