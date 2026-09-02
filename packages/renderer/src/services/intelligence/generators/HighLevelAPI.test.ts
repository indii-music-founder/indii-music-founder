import { describe, it, expect, vi } from 'vitest';
import { extractAndParseJson, parseJSON } from './HighLevelAPI';
import { AppException, AppErrorCode } from '@/shared/types/errors';

describe('HighLevelAPI: extractAndParseJson & parseJSON', () => {
    it('parses raw valid JSON string', () => {
        const input = '{"title": "Detroit Sunrise", "bpm": 128, "genre": "Techno"}';
        const parsed = extractAndParseJson<{ title: string; bpm: number; genre: string }>(input);
        expect(parsed).toEqual({ title: 'Detroit Sunrise', bpm: 128, genre: 'Techno' });
    });

    it('strips markdown code blocks with standard closing fence without space', () => {
        const input = '```json\n{\n  "isrc": "USND12600001",\n  "ddexGenre": "Electronic"\n}\n```';
        const parsed = extractAndParseJson<{ isrc: string; ddexGenre: string }>(input);
        expect(parsed).toEqual({ isrc: 'USND12600001', ddexGenre: 'Electronic' });
    });

    it('strips markdown fences with conversational surrounding commentary', () => {
        const input = 'Here is the analyzed metadata for indii.music:\n```json\n{"mood": ["Euphoric"], "explicit": false}\n```\nLet me know if you need changes!';
        const parsed = extractAndParseJson<{ mood: string[]; explicit: boolean }>(input);
        expect(parsed).toEqual({ mood: ['Euphoric'], explicit: false });
    });

    it('extracts outermost JSON object when code fences are missing but commentary is present', () => {
        const input = 'Automated publishing output:\n{"upc": "123456789012", "trackTitle": "Night Shift"}\nVerified by indiiOS.';
        const parsed = extractAndParseJson<{ upc: string; trackTitle: string }>(input);
        expect(parsed).toEqual({ upc: '123456789012', trackTitle: 'Night Shift' });
    });

    it('extracts outermost JSON array when response is a list', () => {
        const input = 'Suggested genres: ["Detroit Techno", "Deep House", "Minimal"]';
        const parsed = extractAndParseJson<string[]>(input);
        expect(parsed).toEqual(['Detroit Techno', 'Deep House', 'Minimal']);
    });

    it('throws an AppException with INTERNAL_ERROR when input cannot be parsed', () => {
        const input = 'Not a json string at all';
        expect(() => extractAndParseJson(input)).toThrow(AppException);
        try {
            extractAndParseJson(input);
        } catch (err: unknown) {
            expect(err).toBeInstanceOf(AppException);
            expect((err as AppException).code).toBe(AppErrorCode.INTERNAL_ERROR);
        }
    });

    it('warns on missing required schema keys', () => {
        const schema = {
            type: 'OBJECT' as const,
            properties: {
                trackTitle: { type: 'STRING' },
                artistName: { type: 'STRING' }
            },
            required: ['trackTitle', 'artistName']
        };

        const input = '{"trackTitle": "Only Title"}';
        const parsed = extractAndParseJson<{ trackTitle: string; artistName?: string }>(input, schema);
        expect(parsed.trackTitle).toBe('Only Title');
    });

    it('parseJSON function uses resilient extraction and falls back to empty object on error', () => {
        const input = '```json\n{"valid": true}\n```';
        expect(parseJSON(input)).toEqual({ valid: true });

        const invalid = 'totally invalid';
        expect(parseJSON(invalid)).toEqual({});
        expect(parseJSON(undefined)).toEqual({});
    });
});
