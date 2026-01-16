import { describe, it, expect } from 'vitest';
import { FetchUrlSchema } from './validation';

describe('FetchUrlSchema', () => {
    it('should accept valid public URLs', () => {
        const validUrls = [
            'https://www.google.com',
            'http://example.com',
            'https://api.openai.com/v1/chat/completions',
            'https://8.8.8.8' // Public IP
        ];

        validUrls.forEach(url => {
            const result = FetchUrlSchema.safeParse(url);
            if (!result.success) {
                console.error(`Failed valid URL: ${url}`, result.error);
            }
            expect(result.success).toBe(true);
        });
    });

    it('should accept public domains that look like private IPs', () => {
        const trickyDomains = [
            'http://10.com',
            'http://127.com',
            'http://192.168.com',
            'http://172.16.com'
        ];

        trickyDomains.forEach(url => {
            const result = FetchUrlSchema.safeParse(url);
             if (!result.success) {
                console.error(`Failed tricky domain: ${url}`, result.error);
            }
            expect(result.success).toBe(true);
        });
    });

    it('should reject non-HTTP/HTTPS protocols', () => {
        const invalidProtocols = [
            'ftp://example.com',
            'file:///etc/passwd',
            'gopher://example.com',
            'javascript:alert(1)'
        ];

        invalidProtocols.forEach(url => {
            expect(FetchUrlSchema.safeParse(url).success).toBe(false);
        });
    });

    it('should reject localhost', () => {
        const localhostUrls = [
            'http://localhost',
            'https://localhost:3000',
            'http://sub.localhost',
            'http://[::1]' // IPv6 Loopback
        ];

        localhostUrls.forEach(url => {
            expect(FetchUrlSchema.safeParse(url).success).toBe(false);
        });
    });

    it('should reject private IPv4 ranges', () => {
        const privateIps = [
            'http://127.0.0.1',
            'http://10.0.0.1',
            'http://192.168.1.1',
            'http://172.16.0.1',
            'http://169.254.169.254' // Metadata service
        ];

        privateIps.forEach(url => {
            expect(FetchUrlSchema.safeParse(url).success).toBe(false);
        });
    });

    it('should reject private IPv6 ranges', () => {
        const privateIps = [
            'http://[fc00::1]',
            'http://[fe80::1]'
        ];

        privateIps.forEach(url => {
            expect(FetchUrlSchema.safeParse(url).success).toBe(false);
        });
    });

    it('should reject tricky IP representations', () => {
        const trickyIps = [
            'http://127.1',         // 127.0.0.1
            'http://0.0.0.0',       // Any
            'http://0177.0.0.1',    // Octal
        ];

        trickyIps.forEach(url => {
             const result = FetchUrlSchema.safeParse(url);
             console.log(`Checking ${url} -> Success: ${result.success}`);
             expect(result.success).toBe(false);
        });
    });
});
