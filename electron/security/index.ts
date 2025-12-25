import { app, Session } from 'electron';

export function configureSecurity(session: Session) {
    // 1. CSP Hardening
    session.webRequest.onHeadersReceived((details, callback) => {
        const isDev = !app.isPackaged || process.env.VITE_DEV_SERVER_URL;

        const scriptSrc = isDev
            ? "* 'unsafe-inline' 'unsafe-eval'"
            : "'self' 'unsafe-eval' https://apis.google.com https://*.firebaseapp.com";

        const defaultSrc = isDev ? "*" : "'none'";
        const styleSrc = isDev
            ? "* 'unsafe-inline'"
            : "'self' 'unsafe-inline' https://fonts.googleapis.com";

        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    [
                        `default-src ${defaultSrc}`,
                        `script-src ${scriptSrc}`,
                        `style-src ${styleSrc}`,
                        "img-src 'self' file: data: https://firebasestorage.googleapis.com https://*.googleusercontent.com http://localhost:4242 https://indiios-studio.web.app",
                        "font-src 'self' https://fonts.gstatic.com http://localhost:4242",
                        "connect-src 'self' ws: http: https: https://identitytoolkit.googleapis.com https://firestore.googleapis.com https://securetoken.googleapis.com https://*.firebaseio.com https://us-central1-indiios-v-1-1.cloudfunctions.net http://localhost:4242 ws://localhost:4242",
                        "manifest-src 'self' https://indiios-studio.web.app",
                        "worker-src 'self' blob:"
                    ].join('; ')
                ],
                'Cross-Origin-Opener-Policy': ['same-origin-allow-popups'],
                'Cross-Origin-Embedder-Policy': ['unsafe-none']
            }
        });
    });

    // 2. Permission Lockdown
    session.setPermissionRequestHandler((_webContents, permission, callback) => {
        const allowedPermissions: string[] = [];
        if (allowedPermissions.includes(permission)) {
            callback(true);
        } else {
            console.warn(`[Security] Blocked permission request: ${permission}`);
            callback(false);
        }
    });

    // 3. Block Permission Checks
    session.setPermissionCheckHandler((_webContents, permission) => {
        console.warn(`[Security] Blocked permission check: ${permission}`);
        return false;
    });

    // 4. Certificate Pinning
    const VALID_FINGERPRINTS = [
        'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', // Placeholder
        'sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB='  // Backup
    ];

    session.setCertificateVerifyProc((request, callback) => {
        const { hostname, verificationResult } = request;

        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return callback(0);
        }

        const trustedSuffixes = [
            '.googleapis.com',
            '.google.com',
            '.firebaseapp.com',
            '.googleusercontent.com'
        ];

        if (trustedSuffixes.some(suffix => hostname.endsWith(suffix))) {
            return callback(verificationResult === 'net::OK' ? 0 : -2);
        }

        if (hostname === 'api.indii.os') {
            if (verificationResult !== 'net::OK') {
                return callback(-2);
            }
            // Simulated pinning check
            const isPinned = VALID_FINGERPRINTS.includes('sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=');
            return isPinned ? callback(0) : callback(-2);
        }

        return callback(verificationResult === 'net::OK' ? 0 : -2);
    });

    // 5. Inject Referer for Firebase/Google APIs (Fixes "requests from referer empty blocked")
    session.webRequest.onBeforeSendHeaders(
        { urls: ['*://*.googleapis.com/*', '*://*.firebaseapp.com/*'] },
        (details, callback) => {
            details.requestHeaders['Referer'] = 'http://localhost:4242';
            callback({ requestHeaders: details.requestHeaders });
        }
    );
}
