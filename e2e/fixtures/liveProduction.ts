/**
 * Shared helpers for genuine `@live` production checks (.agent/REAL_USER_AUTHENTICITY.md).
 *
 * These run only against https://indii.music, with a real account signed in
 * through the visible UI. No auth fixture, storage-state injection, route
 * interception or store writes may be combined with them.
 */
import { expect, type Page } from "@playwright/test";

export const PRODUCTION_ORIGIN = "https://indii.music";
export const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
export const expectedProductionSha = process.env.PRODUCTION_SHA?.trim();
export const productionCredentials =
  process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD
    ? {
        email: process.env.E2E_TEST_EMAIL,
        password: process.env.E2E_TEST_PASSWORD,
      }
    : process.env.AUDITOR_EMAIL && process.env.AUDITOR_PASSWORD
      ? {
          email: process.env.AUDITOR_EMAIL,
          password: process.env.AUDITOR_PASSWORD,
        }
      : undefined;

export function requireProductionOrigin(): void {
  if (!baseUrl || new URL(baseUrl).origin !== PRODUCTION_ORIGIN) {
    throw new Error(
      `Production-reality tests require PLAYWRIGHT_BASE_URL=${PRODUCTION_ORIGIN}.`,
    );
  }
  if (!expectedProductionSha || !/^[0-9a-f]{40}$/.test(expectedProductionSha)) {
    throw new Error(
      "Production-reality tests require the exact deployed 40-character PRODUCTION_SHA.",
    );
  }
}

export function requireProductionCredentials(): void {
  if (!productionCredentials) {
    throw new Error(
      "Production-reality tests require a complete genuine credential pair in " +
        "E2E_TEST_EMAIL/E2E_TEST_PASSWORD or AUDITOR_EMAIL/AUDITOR_PASSWORD. " +
        "The test signs in through the visible UI; storage-state injection and auth fixtures are forbidden.",
    );
  }
}

export async function signInThroughVisibleUi(page: Page): Promise<void> {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  const emailInput = page.getByLabel("email");
  if (await emailInput.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await emailInput.fill(productionCredentials!.email);
    await page.getByLabel("password").fill(productionCredentials!.password);
    await page
      .locator("form")
      .getByRole("button", { name: "Sign In", exact: true })
      .click();
  }

  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId("app-container")).toHaveAttribute(
    "data-build-sha",
    expectedProductionSha!,
  );
  const workspaceDialog = page.getByRole("dialog", { name: "Confirm" });
  if (await workspaceDialog.isVisible().catch(() => false)) {
    await workspaceDialog.getByRole("button", { name: "Cancel" }).click();
  }
}
