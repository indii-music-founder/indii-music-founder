import { HttpsError } from 'firebase-functions/v2/https';

const DEFAULT_STRIPE_REDIRECT_ALLOWLIST = [
    'https://app.indii.music',
    'https://indii.music',
    'https://www.indii.music',
];

/**
 * Validates that a Stripe Checkout or Customer Portal redirect URL (`successUrl`,
 * `cancelUrl`, `returnUrl`) points to an approved indii.music HTTPS origin (or
 * loopback `http://localhost` / `http://127.0.0.1` only when running in the
 * local Functions emulator).
 */
export function assertAllowedStripeRedirectUrl(rawUrl: unknown, fieldName: string): string {
    if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
        throw new HttpsError('invalid-argument', `${fieldName} is required.`);
    }

    const configured = (
        process.env.STRIPE_REDIRECT_URL_ALLOWLIST ??
        process.env.POD_CHECKOUT_URL_ALLOWLIST ??
        DEFAULT_STRIPE_REDIRECT_ALLOWLIST.join(',')
    )
        .split(',')
        .map((entry) => entry.trim().replace(/\/$/, ''))
        .filter(Boolean);

    let parsed: URL;
    try {
        parsed = new URL(rawUrl.trim());
    } catch {
        throw new HttpsError('invalid-argument', `${fieldName} is not a valid URL.`);
    }

    const origin = `${parsed.protocol}//${parsed.host}`;
    const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true' || process.env.NODE_ENV === 'test';
    const isLocalLoopback =
        isEmulator &&
        (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
        (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');

    if (!isLocalLoopback && (parsed.protocol !== 'https:' || !configured.includes(origin))) {
        throw new HttpsError(
            'invalid-argument',
            `${fieldName} must point at an approved indii.music HTTPS origin.`,
        );
    }

    return parsed.toString();
}
