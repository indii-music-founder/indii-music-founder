import { app, Session, session as electronSession } from 'electron';
import log from 'electron-log';

const FIREBASE_DESKTOP_REFERRER = 'https://indii.music/';
const FIREBASE_DESKTOP_ORIGIN = 'https://indii.music';

const STUDIO_DEVICE_PERMISSIONS = new Set(['camera', 'microphone', 'media', 'geolocation']);

function isTrustedStudioRenderer(webContents: Electron.WebContents | null): boolean {
    if (!webContents) return false;

    try {
        const rendererUrl = new URL(webContents.getURL());
        if (app.isPackaged) return rendererUrl.protocol === 'file:';
        return rendererUrl.protocol === 'http:'
            && (rendererUrl.hostname === 'localhost' || rendererUrl.hostname === '127.0.0.1');
    } catch {
        return false;
    }
}

// Item 375: Audit session cookies on startup for security flags
export async function auditSessionCookies(): Promise<void> {
    try {
        const cookies = await electronSession.defaultSession.cookies.get({});
        let insecureCount = 0;
        for (const cookie of cookies) {
            const issues: string[] = [];
            if (!cookie.httpOnly) issues.push('missing HttpOnly');
            if (!cookie.secure) issues.push('missing Secure');
            if (!cookie.sameSite || cookie.sameSite === 'no_restriction') issues.push('SameSite not Strict/Lax');
            if (issues.length > 0) {
                log.warn(`[Security][Cookie] ${cookie.domain}/${cookie.name}: ${issues.join(', ')}`);
                insecureCount++;
            }
        }
        log.info(`[Security][Cookie] Audit complete: ${cookies.length} total, ${insecureCount} with flag issues`);
    } catch (err) {
        log.error(`[Security][Cookie] Audit failed: ${err}`);
    }
}

export function configureSecurity(session: Session) {
    // CSP is applied by the dedicated applyCSP() module (single source of
    // truth). Registering a second onHeadersReceived here used to emit TWO
    // Content-Security-Policy headers per response — browsers enforce the
    // intersection, and the two policies had drifted, so legitimately allowed
    // directives (e.g. wasm-unsafe-eval for Essentia/PDF.js) could be
    // stripped by the other header. Only the non-duplicated hardening lives
    // here.
    session.webRequest.onHeadersReceived((details, callback) => {
        const responseHeaders: Record<string, string | string[]> = {
            ...details.responseHeaders,
            'Cross-Origin-Opener-Policy': ['same-origin-allow-popups'],
            'Cross-Origin-Embedder-Policy': ['unsafe-none']
        };

        const url = details?.url || '';
        const isGoogleOrFirebase = url.includes('.googleapis.com') ||
            url.includes('.firebaseapp.com') ||
            url.includes('.cloudfunctions.net') ||
            url.includes('.run.app') ||
            url.includes('localhost') ||
            url.includes('127.0.0.1');

        if (isGoogleOrFirebase) {
            // Delete existing access-control headers to prevent casing/collision issues
            for (const key of Object.keys(responseHeaders)) {
                if (key.toLowerCase().startsWith('access-control-')) {
                    delete (responseHeaders as Record<string, unknown>)[key];
                }
            }
            const initiator = (details as any).initiator;
            const allowedOrigin = (initiator && initiator !== 'null') ? initiator : 'null';
            responseHeaders['access-control-allow-origin'] = [allowedOrigin];
            responseHeaders['access-control-allow-credentials'] = ['true'];
            responseHeaders['access-control-allow-methods'] = ['GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD'];
            responseHeaders['access-control-allow-headers'] = ['*'];
            responseHeaders['access-control-expose-headers'] = ['*'];
            responseHeaders['access-control-max-age'] = ['86400'];
        }

        callback({ responseHeaders });
    });

    // 2. Permission Lockdown. Device access is available only to the packaged
    // Studio renderer (or its localhost development renderer), never to an
    // arbitrary webContents sharing the session.
    session.setPermissionRequestHandler((webContents, permission, callback) => {
        if (STUDIO_DEVICE_PERMISSIONS.has(permission) && isTrustedStudioRenderer(webContents)) {
            callback(true);
        } else {
            console.warn(`[Security] Blocked permission request: ${permission}`);
            callback(false);
        }
    });

    // 3. Apply the same trust decision to synchronous permission checks.
    session.setPermissionCheckHandler((webContents, permission) => {
        const allowed = STUDIO_DEVICE_PERMISSIONS.has(permission)
            && isTrustedStudioRenderer(webContents);
        if (!allowed) console.warn(`[Security] Blocked permission check: ${permission}`);
        return allowed;
    });

    // 4. Certificate Verification
    // Trusts Google/Firebase domains via standard certificate verification.
    // NOTE: Certificate pinning for api.indii.music is disabled until the API is deployed.
    // When deploying a custom API, generate real certificate fingerprints using:
    //   openssl s_client -connect api.indii.music:443 | openssl x509 -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | base64

    session.setCertificateVerifyProc((request, callback) => {
        const { hostname, verificationResult } = request;

        // Allow localhost for development
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return callback(0);
        }

        const isCertValid =
            verificationResult === 'net::OK' ||
            verificationResult === 'OK' ||
            (verificationResult as unknown) === 0 ||
            verificationResult === '0';

        // Trust Google/Firebase services with standard cert verification
        const trustedSuffixes = [
            '.googleapis.com',
            '.google.com',
            '.firebaseapp.com',
            '.googleusercontent.com',
            '.jsdelivr.net'  // For Tesseract.js language data
        ];

        if (trustedSuffixes.some(suffix => hostname.endsWith(suffix))) {
            return callback(isCertValid ? 0 : -2);
        }

        // Default: use standard certificate verification
        return callback(isCertValid ? 0 : -2);
    });

    // 5. Identify the Electron Studio to Firebase/Google APIs and Cloud Functions.
    session.webRequest.onBeforeSendHeaders(
        { urls: [
            '*://*.googleapis.com/*',
            '*://*.firebaseapp.com/*',
            '*://*.cloudfunctions.net/*',
            '*://*.run.app/*',
            'http://127.0.0.1:*/*',
            'http://localhost:*/*'
        ] },
        (details, callback) => {
            // Firebase's web API key rejects Electron's empty file:// referrer or null origin.
            // Identify the native Studio with its canonical product origin; the
            // Founder marketing origin is a separate site and must never be used
            // as the desktop application's Firebase identity.
            details.requestHeaders['Referer'] = FIREBASE_DESKTOP_REFERRER;
            details.requestHeaders['Origin'] = FIREBASE_DESKTOP_ORIGIN;
            
            // Inject client type to bypass App Check for desktop in production
            details.requestHeaders['X-App-Client-Type'] = 'electron-desktop-app';
            
            callback({ requestHeaders: details.requestHeaders });
        }
    );

    // 6. Network Diagnostics Monitoring
    session.webRequest.onErrorOccurred?.({ urls: ['*://*/*'] }, (details) => {
        const url = details?.url || '';
        if (url.includes('googleapis.com') || url.includes('cloudfunctions.net') || url.includes('firebaseapp.com') || url.includes('run.app')) {
            log.error(`[WebRequest ERROR] ${details.method} ${details.url} -> ${details.error} (initiator: ${(details as any).initiator})`);
        }
    });

    session.webRequest.onCompleted?.({ urls: ['*://*/*'] }, (details) => {
        const url = details?.url || '';
        if (url.includes('securetoken.googleapis.com') || url.includes('mintElectronAppCheckToken') || url.includes('generateContentStream')) {
            log.info(`[WebRequest OK] ${details.statusCode} ${details.method} ${details.url}`);
        }
    });
}
