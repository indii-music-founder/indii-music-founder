import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auditSessionCookies, configureSecurity } from './index';
import { app, session as electronSession, Session } from 'electron';
import log from 'electron-log';

vi.mock('electron', () => {
    const mockCookiesGet = vi.fn();
    return {
        app: {
            isPackaged: true,
        },
        session: {
            defaultSession: {
                cookies: {
                    get: mockCookiesGet
                }
            }
        }
    };
});

vi.mock('electron-log', () => {
    return {
        default: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        }
    };
});

describe('security/index.ts', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(app, 'isPackaged', { value: true, configurable: true });
        delete process.env.VITE_DEV_SERVER_URL;
    });

    describe('auditSessionCookies', () => {
        it('should successfully audit cookies and log info', async () => {
            const mockCookies = [
                { name: 'goodCookie', domain: 'example.com', httpOnly: true, secure: true, sameSite: 'strict' },
                { name: 'badCookie', domain: 'example.com', httpOnly: false, secure: false, sameSite: 'no_restriction' }
            ];
            vi.mocked(electronSession.defaultSession.cookies.get).mockResolvedValue(mockCookies as any);

            await auditSessionCookies();

            expect(electronSession.defaultSession.cookies.get).toHaveBeenCalledWith({});
            expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('missing HttpOnly, missing Secure, SameSite not Strict/Lax'));
            expect(log.info).toHaveBeenCalledWith(expect.stringContaining('Audit complete: 2 total, 1 with flag issues'));
        });

        it('should catch error and log it when cookies.get fails properly', async () => {
            const mockError = new Error('Test Error');
            vi.mocked(electronSession.defaultSession.cookies.get).mockRejectedValue(mockError);

            await auditSessionCookies();

            expect(log.error).toHaveBeenCalledWith(`[Security][Cookie] Audit failed: Error: Test Error`);
        });
    });

    describe('configureSecurity', () => {
        let mockSession: any;

        beforeEach(() => {
            mockSession = {
                webRequest: {
                    onHeadersReceived: vi.fn(),
                    onBeforeSendHeaders: vi.fn(),
                    onErrorOccurred: vi.fn(),
                    onCompleted: vi.fn(),
                },
                setPermissionRequestHandler: vi.fn(),
                setPermissionCheckHandler: vi.fn(),
                setCertificateVerifyProc: vi.fn(),
            };
        });

        it('should set up all security handlers', () => {
            configureSecurity(mockSession as unknown as Session);

            expect(mockSession.webRequest.onHeadersReceived).toHaveBeenCalled();
            expect(mockSession.setPermissionRequestHandler).toHaveBeenCalled();
            expect(mockSession.setPermissionCheckHandler).toHaveBeenCalled();
            expect(mockSession.setCertificateVerifyProc).toHaveBeenCalled();
            expect(mockSession.webRequest.onBeforeSendHeaders).toHaveBeenCalled();
            expect(mockSession.webRequest.onErrorOccurred).toHaveBeenCalled();
            expect(mockSession.webRequest.onCompleted).toHaveBeenCalled();
        });

        describe('Header Hardening (onHeadersReceived)', () => {
            // CSP is applied by the dedicated applyCSP() module — registering
            // it here too used to emit TWO Content-Security-Policy headers
            // per response (browsers enforce the intersection, so the two
            // drifted policies cancelled each other's allowances). This
            // handler now only carries the non-duplicated hardening.
            it('applies COOP/COEP without emitting a duplicate CSP header', () => {
                Object.defineProperty(app, 'isPackaged', { value: true, configurable: true });
                configureSecurity(mockSession as unknown as Session);

                const handler = mockSession.webRequest.onHeadersReceived.mock.calls[0][0];
                const callback = vi.fn();
                const details = { responseHeaders: { 'Some-Header': ['value'] } };

                handler(details, callback);

                expect(callback).toHaveBeenCalled();
                const response = callback.mock.calls[0][0];
                expect(response.responseHeaders['Cross-Origin-Opener-Policy']).toEqual(['same-origin-allow-popups']);
                expect(response.responseHeaders['Cross-Origin-Embedder-Policy']).toEqual(['unsafe-none']);
                expect(response.responseHeaders['Content-Security-Policy']).toBeUndefined();
                expect(response.responseHeaders['Some-Header']).toEqual(['value']);
            });

            it('injects explicit non-wildcard CORS headers for Google and Firebase endpoints', () => {
                configureSecurity(mockSession as unknown as Session);

                const handler = mockSession.webRequest.onHeadersReceived.mock.calls[0][0];
                const callback = vi.fn();
                const details = {
                    url: 'https://securetoken.googleapis.com/v1/token',
                    responseHeaders: {
                        'access-control-allow-origin': ['https://indii.music'],
                        'access-control-allow-headers': ['*', 'x-upstream-allowed'],
                        'access-control-expose-headers': ['*', 'x-upstream-exposed'],
                        'content-type': ['application/json']
                    }
                };

                handler(details, callback);

                expect(callback).toHaveBeenCalled();
                const response = callback.mock.calls[0][0];
                const allowHeaders = response.responseHeaders['access-control-allow-headers'][0].split(', ');
                const exposeHeaders = response.responseHeaders['access-control-expose-headers'][0].split(', ');

                expect(response.responseHeaders['access-control-allow-origin']).toEqual(['null']);
                expect(response.responseHeaders['access-control-allow-credentials']).toEqual(['true']);
                expect(response.responseHeaders['access-control-allow-methods'][0]).toContain('POST');
                expect(allowHeaders).not.toContain('*');
                expect(allowHeaders).toEqual(expect.arrayContaining([
                    'authorization',
                    'content-type',
                    'x-firebase-appcheck',
                    'x-goog-api-client',
                    'x-app-client-type',
                    'x-upstream-allowed',
                ]));
                expect(exposeHeaders).not.toContain('*');
                expect(exposeHeaders).toContain('x-upstream-exposed');
                expect(response.responseHeaders['content-type']).toEqual(['application/json']);
            });

            it('injects explicit CORS headers for Cloud Functions and Cloud Run endpoints', () => {
                configureSecurity(mockSession as unknown as Session);

                const handler = mockSession.webRequest.onHeadersReceived.mock.calls[0][0];
                const callback = vi.fn();
                const details = {
                    url: 'https://us-central1-indii-music-founder.cloudfunctions.net/mintElectronAppCheckToken',
                    responseHeaders: {
                        'access-control-allow-origin': ['https://indii.music']
                    }
                };

                handler(details, callback);

                expect(callback).toHaveBeenCalled();
                const response = callback.mock.calls[0][0];
                expect(response.responseHeaders['access-control-allow-origin']).toEqual(['null']);
                expect(response.responseHeaders['access-control-allow-credentials']).toEqual(['true']);
                expect(response.responseHeaders['access-control-allow-headers'][0]).not.toBe('*');
                expect(response.responseHeaders['access-control-allow-headers'][0]).toContain('authorization');
            });

            it('maps file:// initiator to null serialized origin for local Electron requests', () => {
                configureSecurity(mockSession as unknown as Session);

                const handler = mockSession.webRequest.onHeadersReceived.mock.calls[0][0];
                const callback = vi.fn();
                const details = {
                    url: 'https://securetoken.googleapis.com/v1/token',
                    initiator: 'file://',
                    responseHeaders: {
                        'access-control-allow-origin': ['https://indii.music']
                    }
                };

                handler(details, callback);

                expect(callback).toHaveBeenCalled();
                const response = callback.mock.calls[0][0];
                expect(response.responseHeaders['access-control-allow-origin']).toEqual(['null']);
                expect(response.responseHeaders['access-control-allow-credentials']).toEqual(['true']);
            });

            it('preserves http/https dev origin for localhost Electron requests', () => {
                configureSecurity(mockSession as unknown as Session);

                const handler = mockSession.webRequest.onHeadersReceived.mock.calls[0][0];
                const callback = vi.fn();
                const details = {
                    url: 'https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel',
                    initiator: 'http://localhost:4242',
                    responseHeaders: {}
                };

                handler(details, callback);

                expect(callback).toHaveBeenCalled();
                const response = callback.mock.calls[0][0];
                expect(response.responseHeaders['access-control-allow-origin']).toEqual(['http://localhost:4242']);
                expect(response.responseHeaders['access-control-allow-credentials']).toEqual(['true']);
            });

            it('echoes Access-Control-Request-Headers captured in onBeforeSendHeaders into onHeadersReceived', () => {
                configureSecurity(mockSession as unknown as Session);

                const beforeSendHandler = mockSession.webRequest.onBeforeSendHeaders.mock.calls[0][1];
                const headersReceivedHandler = mockSession.webRequest.onHeadersReceived.mock.calls[0][0];
                const sendCallback = vi.fn();
                const recvCallback = vi.fn();

                beforeSendHandler(
                    {
                        id: 42,
                        url: 'https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel',
                        requestHeaders: {
                            'Access-Control-Request-Headers': 'authorization, x-custom-firebase-header'
                        }
                    },
                    sendCallback,
                );

                headersReceivedHandler(
                    {
                        id: 42,
                        url: 'https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel',
                        initiator: 'file://',
                        responseHeaders: {}
                    },
                    recvCallback,
                );

                const response = recvCallback.mock.calls[0][0];
                const allowHeaders = response.responseHeaders['access-control-allow-headers'][0].split(', ');
                expect(allowHeaders).toContain('authorization');
                expect(allowHeaders).toContain('x-custom-firebase-header');
                expect(allowHeaders).not.toContain('*');
            });
        });

        describe('Permission Handlers', () => {
            it('should block permission requests from untrusted contents', () => {
                const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
                configureSecurity(mockSession as unknown as Session);

                const handler = mockSession.setPermissionRequestHandler.mock.calls[0][0];
                const callback = vi.fn();

                handler(null, 'camera', callback);

                expect(callback).toHaveBeenCalledWith(false);
                expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('[Security] Blocked permission request: camera'));

                consoleWarnSpy.mockRestore();
            });

            it('should allow device permissions for the packaged Studio renderer', () => {
                configureSecurity(mockSession as unknown as Session);

                const requestHandler = mockSession.setPermissionRequestHandler.mock.calls[0][0];
                const checkHandler = mockSession.setPermissionCheckHandler.mock.calls[0][0];
                const callback = vi.fn();
                const studioContents = { getURL: () => 'file:///Applications/indii/index.html' };

                requestHandler(studioContents, 'media', callback);

                expect(callback).toHaveBeenCalledWith(true);
                expect(checkHandler(studioContents, 'geolocation')).toBe(true);
            });

            it('should block permission checks from untrusted contents', () => {
                const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
                configureSecurity(mockSession as unknown as Session);

                const handler = mockSession.setPermissionCheckHandler.mock.calls[0][0];

                const result = handler(null, 'microphone');

                expect(result).toBe(false);
                expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('[Security] Blocked permission check: microphone'));

                consoleWarnSpy.mockRestore();
            });
        });

        describe('Certificate Verification', () => {
            it('should allow localhost', () => {
                configureSecurity(mockSession as unknown as Session);
                const handler = mockSession.setCertificateVerifyProc.mock.calls[0][0];
                const callback = vi.fn();

                handler({ hostname: 'localhost', verificationResult: 'net::ERR_CERT_INVALID' }, callback);
                expect(callback).toHaveBeenCalledWith(0);

                handler({ hostname: '127.0.0.1', verificationResult: 'net::ERR_CERT_INVALID' }, callback);
                expect(callback).toHaveBeenCalledWith(0);
            });

            it('should trust Google/Firebase domains on valid cert (net::OK, OK, 0)', () => {
                configureSecurity(mockSession as unknown as Session);
                const handler = mockSession.setCertificateVerifyProc.mock.calls[0][0];

                const domains = ['api.googleapis.com', 'google.com', 'app.firebaseapp.com', 'img.googleusercontent.com', 'cdn.jsdelivr.net'];

                for (const domain of domains) {
                    for (const validResult of ['net::OK', 'OK', 0]) {
                        const callback = vi.fn();
                        handler({ hostname: domain, verificationResult: validResult }, callback);
                        expect(callback).toHaveBeenCalledWith(0);
                    }
                }
            });

            it('should reject Google/Firebase domains on invalid cert', () => {
                configureSecurity(mockSession as unknown as Session);
                const handler = mockSession.setCertificateVerifyProc.mock.calls[0][0];
                const callback = vi.fn();

                handler({ hostname: 'api.googleapis.com', verificationResult: 'net::ERR_CERT_INVALID' }, callback);
                expect(callback).toHaveBeenCalledWith(-2);
            });

            it('should use standard verification for other domains', () => {
                configureSecurity(mockSession as unknown as Session);
                const handler = mockSession.setCertificateVerifyProc.mock.calls[0][0];

                const validCallback = vi.fn();
                handler({ hostname: 'example.com', verificationResult: 'net::OK' }, validCallback);
                expect(validCallback).toHaveBeenCalledWith(0);

                const invalidCallback = vi.fn();
                handler({ hostname: 'example.com', verificationResult: 'net::ERR_CERT_INVALID' }, invalidCallback);
                expect(invalidCallback).toHaveBeenCalledWith(-2);
            });
        });

        describe('onBeforeSendHeaders (Studio identity headers)', () => {
            it('uses the Studio origin, never the Founder marketing origin, for Firebase and Google requests', () => {
                configureSecurity(mockSession as unknown as Session);
                const handler = mockSession.webRequest.onBeforeSendHeaders.mock.calls[0][1];

                const urls = [
                    'https://firestore.googleapis.com/v1/projects/my-project/databases/(default)/documents',
                    'https://firebasestorage.googleapis.com/v0/b/my-bucket.appspot.com/o',
                    'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword',
                    'https://us-central1-indii-music-founder.cloudfunctions.net/generateContentStream',
                    'https://generateimagev3-run-app-subdomain.run.app',
                    'http://127.0.0.1:5001/indii-music-founder/us-central1/generateContentStream'
                ];

                for (const url of urls) {
                    const callback = vi.fn();
                    const details: { url: string; requestHeaders: Record<string, string> } = {
                        url,
                        requestHeaders: { 'User-Agent': 'test' }
                    };

                    handler(details, callback);

                    expect(callback).toHaveBeenCalledWith({
                        requestHeaders: {
                            'User-Agent': 'test',
                            'Referer': 'https://indii.music/',
                            'Origin': 'https://indii.music',
                            'X-App-Client-Type': 'electron-desktop-app'
                        }
                    });
                    expect(details.requestHeaders.Referer).not.toBe('https://founder.indii.music/');
                }
            });
        });
    });
});

describe('coverage test for allowed permission', () => {
    it('should allow permission for a localhost Studio renderer during development', () => {
        const mockSession = {
            webRequest: { onHeadersReceived: vi.fn(), onBeforeSendHeaders: vi.fn() },
            setPermissionRequestHandler: vi.fn(),
            setPermissionCheckHandler: vi.fn(),
            setCertificateVerifyProc: vi.fn()
        };
        Object.defineProperty(app, 'isPackaged', { value: false, configurable: true });
        configureSecurity(mockSession as unknown as Session);

        const handler = mockSession.setPermissionRequestHandler.mock.calls[0][0];
        const callback = vi.fn();

        handler({ getURL: () => 'http://localhost:4243/creative' }, 'camera', callback);

        expect(callback).toHaveBeenCalledWith(true);
    });
});
