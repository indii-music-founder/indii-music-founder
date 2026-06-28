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
export declare class AuthService {
    /**
     * Validates that a JWT token has the expected structure and claims.
     * This is a structural validation - full cryptographic verification happens server-side or via SDK.
     */
    static validateTokenStructure(token: string): TokenValidationResult;
    /**
     * Validates the deep link URL origin and structure
     */
    static validateDeepLinkOrigin(url: string): DeepLinkValidationResult;
    /**
     * Checks if legacy token callback is allowed based on environment
     */
    static isLegacyCallbackEnabled(env: Record<string, string | undefined>): boolean;
}
//# sourceMappingURL=AuthService.d.ts.map