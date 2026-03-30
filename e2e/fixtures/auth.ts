import { test as base, Page } from '@playwright/test';

/**
 * Auth fixture — bypasses Firebase auth for E2E tests using state injection.
 */

/** Typed shape of E2E-injected window globals to avoid `any` */
interface E2EWindowGlobals {
    electronAPI: {
        getPlatform: () => Promise<string>;
        getAppVersion: () => Promise<string>;
        showNotification: () => void;
        selectFile: () => Promise<string>;
        audio: { analyze: () => Promise<unknown> };
        credentials: {
            save: () => Promise<void>;
            get: () => Promise<Record<string, unknown>>;
            delete: () => Promise<boolean>;
        };
        sftp: {
            connect: () => Promise<{ success: boolean }>;
            disconnect: () => Promise<void>;
            isConnected: () => Promise<boolean>;
            uploadDirectory: () => Promise<{ success: boolean }>;
        };
        distribution: {
            validateMetadata: () => Promise<unknown>;
            generateISRC: () => Promise<unknown>;
            generateUPC: () => Promise<unknown>;
            generateDDEX: () => Promise<unknown>;
            submitRelease: () => Promise<unknown>;
            onSubmitProgress: (cb: (data: { step: string; progress: number }) => void) => () => void;
        };
    };
    FIREBASE_E2E_MOCK: boolean;
    FIREBASE_USER_MOCK: {
        uid: string;
        email: string;
        displayName: string;
        isAnonymous: boolean;
    };
}

export type AuthFixtures = {
    authedPage: Page;
};

export const test = base.extend<AuthFixtures>({
    authedPage: async ({ page }, use) => {
        // Log browser console messages to terminal for CI debugging
        page.on('console', msg => {
            const type = msg.type();
            const text = msg.text();
            if (type === 'error' || text.includes('[E2E]') || text.includes('[DEBUG]') || text.includes('[DISTRO TEST]')) {
                console.log(`[BROWSER ${type.toUpperCase()}] ${text}`);
            }
        });

        // Intercept ALL Firestore traffic to prevent offline hangs.
        // This covers addDoc/updateDoc writes that block the submission pipeline.
        await page.route('**/firestore.googleapis.com/**', async route => {
            const url = route.request().url();
            const method = route.request().method();

            // Handle Listen/WebChannel streams (long-polling)
            if (url.includes(':listen') || url.includes('/Listen/') || url.includes('channel?')) {
                await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
                return;
            }

            // Mock User Profile reads
            if (url.includes('/users/test-user-uid-e2e')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        name: 'projects/mock-project/databases/(default)/documents/users/test-user-uid-e2e',
                        fields: {
                            uid: { stringValue: 'test-user-uid-e2e' },
                            displayName: { stringValue: 'E2E User' },
                            membershipTier: { stringValue: 'pro' },
                            onboardingCompleted: { booleanValue: true }
                        }
                    })
                });
                return;
            }

            // Mock all collection reads → empty list
            if (method === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ documents: [] })
                });
                return;
            }

            // Mock all writes (addDoc/updateDoc/setDoc) → return a fake document reference.
            // This unblocks distributionService.createTask() and other Firestore writes
            // that would otherwise hang indefinitely in the offline CI environment.
            if (method === 'POST' || method === 'PATCH') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        name: `projects/mock-project/databases/(default)/documents/mock-collection/mock-doc-${Date.now()}`,
                        fields: {},
                        createTime: new Date().toISOString(),
                        updateTime: new Date().toISOString(),
                    })
                });
                return;
            }

            // Fallthrough: block DELETE and other methods silently
            await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        });

        // Intercept AI API calls to prevent real token spend
        await page.route(/.*(firebasevertexai|generativelanguage)\.googleapis\.com.*/, async route => {
            const url = route.request().url();
            console.log(`[E2E] Intercepted Vertex AI: ${url}`);

            const postData = route.request().postData() || '';
            const hasUpdateProfileTool = postData.includes('updateProfile');

            const parts: Array<{ text?: string; functionCall?: Record<string, unknown> }> = [
                { text: "Awesome! I've updated your brand kit with those details. You're ready to go!" }
            ];

            if (hasUpdateProfileTool) {
                parts.push({
                    functionCall: {
                        name: "updateProfile",
                        args: {
                            bio: "I am 22 and I make loud, distorted bubblegum bass music inspired by SOPHIE.",
                            colors: ["Neon Pink", "Black"],
                            social_instagram: "@glitched_official",
                            brand_description: "Loud, distorted bubblegum bass.",
                            career_stage: "Just starting out",
                            goals: ["Grow fanbase", "Get playlisted"]
                        }
                    }
                });
            }

            const aiResponseObj = {
                candidates: [{
                    content: {
                        role: "model",
                        parts: parts
                    },
                    finishReason: "STOP"
                }]
            };

            if (url.includes('streamGenerateContent')) {
                // Ensure Server-Sent Events (SSE) payload formatting to unblock the client parser
                if (url.includes('alt=sse')) {
                    await route.fulfill({
                        status: 200,
                        contentType: 'text/event-stream',
                        body: `data: ${JSON.stringify(aiResponseObj)}\n\n`
                    });
                    return;
                } else {
                    // Sometimes just a JSON array is expected for non-SSE streams in legacy Vertex
                    await route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify([aiResponseObj])
                    });
                    return;
                }
            }

            // Normal generateContent
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(aiResponseObj)
            });
        });

        // Intercept ragProxy API calls to prevent 401s during E2E with mocked auth
        await page.route('**/*ragProxy*/**', async route => {
            const url = route.request().url();
            console.log(`[E2E] Intercepted RAG Proxy: ${url}`);

            if (url.includes('fileSearchStores')) {
                if (route.request().method() === 'POST' && !url.includes(':importFile')) {
                    await route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({ name: 'fileSearchStores/mock-e2e-store' })
                    });
                    return;
                }
                if (route.request().method() === 'GET') {
                    await route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({ fileSearchStores: [{ name: 'fileSearchStores/mock-e2e-store', displayName: 'indiiOS Default Store' }] })
                    });
                    return;
                }
            }

            if (url.includes('importFile')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ name: 'operations/mock-op', done: true })
                });
                return;
            }

            // Default success for others (e.g. generateContent)
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    candidates: [{
                        content: { role: 'model', parts: [{ text: 'Mock RAG Response' }] }
                    }]
                })
            });
        });

        // Intercept Gemini API file uploads (which go to a different path sometimes)
        await page.route('**/*upload/v1beta/files*', async route => {
            console.log(`[E2E] Intercepted RAG Upload: ${route.request().url()}`);
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ file: { name: 'files/mock-file-123', state: 'ACTIVE' } })
            });
        });

        // Intercept Firebase Installations API
        await page.route('**/*installations.googleapis.com/**', async route => {
            console.log(`[E2E] Intercepted Installations API: ${route.request().url()}`);
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    name: 'projects/mock-project/installations/mock-installation',
                    fid: 'mock-installation-id',
                    refreshToken: 'mock-refresh-token',
                    authToken: {
                        token: 'mock-auth-token',
                        expiresIn: '604800s'
                    }
                })
            });
        });

        // Inject Mocks BEFORE navigation using a typed cast to avoid `any`
        await page.addInitScript(() => {
            const w = window as unknown as E2EWindowGlobals;

            w.electronAPI = {
                getPlatform: () => Promise.resolve('darwin'),
                getAppVersion: () => Promise.resolve('0.1.0-e2e'),
                showNotification: () => { },
                selectFile: () => Promise.resolve('/tmp/mock-audio.wav'),
                audio: { analyze: () => Promise.resolve({ status: 'success', streams: [{ sample_rate: '44100', bits_per_sample: 16 }] }) },
                credentials: {
                    save: () => Promise.resolve(),
                    get: () => Promise.resolve({}),
                    delete: () => Promise.resolve(true)
                },
                sftp: {
                    connect: () => Promise.resolve({ success: true }),
                    disconnect: () => Promise.resolve(),
                    isConnected: () => Promise.resolve(true),
                    uploadDirectory: () => Promise.resolve({ success: true })
                },
                distribution: {
                    validateMetadata: () => Promise.resolve({
                        success: true,
                        report: { valid: true, errors: [], warnings: [], summary: 'Mock QC Pass' }
                    }),
                    generateISRC: () => Promise.resolve({ success: true, isrc: 'US-IND-24-00001' }),
                    generateUPC: () => Promise.resolve({ success: true, upc: '123456789012' }),
                    generateDDEX: () => Promise.resolve({ success: true, xml: '<DDEX/>' }),
                    submitRelease: () => Promise.resolve({ success: true, report: { status: 'COMPLETE', sftp_skipped: true } }),
                    onSubmitProgress: (cb) => {
                        setTimeout(() => cb({ step: 'COMPLETE', progress: 100 }), 100);
                        return () => { };
                    }
                }
            };

            // Inject mocked Firebase Auth state
            w.FIREBASE_E2E_MOCK = true;
            w.FIREBASE_USER_MOCK = {
                uid: 'test-user-uid-e2e',
                email: 'e2e@indiios.test',
                displayName: 'E2E Test User',
                isAnonymous: false
            };

            // Signal FirestoreService to use E2E bypass (skips addDoc/updateDoc network calls)
            try {
                localStorage.setItem('FIREBASE_E2E_MOCK', '1');
            } catch (e) {
                // Ignore if localStorage is unavailable
            }

        });

        await page.goto('/');

        // eslint-disable-next-line react-hooks/rules-of-hooks
        await use(page);
    },
});

export { expect } from '@playwright/test';
