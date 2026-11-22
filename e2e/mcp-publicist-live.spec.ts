/**
 * Genuine check of the Publicist's remote MCP tool on production (ISSUE-1691).
 *
 * Runs only on demand against https://indii.music with a real account signed in
 * through the visible UI (.agent/REAL_USER_AUTHENTICITY.md). It uses no auth
 * fixture, route interception, judge overrides or store writes: the request goes
 * through the deployed MCP gateway (Arcjet, entitlement checks) and the real
 * `generate_playlist_pitch` tool, which makes a paid Vertex call.
 *
 * Run:
 *   PLAYWRIGHT_BASE_URL=https://indii.music PRODUCTION_SHA=<deployed sha> \
 *   E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... E2E_LIVE_RELEASE_ID=<a release you own> \
 *   npm run test:e2e:live -- e2e/mcp-publicist-live.spec.ts
 *
 * E2E_LIVE_RELEASE_ID is the id of a release saved through Distribution's
 * Submit Release (a `proprietaryIngestionReleases` record owned by the account;
 * on the web it is saved as `ready_for_desktop_delivery`). The MCP ownership
 * check accepts that store since ISSUE-1692.
 *
 * The legacy mock-backed specs (mcp-a2a-routing, mcp-boardroom-collaboration)
 * are tagged @external-legacy; this spec is the genuine coverage for that path.
 */
import { expect, test, type Response } from "@playwright/test";
import {
  requireProductionCredentials,
  requireProductionOrigin,
  signInThroughVisibleUi,
} from "./fixtures/liveProduction";

const liveReleaseId = process.env.E2E_LIVE_RELEASE_ID?.trim();

test.use({ trace: "off", screenshot: "off", video: "off" });

function requireLiveMcpConfiguration(): void {
  requireProductionOrigin();
  requireProductionCredentials();
  if (!liveReleaseId) {
    throw new Error(
      "The live MCP check requires E2E_LIVE_RELEASE_ID: the id of a release the signed-in account really owns.",
    );
  }
}

test.describe("@live Publicist MCP tool on production", () => {
  test.beforeEach(async ({ page }) => {
    requireLiveMcpConfiguration();
    await signInThroughVisibleUi(page);
  });

  test("the Publicist runs generate_playlist_pitch through the deployed MCP gateway", async ({
    page,
  }) => {
    test.setTimeout(300_000);

    // Observe (never intercept) the gateway's message leg.
    const gatewayResponses: { status: number; url: string }[] = [];
    page.on("response", (response: Response) => {
      const request = response.request();
      if (request.method() === "POST" && new URL(response.url()).pathname.endsWith("/mcpEndpoint/message")) {
        gatewayResponses.push({ status: response.status(), url: response.url() });
      }
    });

    await page.getByRole("button", { name: "Enter Boardroom" }).first().click(); // bypass-strict: the sidebar renders the entry in collapsed and expanded layouts
    await expect(page.getByTestId("boardroom-module")).toBeVisible({ timeout: 30_000 });

    const publicistSeat = page.getByTestId("boardroom-seat-publicist").first(); // bypass-strict: seat may render in table and drawer layouts
    await expect(publicistSeat).toBeVisible({ timeout: 30_000 });
    if ((await publicistSeat.getAttribute("aria-label"))?.includes("inactive")) {
      await publicistSeat.click();
    }

    const prompt = page.getByTestId("main-prompt-input");
    await prompt.fill(
      `Publicist: generate a playlist pitch for releaseId "${liveReleaseId}" targeting a playlist that fits it.`,
    );
    await prompt.press("Enter");

    const publicistMessage = page
      .locator('[data-agent-id="publicist"] .message-content')
      .last(); // bypass-strict: select the latest Publicist message in the thread
    await expect(publicistMessage).toContainText(
      "Executed remote tool: generate_playlist_pitch",
      { timeout: 240_000 },
    );
    await expect(publicistMessage).not.toContainText(/Step failed|BACKEND_UNAVAILABLE|Forbidden/);

    expect(gatewayResponses.length).toBeGreaterThan(0);
    for (const response of gatewayResponses) {
      expect(new URL(response.url).protocol).toBe("https:");
      expect(response.status).toBe(202);
    }
  });
});
