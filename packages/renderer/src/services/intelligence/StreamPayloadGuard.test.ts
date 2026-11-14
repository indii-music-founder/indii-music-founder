import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    AGENT_STREAM_CHAR_BUDGET,
    estimateContentsCharLength,
    streamImageTargetForRequest,
    assertContentsWithinStreamBudget,
    compressStreamImageAttachments,
    elideBase64Payloads,
    sanitizeObjectForPrompt,
} from './StreamPayloadGuard';
import { CloudStorageService } from '@/services/CloudStorageService';
import { AppErrorCode, AppException } from '@/shared/types/errors';
import type { Content } from '@/shared/types/ai.dto';

vi.mock('@/services/CloudStorageService', () => ({
    CloudStorageService: {
        compressImage: vi.fn(),
    },
}));

const compressImage = vi.mocked(CloudStorageService.compressImage);

function contentsWithImage(base64: string, mimeType = 'image/png'): Content[] {
    return [{
        role: 'user',
        parts: [{ text: 'Look at this' }, { inlineData: { mimeType, data: base64 } }],
    }];
}

describe('estimateContentsCharLength', () => {
    it('mirrors the server measurement JSON.stringify(contents).length exactly', () => {
        const contents = contentsWithImage('abc123');
        expect(estimateContentsCharLength(contents)).toBe(JSON.stringify(contents).length);
    });
});

describe('assertContentsWithinStreamBudget', () => {
    it('passes contents under the server budget', () => {
        expect(() => assertContentsWithinStreamBudget(contentsWithImage('small'), 'test')).not.toThrow();
    });

    it('throws a specific retryable-false PAYLOAD_TOO_LARGE over the server budget', () => {
        const contents = contentsWithImage('A'.repeat(AGENT_STREAM_CHAR_BUDGET + 1));
        try {
            assertContentsWithinStreamBudget(contents, 'creative#iteration-1');
            expect.unreachable('should have thrown');
        } catch (error) {
            expect(error).toBeInstanceOf(AppException);
            const appError = error as AppException;
            expect(appError.code).toBe(AppErrorCode.PAYLOAD_TOO_LARGE);
            expect(appError.details?.retryable).toBe(false);
            expect(appError.message).toMatch(/too large/i);
            expect(appError.details?.context).toMatchObject({ label: 'creative#iteration-1' });
        }
    });
});

// Structural-only payload arithmetic: no customer account or provider claims.
describe('streamImageTargetForRequest', () => {
    it('reserves the serialized prompt and image envelope before dividing image space', () => {
        const prompt = 'T'.repeat(600_000);
        const attachments = [{ mimeType: 'image/png', base64: 'AAAA' }];
        // The previous fixed 250K fallback still overflowed this text budget.
        expect(() => assertContentsWithinStreamBudget([{
            role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: 'image/png', data: 'A'.repeat(250_000) } }],
        }], 'fixed-target')).toThrow();
        const target = streamImageTargetForRequest(prompt, attachments);
        expect(target).toBeLessThan(200_000);
        expect(() => assertContentsWithinStreamBudget([{
            role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: 'image/png', data: 'A'.repeat(target) } }],
        }], 'sized')).not.toThrow();
        expect(attachments[0]!.base64).toBe('AAAA');
    });

    it('accounts for JSON escaping, multiple images, and non-image attachments', () => {
        const prompt = '"\n'.repeat(100_000);
        const attachments = [
            { mimeType: 'image/png', base64: 'AAAA' },
            { mimeType: 'image/jpeg', base64: 'BBBB' },
            { mimeType: 'application/pdf', base64: 'C'.repeat(50_000) },
        ];
        const target = streamImageTargetForRequest(prompt, attachments);
        const contents: Content[] = [{ role: 'user', parts: [
            { text: prompt },
            ...attachments.map(a => ({ inlineData: { mimeType: a.mimeType, data: a.mimeType.startsWith('image/') ? 'A'.repeat(target) : a.base64 } })),
        ] }];
        expect(estimateContentsCharLength(contents)).toBeLessThanOrEqual(AGENT_STREAM_CHAR_BUDGET);
        expect(target).toBeGreaterThan(0);
    });

    it('keeps the usual image quality ceiling for short prompts', () => {
        expect(streamImageTargetForRequest('Describe this', [{ mimeType: 'image/png', base64: 'AAAA' }])).toBe(400_000);
    });

    it('returns a positive compression target when text alone cannot fit; the request guard still rejects it', () => {
        const prompt = 'T'.repeat(AGENT_STREAM_CHAR_BUDGET);
        expect(streamImageTargetForRequest(prompt, [{ mimeType: 'image/png', base64: 'AAAA' }])).toBe(1);
        expect(() => assertContentsWithinStreamBudget([{ role: 'user', parts: [{ text: prompt }] }], 'text')).toThrow();
    });
});

describe('compressStreamImageAttachments', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each([undefined, 250_000])('shares the backend contents budget across images with target %s', async target => {
        const images = Array.from({ length: 4 }, () => ({ mimeType: 'image/png', base64: 'A'.repeat(200_000) }));
        compressImage.mockResolvedValue({ blob: new Blob(['x']), dataUri: `data:image/jpeg;base64,${'B'.repeat(140_000)}` });
        const result = await compressStreamImageAttachments(images, target);
        expect(compressImage).toHaveBeenCalledTimes(4);
        expect(result.reduce((sum, image) => sum + image.base64.length, 0)).toBeLessThanOrEqual(600_000);
        expect(images[0]!.base64.length).toBe(200_000);
        compressImage.mockReset();
    });

    it('passes small image attachments through untouched without invoking compression', async () => {
        const small = { mimeType: 'image/png', base64: 'tiny' };
        const result = await compressStreamImageAttachments([small]);
        expect(result).toEqual([small]);
        expect(compressImage).not.toHaveBeenCalled();
    });

    it('compresses an oversized raster image and returns the compressed parts', async () => {
        compressImage.mockResolvedValueOnce({
            blob: new Blob(['x']),
            dataUri: 'data:image/jpeg;base64,compressed-small',
        });

        const [result] = await compressStreamImageAttachments([
            { mimeType: 'image/png', base64: 'A'.repeat(1_200_000) },
        ]);

        expect(result.mimeType).toBe('image/jpeg');
        expect(result.base64).toBe('compressed-small');
        expect(compressImage).toHaveBeenCalledTimes(1);
        expect(compressImage.mock.calls[0]?.[1]).toMatchObject({ maxWidth: 1536, format: 'jpeg' });
    });

    it('walks the ladder when the first compression still exceeds the target', async () => {
        compressImage
            .mockResolvedValueOnce({
                blob: new Blob(['x']),
                dataUri: `data:image/jpeg;base64,${'A'.repeat(1_100_000)}`,
            })
            .mockResolvedValueOnce({
                blob: new Blob(['x']),
                dataUri: 'data:image/jpeg;base64,small-enough',
            });

        const [result] = await compressStreamImageAttachments([
            { mimeType: 'image/jpeg', base64: 'A'.repeat(1_500_000) },
        ]);

        expect(result.base64).toBe('small-enough');
        expect(compressImage).toHaveBeenCalledTimes(2);
        expect(compressImage.mock.calls[0]?.[1]).toMatchObject({ maxWidth: 1536 });
        expect(compressImage.mock.calls[1]?.[1]).toMatchObject({ maxWidth: 1024 });
    });

    it('fails open: keeps the original attachment when compression throws', async () => {
        compressImage.mockRejectedValueOnce(new Error('canvas unavailable'));

        const original = { mimeType: 'image/png', base64: 'A'.repeat(1_200_000) };
        const [result] = await compressStreamImageAttachments([original]);

        expect(result).toEqual(original);
    });

    it('never compresses non-image attachments', async () => {
        const audio = { mimeType: 'audio/mpeg', base64: 'A'.repeat(1_200_000) };
        const result = await compressStreamImageAttachments([audio]);
        expect(result).toEqual([audio]);
        expect(compressImage).not.toHaveBeenCalled();
    });

    it('preserves extra fields carried by the caller attachment shape', async () => {
        compressImage.mockResolvedValueOnce({
            blob: new Blob(['x']),
            dataUri: 'data:image/jpeg;base64,small',
        });

        const [result] = await compressStreamImageAttachments([
            { mimeType: 'image/png', base64: 'A'.repeat(1_200_000), name: 'tigers-reference.png' } as
                { mimeType: string; base64: string; name: string },
        ]);

        expect(result).toMatchObject({ name: 'tigers-reference.png', base64: 'small' });
    });
});

describe('elideBase64Payloads', () => {
    it('elides a large data-URL payload while preserving the mime type and reporting its size', () => {
        const hugePayload = 'A'.repeat(400_000); // ~300KB binary
        const toolJson = `Success: {"id":"img-1","url":"data:image/png;base64,${hugePayload}"}`;

        const output = elideBase64Payloads(toolJson);

        expect(output).not.toContain(hugePayload);
        expect(output).toContain('data:image/png;base64,[elided');
        expect(output).toMatch(/elided 293KB/);
        expect(output).toContain('"id":"img-1"');
    });

    it('elides multiple embedded payloads in one pass', () => {
        const text = `a=data:image/jpeg;base64,${'B'.repeat(2000)} b=data:image/webp;base64,${'C'.repeat(4000)}`;
        const output = elideBase64Payloads(text);
        expect(output).not.toMatch(/[BC]{1024,}/);
        expect(output.match(/elided/g)?.length).toBe(2);
    });

    it('leaves short base64 fixtures (test-sized) untouched', () => {
        const text = 'data:image/png;base64,AQID and data:image/png;base64,tiny';
        expect(elideBase64Payloads(text)).toBe(text);
    });

    it('leaves plain text and text without base64 markers untouched', () => {
        const text = '[Tool Call: generate_image({"prompt":"Old English D style"})] Result: Success: done';
        expect(elideBase64Payloads(text)).toBe(text);
        expect(elideBase64Payloads('')).toBe('');
    });
});

describe('sanitizeObjectForPrompt', () => {
    it('recursively elides base64 data-URLs within nested objects and arrays', () => {
        const largeBase64 = 'A'.repeat(2048);
        const input = {
            brand: {
                logo: `data:image/png;base64,${largeBase64}`,
                name: 'Indii Records',
            },
            whisk: [
                { id: '1', content: `data:image/jpeg;base64,${largeBase64}` },
                { id: '2', content: 'normal text' },
            ],
            plainNumber: 42,
            plainBoolean: true,
            nullable: null,
        };

        const result = sanitizeObjectForPrompt(input);

        expect(result.brand.name).toBe('Indii Records');
        expect(result.brand.logo).toContain('data:image/png;base64,[elided');
        expect(result.brand.logo).not.toContain(largeBase64);
        expect(result.whisk[0]?.content).toContain('data:image/jpeg;base64,[elided');
        expect(result.whisk[1]?.content).toBe('normal text');
        expect(result.plainNumber).toBe(42);
        expect(result.plainBoolean).toBe(true);
        expect(result.nullable).toBeNull();
    });
});
