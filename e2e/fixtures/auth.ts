import { test as base, Page } from "@playwright/test";

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
      onSubmitProgress: (
        cb: (data: { step: string; progress: number }) => void,
      ) => () => void;
    };
  };
  FIREBASE_E2E_MOCK: boolean;
  FIREBASE_USER_MOCK: {
    uid: string;
    email: string;
    displayName: string;
    isAnonymous: boolean;
    getIdToken: () => Promise<string>;
  };
}

export type AuthFixtures = {
  authedPage: Page;
};

export const test = base.extend<AuthFixtures>({
  authedPage: async ({ page }, use) => {
    // Log browser console messages to terminal for CI debugging
    page.on("console", (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (
        type === "error" ||
        text.includes("[E2E]") ||
        text.includes("[DEBUG]") ||
        text.includes("[DISTRO TEST]")
      ) {
        console.log(`[BROWSER ${type.toUpperCase()}] ${text}`);
      }
    });

    // Track failed/rejected requests to pinpoint 4xx/500 errors
    page.on("response", (response) => {
      if (response.status() >= 400) {
        console.log(
          `[BROWSER NETWORK ERROR] ${response.status()} on ${response.url()}`,
        );
      }
    });
    page.on("requestfailed", (request) => {
      console.log(
        `[BROWSER NETWORK FAILED] ${request.failure()?.errorText} on ${request.url()}`,
      );
    });

    const corsHeaders = {
      "Access-Control-Allow-Origin": "http://localhost:4242",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-version, X-HTTP-Session-Id, X-Goog-Api-Key, X-Goog-Api-Client, X-Firebase-Client",
    };

    // 🛡️ SAFETY CATCH-ALL: Block any remaining googleapis.com AND cloudfunctions.net traffic not caught below.
    // Playwright evaluates routes in reverse registration order.
    // By registering these FIRST, they have the LOWEST precedence, acting as a true catch-all fallback.
    await page.route("**/*.googleapis.com/**", async (route) => {
      const url = route.request().url();
      console.log(
        `[E2E] CATCH-ALL intercepted (googleapis): ${route.request().method()} ${url}`,
      );

      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }

      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });

    await page.route("**/*.cloudfunctions.net/**", async (route) => {
      const url = route.request().url();
      console.log(
        `[E2E] CATCH-ALL intercepted (cloudfunctions): ${route.request().method()} ${url}`,
      );

      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }

      if (url.includes("ragProxy") || url.includes("files?uploadType")) {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: "application/json",
          body: JSON.stringify({
            file: { name: "files/mock-file-123", state: "ACTIVE" },
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });

    // Intercept ALL Firestore traffic to prevent offline hangs.
    // This covers addDoc/updateDoc writes that block the submission pipeline.
    await page.route("**/firestore.googleapis.com/**", async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (method === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }

      // Handle Listen/WebChannel streams (long-polling)
      if (
        url.includes(":listen") ||
        url.includes("/Listen/") ||
        url.includes("channel?")
      ) {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: "application/json",
          body: "[]",
        });
        return;
      }

      // Mock User Profile reads
      if (url.includes("/users/test-user-uid-e2e")) {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: "application/json",
          body: JSON.stringify({
            name: "projects/mock-project/databases/(default)/documents/users/test-user-uid-e2e",
            fields: {
              uid: { stringValue: "test-user-uid-e2e" },
              displayName: { stringValue: "E2E User" },
              membershipTier: { stringValue: "pro" },
              onboardingCompleted: { booleanValue: true },
            },
          }),
        });
        return;
      }

      // Mock all collection reads → empty list
      if (method === "GET") {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: "application/json",
          body: JSON.stringify({ documents: [] }),
        });
        return;
      }

      // Mock all writes (addDoc/updateDoc/setDoc) → return a fake document reference.
      // This unblocks distributionService.createTask() and other Firestore writes
      // that would otherwise hang indefinitely in the offline CI environment.
      if (method === "POST" || method === "PATCH") {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: "application/json",
          body: JSON.stringify({
            name: `projects/mock-project/databases/(default)/documents/mock-collection/mock-doc-${Date.now()}`,
            fields: {},
            createTime: new Date().toISOString(),
            updateTime: new Date().toISOString(),
          }),
        });
        return;
      }

      // Fallthrough: block DELETE and other methods silently
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: "application/json",
        body: "{}",
      });
    });

    // Intercept AI API calls to prevent real token spend
    await page.route(
      /.*(firebasevertexai|generativelanguage)\.googleapis\.com.*/,
      async (route) => {
        const url = route.request().url();
        console.log(`[E2E] Intercepted Vertex AI: ${url}`);

        if (route.request().method() === "OPTIONS") {
          await route.fulfill({ status: 204, headers: corsHeaders });
          return;
        }

        const postData = route.request().postData() || "";
        const hasUpdateProfileTool = postData.includes("updateProfile");

        const parts: Array<{
          text?: string;
          functionCall?: Record<string, unknown>;
        }> = [
            {
              text: "Awesome! I've updated your brand kit with those details. You're ready to go!",
            },
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
                goals: ["Grow fanbase", "Get playlisted"],
              },
            },
          });
        }

        const aiResponseObj = {
          candidates: [
            {
              content: {
                role: "model",
                parts: parts,
              },
              finishReason: "STOP",
            },
          ],
        };

        if (url.includes("streamGenerateContent")) {
          // Ensure Server-Sent Events (SSE) payload formatting to unblock the client parser
          if (url.includes("alt=sse")) {
            await route.fulfill({
              status: 200,
              headers: corsHeaders,
              contentType: "text/event-stream",
              body: `data: ${JSON.stringify(aiResponseObj)}\n\n`,
            });
            return;
          } else {
            // Sometimes just a JSON array is expected for non-SSE streams in legacy Vertex
            await route.fulfill({
              status: 200,
              headers: corsHeaders,
              contentType: "application/json",
              body: JSON.stringify([aiResponseObj]),
            });
            return;
          }
        }

        // Normal generateContent
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: "application/json",
          body: JSON.stringify(aiResponseObj),
        });
      },
    );

    // Intercept ragProxy API calls to prevent 401s during E2E with mocked auth
    await page.route("**/*ragProxy*/**", async (route) => {
      const url = route.request().url();
      console.log(`[E2E] Intercepted RAG Proxy: ${url}`);

      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }

      if (url.includes("fileSearchStores")) {
        if (
          route.request().method() === "POST" &&
          !url.includes(":importFile")
        ) {
          await route.fulfill({
            status: 200,
            headers: corsHeaders,
            contentType: "application/json",
            body: JSON.stringify({ name: "fileSearchStores/mock-e2e-store" }),
          });
          return;
        }
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            headers: corsHeaders,
            contentType: "application/json",
            body: JSON.stringify({
              fileSearchStores: [
                {
                  name: "fileSearchStores/mock-e2e-store",
                  displayName: "indiiOS Default Store",
                },
              ],
            }),
          });
          return;
        }
      }

      if (url.includes("importFile")) {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: "application/json",
          body: JSON.stringify({ name: "operations/mock-op", done: true }),
        });
        return;
      }

      // Default success for others (e.g. generateContent)
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify({
          candidates: [
            {
              content: {
                role: "model",
                parts: [{ text: "Mock RAG Response" }],
              },
            },
          ],
        }),
      });
    });

    // Intercept Gemini API file uploads (which go to a different path sometimes)
    await page.route("**/*upload/v1beta/files*", async (route) => {
      console.log(`[E2E] Intercepted RAG Upload: ${route.request().url()}`);
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify({
          file: { name: "files/mock-file-123", state: "ACTIVE" },
        }),
      });
    });

    // Intercept Firebase Auth (Identity Toolkit) API — prevents real auth calls hanging in CI
    await page.route("**/identitytoolkit.googleapis.com/**", async (route) => {
      const url = route.request().url();
      console.log(`[E2E] Intercepted Identity Toolkit: ${url}`);

      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }

      // Mock signInWithPassword / signUp / lookup
      if (url.includes("signInWithPassword") || url.includes("signUp")) {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: "application/json",
          body: JSON.stringify({
            localId: "test-user-uid-e2e",
            email: "e2e@indiios.test",
            displayName: "E2E Test User",
            idToken: "mock-id-token-e2e",
            refreshToken: "mock-refresh-token-e2e",
            expiresIn: "3600",
          }),
        });
        return;
      }

      // Mock getAccountInfo (lookup)
      if (url.includes("getAccountInfo") || url.includes("lookup")) {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: "application/json",
          body: JSON.stringify({
            users: [
              {
                localId: "test-user-uid-e2e",
                email: "e2e@indiios.test",
                displayName: "E2E Test User",
                emailVerified: true,
              },
            ],
          }),
        });
        return;
      }

      // Default: return empty success for any other Identity Toolkit calls
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });

    // Intercept Secure Token API — prevents token refresh hangs
    await page.route("**/securetoken.googleapis.com/**", async (route) => {
      console.log(`[E2E] Intercepted Secure Token: ${route.request().url()}`);

      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }

      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "mock-access-token-e2e",
          expires_in: "3600",
          token_type: "Bearer",
          refresh_token: "mock-refresh-token-e2e",
          id_token: "mock-id-token-e2e",
          user_id: "test-user-uid-e2e",
          project_id: "mock-project",
        }),
      });
    });

    // Intercept FCM Registrations API — prevents messaging registration hangs
    await page.route("**/fcmregistrations.googleapis.com/**", async (route) => {
      console.log(
        `[E2E] Intercepted FCM Registrations: ${route.request().url()}`,
      );

      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }

      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify({ token: "mock-fcm-token-e2e" }),
      });
    });

    // Intercept Firebase Analytics / App Check APIs — prevents telemetry hangs
    await page.route("**/firebaselogging.googleapis.com/**", async (route) => {
      await route.fulfill({ status: 200, headers: corsHeaders, body: "{}" });
    });
    await page.route("**/firebase.googleapis.com/**", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify({ token: "mock-app-check-token", ttl: "3600s" }),
      });
    });

    // Intercept Firebase Installations API
    await page.route("**/*installations.googleapis.com/**", async (route) => {
      console.log(
        `[E2E] Intercepted Installations API: ${route.request().url()}`,
      );
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify({
          name: "projects/mock-project/installations/mock-installation",
          fid: "mock-installation-id",
          refreshToken: "mock-refresh-token",
          authToken: {
            token: "mock-auth-token",
            expiresIn: "604800s",
          },
        }),
      });
    });

    // Inject Mocks BEFORE navigation using a typed cast to avoid `any`
    await page.addInitScript(() => {
      const w = window as unknown as E2EWindowGlobals;

      w.electronAPI = {
        getPlatform: () => Promise.resolve("darwin"),
        getAppVersion: () => Promise.resolve("0.1.0-e2e"),
        showNotification: () => { },
        selectFile: () => Promise.resolve("/tmp/mock-audio.wav"),
        audio: {
          analyze: () =>
            Promise.resolve({
              status: "success",
              streams: [{ sample_rate: "44100", bits_per_sample: 16 }],
            }),
        },
        credentials: {
          save: () => Promise.resolve(),
          get: () => Promise.resolve({}),
          delete: () => Promise.resolve(true),
        },
        sftp: {
          connect: () => Promise.resolve({ success: true }),
          disconnect: () => Promise.resolve(),
          isConnected: () => Promise.resolve(true),
          uploadDirectory: () => Promise.resolve({ success: true }),
        },
        distribution: {
          validateMetadata: () =>
            Promise.resolve({
              success: true,
              report: {
                valid: true,
                errors: [],
                warnings: [],
                summary: "Mock QC Pass",
              },
            }),
          generateISRC: () =>
            Promise.resolve({ success: true, isrc: "US-IND-24-00001" }),
          generateUPC: () =>
            Promise.resolve({ success: true, upc: "123456789012" }),
          generateDDEX: () =>
            Promise.resolve({ success: true, xml: "<DDEX/>" }),
          submitRelease: () =>
            Promise.resolve({
              success: true,
              report: { status: "COMPLETE", sftp_skipped: true },
            }),
          onSubmitProgress: (cb) => {
            setTimeout(() => cb({ step: "COMPLETE", progress: 100 }), 100);
            return () => { };
          },
        },
      };

      // Inject mocked Firebase Auth state
      w.FIREBASE_E2E_MOCK = true;
      w.FIREBASE_USER_MOCK = {
        uid: "test-user-uid-e2e",
        email: "e2e@indiios.test",
        displayName: "E2E Test User",
        isAnonymous: false,
        getIdToken: () => Promise.resolve("mock-id-token-e2e"),
      };

      // Signal FirestoreService to use E2E bypass (skips addDoc/updateDoc network calls)
      try {
        localStorage.setItem("FIREBASE_E2E_MOCK", "1");
        // Prevent onboarding wizard from hijacking navigation
        localStorage.setItem("onboarding_dismissed", "true");
        // Dismiss the first-run guided tour overlay
        localStorage.setItem("indiiOS_tour_completed_v1", "true");
        // Dismiss cookie consent banner so it doesn't overlay test targets
        // IMPORTANT: Must match ConsentPreferences interface exactly (requires version >= 1)
        localStorage.setItem("indiiOS_cookie_consent", JSON.stringify({
          essential: true,
          analytics: false,
          errorTracking: false,
          marketing: false,
          timestamp: new Date().toISOString(),
          version: 1,
        }));
        // Pre-populate distributor connections so fetchDistributors() skips real network calls.
        // This prevents the 60s+ timeout from 4 distributors × 3 retry attempts.
        localStorage.setItem("E2E_DISTRIBUTOR_CONNECTIONS", JSON.stringify([
          { distributorId: "distrokid", isConnected: false, features: { canCreateRelease: true, canUpdateRelease: true, canTakedown: true, canFetchEarnings: true, canFetchAnalytics: true } },
          { distributorId: "tunecore", isConnected: false, features: { canCreateRelease: true, canUpdateRelease: true, canTakedown: true, canFetchEarnings: true, canFetchAnalytics: true } },
          { distributorId: "cdbaby", isConnected: false, features: { canCreateRelease: true, canUpdateRelease: true, canTakedown: true, canFetchEarnings: true, canFetchAnalytics: true } },
          { distributorId: "symphonic", isConnected: false, features: { canCreateRelease: true, canUpdateRelease: true, canTakedown: true, canFetchEarnings: true, canFetchAnalytics: true } },
        ]));
      } catch (e) {
        // Ignore if localStorage is unavailable
      }

    });

    await page.goto("/");

    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
  },
});

export { expect } from "@playwright/test";
