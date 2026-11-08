import { describe, expect, it } from 'vitest';
import {
    assertSafeApiPathSegment,
    assertSafeExternalHttpsUrl,
    isSafeExternalHttpsUrl,
} from '../lib/safeExternalUrl';
import { assertAllowedStripeRedirectUrl } from './redirectAllowlist';
import { shouldSample } from '../functions/analytics/bigquery-pipeline';

describe('ISSUE-1555 & ISSUE-1561: safeExternalUrl & API path segment guards', () => {
    it('accepts valid public HTTPS URLs', () => {
        expect(isSafeExternalHttpsUrl('https://hooks.example.com/indii/webhook')).toBe(true);
        expect(assertSafeExternalHttpsUrl('https://cdn.indii.music/designs/shirt.png')).toBe(
            'https://cdn.indii.music/designs/shirt.png'
        );
    });

    it('rejects HTTP, loopback, RFC 1918 private IPs, and cloud metadata endpoints', () => {
        const unsafeUrls = [
            'http://hooks.example.com/webhook',
            'https://localhost/webhook',
            'https://127.0.0.1:8080/secret',
            'https://10.0.0.1/internal',
            'https://172.16.5.4/admin',
            'https://192.168.1.1/router',
            'https://169.254.169.254/latest/meta-data/',
            'https://metadata.google.internal/computeMetadata/v1/',
            'https://[::1]:8080/loopback',
            'https://user:pass@hooks.example.com/webhook',
        ];
        for (const url of unsafeUrls) {
            expect(isSafeExternalHttpsUrl(url)).toBe(false);
            expect(() => assertSafeExternalHttpsUrl(url, 'webhookUrl')).toThrow(/webhookUrl must be a valid external HTTPS URL/);
        }
    });

    it('validates API path segments and rejects path traversal sequences', () => {
        expect(assertSafeApiPathSegment('prod_123-abc', 'productId')).toBe('prod_123-abc');
        expect(assertSafeApiPathSegment(98765, 'orderId')).toBe('98765');

        const traversalPayloads = [
            '../orders',
            '../../warehouse/products',
            'doc/../../admin',
            'id%2f..%2fsecret',
            'id?admin=true',
            '',
        ];
        for (const payload of traversalPayloads) {
            expect(() => assertSafeApiPathSegment(payload, 'documentId')).toThrow(/Invalid 'documentId'/);
        }
    });
});

describe('ISSUE-1560: assertAllowedStripeRedirectUrl', () => {
    it('allows approved indii.music HTTPS redirect URLs', () => {
        expect(
            assertAllowedStripeRedirectUrl('https://app.indii.music/finance?status=success', 'successUrl')
        ).toBe('https://app.indii.music/finance?status=success');
        expect(
            assertAllowedStripeRedirectUrl('https://indii.music/pricing', 'cancelUrl')
        ).toBe('https://indii.music/pricing');
    });

    it('rejects external phishing origins and non-HTTPS URLs in production mode', () => {
        const prevEnv = process.env.NODE_ENV;
        const prevEmulator = process.env.FUNCTIONS_EMULATOR;
        process.env.NODE_ENV = 'production';
        delete process.env.FUNCTIONS_EMULATOR;
        try {
            expect(() =>
                assertAllowedStripeRedirectUrl('https://evil-phishing.example.com/steal', 'successUrl')
            ).toThrow(/successUrl must point at an approved indii.music HTTPS origin/);
            expect(() =>
                assertAllowedStripeRedirectUrl('http://app.indii.music/insecure', 'returnUrl')
            ).toThrow(/returnUrl must point at an approved indii.music HTTPS origin/);
        } finally {
            process.env.NODE_ENV = prevEnv;
            if (prevEmulator !== undefined) {
                process.env.FUNCTIONS_EMULATOR = prevEmulator;
            }
        }
    });
});

describe('ISSUE-1555: deterministic BigQuery event sampling', () => {
    it('deterministically samples the same eventId identically across real-time and batch runs', () => {
        const firstDecision = shouldSample('evt_deterministic_001');
        const secondDecision = shouldSample('evt_deterministic_001');
        expect(firstDecision).toBe(secondDecision);
    });
});
