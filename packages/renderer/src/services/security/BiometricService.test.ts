import { describe, it, expect, vi } from 'vitest';
import { BiometricService } from './BiometricService';

describe('BiometricService', () => {
    // ==========================================================================
    // isAvailable
    // ==========================================================================

    describe('isAvailable', () => {
        it('returns false when PublicKeyCredential is not defined', async () => {
            // jsdom doesn't provide PublicKeyCredential by default
            const original = window.PublicKeyCredential;
            Object.defineProperty(window, 'PublicKeyCredential', {
                value: undefined,
                writable: true,
                configurable: true,
            });

            const result = await BiometricService.isAvailable();
            expect(result).toBe(false);

            // Restore
            Object.defineProperty(window, 'PublicKeyCredential', {
                value: original,
                writable: true,
                configurable: true,
            });
        });

        it('returns false when isUserVerifyingPlatformAuthenticatorAvailable returns false', async () => {
            const mockPublicKeyCredential = {
                isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(false),
            };

            Object.defineProperty(window, 'PublicKeyCredential', {
                value: mockPublicKeyCredential,
                writable: true,
                configurable: true,
            });

            const result = await BiometricService.isAvailable();
            expect(result).toBe(false);
        });

        it('returns true when platform authenticator is available', async () => {
            const mockPublicKeyCredential = {
                isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(true),
            };

            Object.defineProperty(window, 'PublicKeyCredential', {
                value: mockPublicKeyCredential,
                writable: true,
                configurable: true,
            });

            const result = await BiometricService.isAvailable();
            expect(result).toBe(true);
        });

        it('returns false when availability check throws', async () => {
            const mockPublicKeyCredential = {
                isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockRejectedValue(new Error('Failed')),
            };

            Object.defineProperty(window, 'PublicKeyCredential', {
                value: mockPublicKeyCredential,
                writable: true,
                configurable: true,
            });

            const result = await BiometricService.isAvailable();
            expect(result).toBe(false);
        });
    });

    // ==========================================================================
    // register
    // ==========================================================================

    describe('register', () => {
        it('throws when biometrics not available', async () => {
            Object.defineProperty(window, 'PublicKeyCredential', {
                value: undefined,
                writable: true,
                configurable: true,
            });

            await expect(BiometricService.register('user-123', 'testuser'))
                .rejects.toThrow('Biometrics not available on this device.');
        });

        it('returns true when credential is created successfully', async () => {
            // Mock PublicKeyCredential
            Object.defineProperty(window, 'PublicKeyCredential', {
                value: {
                    isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(true),
                },
                writable: true,
                configurable: true,
            });

            // Mock navigator.credentials.create
            const mockCredential = { id: 'cred-123', type: 'public-key' };
            Object.defineProperty(navigator, 'credentials', {
                value: {
                    create: vi.fn().mockResolvedValue(mockCredential),
                    get: vi.fn(),
                },
                writable: true,
                configurable: true,
            });

            const result = await BiometricService.register('user-123', 'testuser');
            expect(result).toBe(true);
        });

        it('returns false when credential creation fails', async () => {
            Object.defineProperty(window, 'PublicKeyCredential', {
                value: {
                    isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(true),
                },
                writable: true,
                configurable: true,
            });

            Object.defineProperty(navigator, 'credentials', {
                value: {
                    create: vi.fn().mockRejectedValue(new Error('User cancelled')),
                    get: vi.fn(),
                },
                writable: true,
                configurable: true,
            });

            const result = await BiometricService.register('user-123', 'testuser');
            expect(result).toBe(false);
        });
    });

    // ==========================================================================
    // verify
    // ==========================================================================

    describe('verify', () => {
        it('returns false when biometrics not available', async () => {
            Object.defineProperty(window, 'PublicKeyCredential', {
                value: undefined,
                writable: true,
                configurable: true,
            });

            const result = await BiometricService.verify();
            expect(result).toBe(false);
        });

        it('returns true when assertion succeeds', async () => {
            Object.defineProperty(window, 'PublicKeyCredential', {
                value: {
                    isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(true),
                },
                writable: true,
                configurable: true,
            });

            const mockAssertion = { id: 'assertion-123', type: 'public-key' };
            Object.defineProperty(navigator, 'credentials', {
                value: {
                    create: vi.fn(),
                    get: vi.fn().mockResolvedValue(mockAssertion),
                },
                writable: true,
                configurable: true,
            });

            const result = await BiometricService.verify();
            expect(result).toBe(true);
        });

        it('returns false when user cancels or verification fails', async () => {
            Object.defineProperty(window, 'PublicKeyCredential', {
                value: {
                    isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(true),
                },
                writable: true,
                configurable: true,
            });

            Object.defineProperty(navigator, 'credentials', {
                value: {
                    create: vi.fn(),
                    get: vi.fn().mockRejectedValue(new Error('User cancelled biometric verification')),
                },
                writable: true,
                configurable: true,
            });

            const result = await BiometricService.verify();
            expect(result).toBe(false);
        });
    });
});
