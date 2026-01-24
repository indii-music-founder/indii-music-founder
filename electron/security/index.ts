import { app, Session } from 'electron';

export function configureSecurity(session: Session) {
    // 1. CSP Hardening
    session.webRequest.onHeadersReceived((details, callback) => {
        const isDev = !app.isPackaged || process.env.VITE_DEV_SERVER_URL;

        // SECURITY: Use 'wasm-unsafe-eval' instead of 'unsafe-eval' in production
        // This allows WASM (needed for Essentia.js, PDF.js, Tesseract.js) but blocks JS eval()
        const scriptSrc = isDev
            ? "* 'unsafe-inline' 'unsafe-eval'"
            : "'self' 'wasm-unsafe-eval' https://apis.google.com https://*.firebaseapp.com https://cdn.jsdelivr.net";

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

    // 4. Certificate Verification
    // Trusts Google/Firebase domains via standard certificate verification.
    // NOTE: Certificate pinning for api.indii.os is disabled until the API is deployed.
    // When deploying a custom API, generate real certificate fingerprints using:
    //   openssl s_client -connect api.indii.os:443 | openssl x509 -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | base64

    session.setCertificateVerifyProc((request, callback) => {
        const { hostname, verificationResult } = request;

        // Allow localhost for development
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return callback(0);
        }

        // Trust Google/Firebase services with standard cert verification
        const trustedSuffixes = [
            '.googleapis.com',
            '.google.com',
            '.firebaseapp.com',
            '.googleusercontent.com',
            '.jsdelivr.net'  // For Tesseract.js language data
        ];

        if (trustedSuffixes.some(suffix => hostname.endsWith(suffix))) {
            return callback(verificationResult === 'net::OK' ? 0 : -2);
        }

        // Default: use standard certificate verification
        return callback(verificationResult === 'net::OK' ? 0 : -2);
    });

    // 5. Inject Referer for Firebase/Google APIs (Fixes "requests from referer empty blocked")
    session.webRequest.onBeforeSendHeaders(
        { urls: ['*://*.googleapis.com/*', '*://*.firebaseapp.com/*'] },
        (details, callback) => {
            const url = details.url;

            // Only inject Referer for Firestore and Storage which specifically require it
            // for security rules matching.
            if (
                url.includes('firestore.googleapis.com') ||
                url.includes('firebasestorage.googleapis.com')
            ) {
                details.requestHeaders['Referer'] = 'http://localhost:4242';
                callback({ requestHeaders: details.requestHeaders });
                return;
            }

            // Do NOT inject Referer for Identity Toolkit, Secure Token, or generic Google APIs
            // as this can trigger 'auth/invalid-credential' errors.
            callback({ requestHeaders: details.requestHeaders });
        }
    );
}
