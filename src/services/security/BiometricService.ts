import { logger } from '@/utils/logger';

/**
 * BiometricService.ts
 * 
 * Handles WebAuthn (Passkeys) interactions for local device authentication (FaceID/TouchID).
 * This service is used to "gate" the application when resumes from background or on startup
 * if the user has enabled biometric lock.
 */

export class BiometricService {
    /**
     * Checks if the device supports platform authenticators (FaceID/TouchID).
     */
    static async isAvailable(): Promise<boolean> {
        if (typeof window === 'undefined' || !window.PublicKeyCredential) {
            return false;
        }

        try {
            // Check if platform authenticator is available
            const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
            return available;
        } catch (error) {
            logger.error('[BiometricService] Availability check failed:', error);
            return false;
        }
    }

    /**
     * Registers a new credential (creates a passkey) on the device.
     * Note: In a real persistent auth scenario, we would send the public key to the backend.
     * For this "Privacy Screen" implementation, we just verify the user CAN create one
     * and use the "verify" step which forces the OS prompt.
     */
    static async register(userId: string, username: string): Promise<boolean> {
        if (!await this.isAvailable()) {
            throw new Error('Biometrics not available on this device.');
        }

        try {
            // Challenge should ideally come from server to prevent replay attacks
            const challenge = new Uint8Array(32);
            window.crypto.getRandomValues(challenge);

            const userIdBuffer = new TextEncoder().encode(userId);

            const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
                challenge,
                rp: {
                    name: 'indiiOS',
                    id: window.location.hostname, // Must match current domain
                },
                user: {
                    id: userIdBuffer,
                    name: username,
                    displayName: username,
                },
                pubKeyCredParams: [{ alg: -7, type: 'public-key' }], // ES256
                authenticatorSelection: {
                    authenticatorAttachment: 'platform', // Force FaceID/TouchID
                    userVerification: 'required',
                    requireResidentKey: false,
                },
                timeout: 60000,
                attestation: 'none',
            };

            const credential = await navigator.credentials.create({
                publicKey: publicKeyCredentialCreationOptions,
            });

            // If we got a credential, the user successfully authenticated with FaceID/TouchID
            return !!credential;
        } catch (error) {
            logger.error('[BiometricService] Registration failed:', error);
            return false;
        }
    }

    /**
     * Verifies the user using the device's authenticator.
     * Since we are using this as a local privacy screen, we don't strictly need to verify
     * the signature against a backend. The mere fact that `navigator.credentials.get`
     * succeeded means the user passed various OS-level biometric checks.
     */
    static async verify(): Promise<boolean> {
        if (!await this.isAvailable()) {
            return false;
        }

        try {
            const challenge = new Uint8Array(32);
            window.crypto.getRandomValues(challenge);

            // We create a "dummy" request just to trigger the OS prompt
            const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
                challenge,
                rpId: window.location.hostname,
                userVerification: 'required',
                timeout: 60000,
            };

            const assertion = await navigator.credentials.get({
                publicKey: publicKeyCredentialRequestOptions,
            });

            return !!assertion;
        } catch (error) {
            logger.warn('[BiometricService] Verification failed or cancelled:', error);
            return false;
        }
    }
}
