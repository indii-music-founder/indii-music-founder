import { describe, it, expect } from 'vitest';
import { generatePKCECodeVerifier, generatePKCECodeChallenge } from './pkce';

describe('pkce', () => {
    describe('generatePKCECodeVerifier', () => {
        it('should return a string of expected length', () => {
            const verifier = generatePKCECodeVerifier();
            expect(typeof verifier).toBe('string');
            expect(verifier.length).toBe(43); // 32 bytes base64 encoded and unpadded is 43 chars
        });

        it('should be URL-safe base64', () => {
            const verifier = generatePKCECodeVerifier();
            expect(verifier).not.toMatch(/[+/=]/);
            expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
        });

        it('should generate unique values', () => {
            const verifier1 = generatePKCECodeVerifier();
            const verifier2 = generatePKCECodeVerifier();
            expect(verifier1).not.toBe(verifier2);
        });
    });

    describe('generatePKCECodeChallenge', () => {
        it('should generate correct challenge for a known verifier', () => {
            const verifier = 'test-verifier-string-1234567890';
            const expectedChallenge = 'fZ9dY6hYAd7hohpVzYNoCj52uINHl9u3Ae-GdkNbMrU';

            const challenge = generatePKCECodeChallenge(verifier);
            expect(challenge).toBe(expectedChallenge);
        });

        it('should be URL-safe base64', () => {
            const verifier = generatePKCECodeVerifier();
            const challenge = generatePKCECodeChallenge(verifier);

            expect(challenge).not.toMatch(/[+/=]/);
            expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
        });

        it('should generate different challenges for different verifiers', () => {
            const challenge1 = generatePKCECodeChallenge('verifier1');
            const challenge2 = generatePKCECodeChallenge('verifier2');

            expect(challenge1).not.toBe(challenge2);
        });
    });
});
