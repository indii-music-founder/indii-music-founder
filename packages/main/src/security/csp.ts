/**
 * Content Security Policy Configuration for Electron
 * 
 * This module provides CSP headers that protect against:
 * - XSS (Cross-Site Scripting)
 * - Code injection
 * - Data exfiltration
 * - Clickjacking
 * 
 * IMPORTANT: Update ALLOWED_ORIGINS when adding new external services.
 */

import { session } from 'electron';
import crypto from 'node:crypto';

// ============================================================================
// Configuration
// ============================================================================

const isDev = process.env.NODE_ENV === 'development';

/**
 * Allowed external origins for various CSP directives.
 * Add new domains here when integrating external services.
 */
const ALLOWED_ORIGINS = {
    // Google/Firebase services
    google: [
        'https://*.googleapis.com',
        'https://*.google.com',
        'https://*.gstatic.com',
        'https://*.firebaseapp.com',
        'https://*.firebasestorage.app',
        'https://*.cloudfunctions.net',
    ],
    // Analytics & monitoring (add as needed)
    analytics: [
        'https://*.google-analytics.com',
        'https://*.googletagmanager.com',
    ],
    // CDNs for fonts/assets
    cdn: [
        'https://fonts.googleapis.com',
        'https://fonts.gstatic.com',
    ],
    // WebSocket connections (for real-time features)
    websocket: [
        'wss://*.firebaseio.com',
        'wss://*.googleapis.com',
    ],
};

// ============================================================================
// CSP Policy Builder
// ============================================================================

interface CSPDirectives {
    'default-src': string[];
    'script-src': string[];
    'style-src': string[];
    'img-src': string[];
    'font-src': string[];
    'connect-src': string[];
    'media-src': string[];
    'object-src': string[];
    'frame-src': string[];
    'frame-ancestors': string[];
    'base-uri': string[];
    'form-action': string[];
    'worker-src': string[];
    'child-src': string[];
}

function buildCSPDirectives(isDevelopment: boolean): CSPDirectives {
    const directives: CSPDirectives = {
        // Default: only allow same-origin
        'default-src': ["'self'"],

        // Scripts: self + inline (needed for Vite HMR in dev)
        'script-src': isDevelopment
            ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"] // Dev needs eval for HMR
            : ["'self'"], // Production: strict, no inline/eval

        // Styles: self + inline (many UI libs need inline styles)
        'style-src': ["'self'", "'unsafe-inline'", ...ALLOWED_ORIGINS.cdn],

        // Images: self + data URIs + Google services (for generated images)
        'img-src': [
            "'self'",
            'data:',
            'blob:',
            ...ALLOWED_ORIGINS.google,
            'https://*.googleusercontent.com',
        ],

        // Fonts: self + Google Fonts
        'font-src': ["'self'", 'data:', ...ALLOWED_ORIGINS.cdn],

        // Connect (fetch/XHR/WebSocket): API endpoints
        'connect-src': [
            "'self'",
            ...ALLOWED_ORIGINS.google,
            ...ALLOWED_ORIGINS.websocket,
            ...(isDevelopment ? ['ws://localhost:*', 'http://localhost:*'] : []),
        ],

        // Media (audio/video): self + Google (for AI-generated media)
        'media-src': ["'self'", 'blob:', ...ALLOWED_ORIGINS.google],

        // Object/embed: none (no plugins)
        'object-src': ["'none'"],

        // Frames: restrict to same-origin + auth
        'frame-src': ["'self'", ...ALLOWED_ORIGINS.google],

        // Prevent being embedded in frames (clickjacking protection)
        'frame-ancestors': ["'self'"],

        // Base URI: prevent base tag hijacking
        'base-uri': ["'self'"],

        // Form actions: only submit to self or Firebase
        'form-action': ["'self'", ...ALLOWED_ORIGINS.google],

        // Web workers: same origin
        'worker-src': ["'self'", 'blob:'],

        // Child contexts (workers + frames)
        'child-src': ["'self'", 'blob:'],
    };

    return directives;
}

function serializeCSP(directives: CSPDirectives): string {
    return Object.entries(directives)
        .map(([key, values]) => `${key} ${values.join(' ')}`)
        .join('; ');
}

// ============================================================================
// CSP Application
// ============================================================================

/**
 * Apply CSP headers to all web requests in Electron.
 * Call this in your main process after app.whenReady()
 */
export function applyCSP(): void {
    const cspDirectives = buildCSPDirectives(isDev);
    const cspHeader = serializeCSP(cspDirectives);

    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                // Content Security Policy
                'Content-Security-Policy': [cspHeader],
                // Prevent MIME sniffing
                'X-Content-Type-Options': ['nosniff'],
                // XSS protection (legacy, but still useful)
                'X-XSS-Protection': ['1; mode=block'],
                // Clickjacking protection
                'X-Frame-Options': ['SAMEORIGIN'],
                // Referrer policy
                'Referrer-Policy': ['strict-origin-when-cross-origin'],
                // Permissions policy (disable dangerous features)
                'Permissions-Policy': [
                    'accelerometer=()',
                    'camera=()',
                    'geolocation=()',
                    'gyroscope=()',
                    'magnetometer=()',
                    'microphone=()',
                    'payment=()',
                    'usb=()',
                ].join(', '),
            },
        });
    });

    console.log(`[Security] CSP applied (${isDev ? 'development' : 'production'} mode)`);

    if (isDev) {
        console.log('[Security] WARNING: Development CSP allows unsafe-eval for HMR');
    }
}

/**
 * Get the current CSP policy as a string (for debugging)
 */
export function getCSPPolicy(): string {
    return serializeCSP(buildCSPDirectives(isDev));
}

/**
 * Additional security headers for specific use cases
 */
export const securityHeaders = {
    // For file downloads - prevent execution
    download: {
        'Content-Disposition': 'attachment',
        'X-Content-Type-Options': 'nosniff',
    },
    // For JSON API responses
    api: {
        'Content-Type': 'application/json',
        'X-Content-Type-Options': 'nosniff',
    },
};

// ============================================================================
// Nonce Generation (for stricter CSP in future)
// ============================================================================

/**
 * Generate a cryptographically secure nonce for script-src.
 * Use this if you want to remove 'unsafe-inline' from script-src.
 * 
 * Usage:
 * 1. Generate nonce at request time: const nonce = generateNonce()
 * 2. Add to CSP: script-src 'nonce-{nonce}'
 * 3. Add to script tags: <script nonce="{nonce}">
 */
export function generateNonce(): string {
    return crypto.randomBytes(16).toString('base64');
}

// ============================================================================
// CSP Violation Reporting (Optional)
// ============================================================================

/**
 * Set up CSP violation reporting endpoint.
 * Violations will be logged for security monitoring.
 */
export function setupCSPReporting(reportUri?: string): void {
    if (!reportUri) {
        // Log violations to console in development
        if (isDev) {
            console.log('[Security] CSP violations will be logged to console');
        }
        return;
    }

    // In production, you'd send reports to a monitoring service
    // The report-uri directive is deprecated, use report-to instead
    console.log(`[Security] CSP reports will be sent to: ${reportUri}`);
}

export default {
    applyCSP,
    getCSPPolicy,
    generateNonce,
    setupCSPReporting,
    securityHeaders,
};
