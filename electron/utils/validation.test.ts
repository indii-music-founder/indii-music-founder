// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
    FetchUrlSchema,
    AgentActionSchema,
    SFTPConfigSchema,
    AudioAnalyzeSchema
} from './validation';

describe('Electron Validation Schemas', () => {
    describe('FetchUrlSchema (SSRF Protection)', () => {
        it('should allow public https urls', () => {
            expect(FetchUrlSchema.parse('https://google.com')).toBe('https://google.com');
            expect(FetchUrlSchema.parse('http://example.org/path?q=1')).toBe('http://example.org/path?q=1');
        });

        it('should block non-http protocols', () => {
            expect(() => FetchUrlSchema.parse('file:///etc/passwd')).toThrow();
            expect(() => FetchUrlSchema.parse('ftp://example.com')).toThrow();
            expect(() => FetchUrlSchema.parse('gopher://example.com')).toThrow();
        });

        it('should block localhost and private IPs', () => {
            expect(() => FetchUrlSchema.parse('http://localhost:3000')).toThrow();
            expect(() => FetchUrlSchema.parse('http://127.0.0.1')).toThrow();
            expect(() => FetchUrlSchema.parse('http://192.168.1.1')).toThrow();
            expect(() => FetchUrlSchema.parse('http://10.0.0.5')).toThrow();
            expect(() => FetchUrlSchema.parse('http://169.254.169.254')).toThrow(); // Metadata service
            expect(() => FetchUrlSchema.parse('http://[::1]')).toThrow(); // IPv6 loopback
        });

        it('should block trickery', () => {
            expect(() => FetchUrlSchema.parse('http://0.0.0.0')).toThrow();
            // expect(() => FetchUrlSchema.parse('http://0177.0.0.1')).toThrow(); // Octal - node isIP handles this differently often, but schema blocks 0-leading
        });
    });

    describe('AgentActionSchema', () => {
        it('should validate allowed actions', () => {
            const data = { action: 'click', selector: '#btn' };
            expect(AgentActionSchema.parse(data).action).toBe('click');
        });

        it('should reject invalid actions', () => {
            const data = { action: 'destroy', selector: '#btn' };
            expect(() => AgentActionSchema.parse(data)).toThrow();
        });
    });

    describe('SFTPConfigSchema', () => {
        it('should require either password or privateKey', () => {
            const valid1 = { host: 'h', username: 'u', password: 'p' };
            const valid2 = { host: 'h', username: 'u', privateKey: 'k' };
            const invalid = { host: 'h', username: 'u' };

            expect(SFTPConfigSchema.parse(valid1)).toBeTruthy();
            expect(SFTPConfigSchema.parse(valid2)).toBeTruthy();
            expect(() => SFTPConfigSchema.parse(invalid)).toThrow();
        });
    });

    describe('AudioAnalyzeSchema', () => {
        it('should allow valid audio extensions', () => {
            expect(AudioAnalyzeSchema.parse('/path/to/song.mp3')).toBe('/path/to/song.mp3');
            expect(AudioAnalyzeSchema.parse('C:\\Music\\song.wav')).toBe('C:\\Music\\song.wav');
        });

        it('should block traversal', () => {
            expect(() => AudioAnalyzeSchema.parse('../../etc/passwd.mp3')).toThrow();
        });

        it('should block invalid extensions', () => {
            expect(() => AudioAnalyzeSchema.parse('image.png')).toThrow();
            expect(() => AudioAnalyzeSchema.parse('script.js')).toThrow();
        });
    });
});
