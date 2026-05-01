/**
 * Shared Authentication Service
 * 
 * Centralizes business logic for:
 * - Token structure validation (JWT)
 * - Deep link URL parsing and security validation
 * - Common auth-related types and constants
 */

export interface TokenValidationResult {
    valid: boolean;
    error?: string;
}

export interface DeepLinkValidationResult {
    valid: boolean;
    error?: string;
}

export interface AuthTokens {
    idToken: string;
    accessToken?: string | null;
    refreshToken?: string | null;
}

export class AuthService {
    /**
     * Validates that a JWT token has the expected structure and claims.
     * This is a structural validation - full cryptographic verification happens server-side or via SDK.
     */
    static validateTokenStructure(token: string): TokenValidationResult {
        if (!token || typeof token !== 'string') {
            return { valid: false, error: 'Token is empty or not a string' };
        }

        // JWT must have 3 parts separated by dots
        const parts = token.split('.');
        if (parts.length !== 3) {
            return { valid: false, error: 'Token does not have valid JWT structure (expected 3 parts)' };
        }

        try {
            // Decode the payload (middle part)
            // Note: Buffer is available in Node/Electron environments
            const payloadBase64 = parts[1];
            const payloadStr = Buffer.from(payloadBase64, 'base64url').toString('utf8');
            const payload = JSON.parse(payloadStr);

            // Validate required claims exist
            if (!payload.iss) {
                return { valid: false, error: 'Token missing issuer (iss) claim' };
            }

            // Validate issuer is from Google/Firebase
            const validIssuers = [
                'https://accounts.google.com',
                'accounts.google.com',
                'https://securetoken.google.com/indiios-v-1-1',
            ];

            const isGoogleIssuer = validIssuers.some(iss => payload.iss === iss || payload.iss.includes('securetoken.google.com'));
            
            if (!isGoogleIssuer) {
                return { valid: false, error: `Token has unexpected issuer: ${payload.iss}` };
            }

            // Check expiration
            if (payload.exp) {
                const now = Math.floor(Date.now() / 1000);
                if (payload.exp < now) {
                    return { valid: false, error: 'Token has expired' };
                }
            }

            // Check audience for Firebase tokens
            if (payload.aud && !payload.aud.includes('indiios')) {
                // Allow Google OAuth tokens which have different audience
                if (!payload.iss.includes('accounts.google.com')) {
                    return { valid: false, error: `Token has unexpected audience: ${payload.aud}` };
                }
            }

            return { valid: true };
        } catch (e) {
            return { valid: false, error: `Failed to parse token payload: ${e instanceof Error ? e.message : String(e)}` };
        }
    }

    /**
     * Validates the deep link URL origin and structure
     */
    static validateDeepLinkOrigin(url: string): DeepLinkValidationResult {
        try {
            const urlObj = new URL(url);

            // Must be our custom protocol
            if (urlObj.protocol !== 'indii-os:') {
                return { valid: false, error: `Invalid protocol: ${urlObj.protocol}` };
            }

            // Must be the auth callback path
            if (urlObj.hostname !== 'auth' || urlObj.pathname !== '/callback') {
                return { valid: false, error: `Unexpected path: ${urlObj.hostname}${urlObj.pathname}` };
            }

            // Check for suspicious parameters that shouldn't be there
            const suspiciousParams = ['redirect', 'next', 'url', 'goto', 'returnUrl'];
            for (const param of suspiciousParams) {
                if (urlObj.searchParams.has(param)) {
                    return { valid: false, error: `Suspicious parameter detected: ${param}` };
                }
            }

            return { valid: true };
        } catch (e) {
            return { valid: false, error: `Failed to parse URL: ${e instanceof Error ? e.message : String(e)}` };
        }
    }

    /**
     * Checks if legacy token callback is allowed based on environment
     */
    static isLegacyCallbackEnabled(env: Record<string, string | undefined>): boolean {
        if (env.AUTH_ALLOW_LEGACY_TOKEN_CALLBACK === 'true') {
            return true;
        }

        if (!env.AUTH_HANDOFF_REDEEM_URL) {
            return true;
        }

        return false;
    }
}
