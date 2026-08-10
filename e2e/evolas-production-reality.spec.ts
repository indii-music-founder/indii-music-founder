import { expect, test, type Locator, type Page } from "@playwright/test";

const PRODUCTION_ORIGIN = "https://indii.music";
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
const productionCredentials =
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
const controlAttempts = Number(process.env.EVOLAS_CONTROL_MAX_ATTEMPTS ?? "12");
const telemetryAttempts = Number(
  process.env.EVOLAS_TELEMETRY_MAX_ATTEMPTS ?? "3",
);
const expectedProductionSha = process.env.PRODUCTION_SHA?.trim();
const invalidFaderCandidates = [
  process.env.EVOLAS_NATURALLY_INVALID_FADER_AGENT,
  "publicist",
  "legal",
  "music",
  "distribution",
  "finance",
  "producer",
  "publishing",
  "licensing",
  "rights",
].filter(
  (agentId, index, all): agentId is string =>
    Boolean(agentId) && all.indexOf(agentId) === index,
);

test.use({ trace: "off", screenshot: "off", video: "off" });

function requireProductionOrigin(): void {
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

function requireAuthenticatedProductionConfiguration(): void {
  requireProductionOrigin();
  if (!productionCredentials) {
    throw new Error(
      "Production-reality tests require a complete genuine credential pair in " +
        "E2E_TEST_EMAIL/E2E_TEST_PASSWORD or AUDITOR_EMAIL/AUDITOR_PASSWORD. " +
        "The test signs in through the visible UI; storage-state injection and auth fixtures are forbidden.",
    );
  }
  if (
    !Number.isInteger(controlAttempts) ||
    controlAttempts < 1 ||
    controlAttempts > 50
  ) {
    throw new Error(
      "EVOLAS_CONTROL_MAX_ATTEMPTS must be an integer from 1 through 50.",
    );
  }
  if (
    !Number.isInteger(telemetryAttempts) ||
    telemetryAttempts < 1 ||
    telemetryAttempts > 10
  ) {
    throw new Error(
      "EVOLAS_TELEMETRY_MAX_ATTEMPTS must be an integer from 1 through 10.",
    );
  }
}

async function signInThroughVisibleUi(page: Page): Promise<void> {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  const emailInput = page.getByLabel("email");
  if (await emailInput.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await emailInput.fill(productionCredentials!.email);
    await page.getByLabel("password").fill(productionCredentials!.password);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
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

async function openChatAndSelectDirectAgent(
  page: Page,
  agentId: string,
): Promise<void> {
  const omniAgent = page.getByRole("button", { name: "Omni Agent" });
  if (await omniAgent.isVisible().catch(() => false)) await omniAgent.click();

  await page.getByRole("button", { name: "Change Agent Mode" }).click();
  await page.getByTestId("agent-mode-direct").click();
  const agent = page.getByTestId(`agent-direct-${agentId}`);
  await agent.scrollIntoViewIfNeeded();
  await agent.click();
  await page.getByRole("button", { name: "Change Agent Mode" }).click();
  await expect(page.getByTestId("main-prompt-input")).toBeVisible();
}

async function openChatInAutomaticRoutingMode(page: Page): Promise<void> {
  const omniAgent = page.getByRole("button", { name: "Omni Agent" });
  if (await omniAgent.isVisible().catch(() => false)) await omniAgent.click();

  await page.getByRole("button", { name: "Change Agent Mode" }).click();
  await page.getByTestId("agent-mode-orchestrated").click();
  await page.getByRole("button", { name: "Change Agent Mode" }).click();
  await expect(page.getByTestId("main-prompt-input")).toBeVisible();
}

async function waitForSettledReceipt(receipt: Locator): Promise<void> {
  await expect(receipt).toHaveAttribute(
    "data-measurement-status",
    /recorded|failed/,
    { timeout: 120_000 },
  );
}

async function sendAndReadReceipt(
  page: Page,
  prompt: string,
): Promise<Locator> {
  const receipts = page.getByTestId("persona-response-actions");
  const previousResponseId = await receipts
    .last()
    .getAttribute("data-response-id")
    .catch(() => null);
  await page.getByTestId("main-prompt-input").fill(prompt);
  await page.getByTestId("command-bar-run-btn").click();
  await expect
    .poll(
      () =>
        receipts
          .last()
          .getAttribute("data-response-id")
          .catch(() => null),
      { timeout: 180_000 },
    )
    .not.toBe(previousResponseId);
  const receipt = receipts.last();
  await waitForSettledReceipt(receipt);
  return receipt;
}

async function reopenPersistedReceipt(
  page: Page,
  responseId: string,
): Promise<Locator> {
  await page.reload({ waitUntil: "domcontentloaded" });
  await signInThroughVisibleUi(page);
  const omniAgent = page.getByRole("button", { name: "Omni Agent" });
  if (await omniAgent.isVisible().catch(() => false)) await omniAgent.click();
  const receipt = page.locator(
    `[data-testid="persona-response-actions"][data-response-id="${responseId}"]`,
  );
  await expect(receipt).toBeVisible({ timeout: 60_000 });
  return receipt;
}

test.describe
  .serial("@live Evolas authenticated production-reality gate", () => {
  test.beforeEach(async ({ page }) => {
    requireAuthenticatedProductionConfiguration();
    await signInThroughVisibleUi(page);
  });

  test("a naturally selected control response reaches the displayed production receipt", async ({
    page,
  }) => {
    test.setTimeout(controlAttempts * 190_000);
    await openChatAndSelectDirectAgent(page, "publicist");

    let controlReceipt: Locator | undefined;
    for (let attempt = 1; attempt <= controlAttempts; attempt += 1) {
      const receipt = await sendAndReadReceipt(
        page,
        `EVOLAS-LIVE-CONTROL-${Date.now()}-${attempt}: Give one sentence of ethical press outreach advice. Do not use tools.`,
      );
      if ((await receipt.getAttribute("data-control-group")) === "true") {
        controlReceipt = receipt;
        break;
      }
    }

    expect(
      controlReceipt,
      `BLOCKED: no natural control assignment occurred in ${controlAttempts} genuine production responses.`,
    ).toBeDefined();
    const faders = JSON.parse(
      (await controlReceipt!.getAttribute("data-effective-faders")) ?? "{}",
    );
    const faderSource = await controlReceipt!.getAttribute("data-fader-source");
    expect(faderSource).toMatch(/^(saved|absent-default|invalid-default)$/);
    expect(new Set(Object.values(faders))).toEqual(new Set([50]));
    await expect(controlReceipt!).toHaveAttribute(
      "data-measurement-status",
      "recorded",
    );

    // The actual displayed action must write feedback for this exact
    // response before a reload proves the correlated receipt persisted.
    const responseId = await controlReceipt!.getAttribute("data-response-id");
    expect(responseId).toMatch(/^[A-Za-z0-9._:-]{1,128}$/);
    await controlReceipt!
      .getByRole("button", { name: "Copy response" })
      .click();
    await expect(controlReceipt!.getByRole("status")).toHaveText(
      "Feedback saved",
      { timeout: 30_000 },
    );

    const persistedReceipt = await reopenPersistedReceipt(page, responseId!);
    await expect(persistedReceipt).toHaveAttribute(
      "data-persona-id",
      "publicist",
    );
    await expect(persistedReceipt).toHaveAttribute(
      "data-control-group",
      "true",
    );
    await expect(persistedReceipt).toHaveAttribute(
      "data-measurement-status",
      "recorded",
    );
    await expect(persistedReceipt).toHaveAttribute(
      "data-fader-source",
      faderSource!,
    );
    expect(
      JSON.parse(
        (await persistedReceipt.getAttribute("data-effective-faders")) ?? "{}",
      ),
    ).toEqual(faders);
  });

  test("a naturally occurring invalid saved fader document resolves to validated defaults", async ({
    page,
  }) => {
    test.setTimeout(invalidFaderCandidates.length * 190_000);
    let invalidReceipt: Locator | undefined;
    let invalidAgentId: string | undefined;

    for (const agentId of invalidFaderCandidates) {
      await openChatAndSelectDirectAgent(page, agentId);
      const receipt = await sendAndReadReceipt(
        page,
        `EVOLAS-LIVE-INVALID-FADER-${Date.now()}-${agentId}: Give one concise advisory sentence. Do not use tools.`,
      );
      if (
        (await receipt.getAttribute("data-fader-source")) === "invalid-default"
      ) {
        invalidReceipt = receipt;
        invalidAgentId = agentId;
        break;
      }
    }

    expect(
      invalidReceipt,
      `BLOCKED: no naturally invalid saved fader document was observed across supported production personas (${invalidFaderCandidates.join(", ")}). No document was fabricated.`,
    ).toBeDefined();
    expect(invalidAgentId).toBeTruthy();
    const faders = JSON.parse(
      (await invalidReceipt!.getAttribute("data-effective-faders")) ?? "{}",
    );
    expect(new Set(Object.values(faders))).toEqual(new Set([50]));
  });

  test("a genuine telemetry outage preserves the displayed response and reports failure", async ({
    page,
  }) => {
    test.setTimeout(telemetryAttempts * 190_000);
    await openChatAndSelectDirectAgent(page, "publicist");

    let failedReceipt: Locator | undefined;
    for (let attempt = 1; attempt <= telemetryAttempts; attempt += 1) {
      const receipt = await sendAndReadReceipt(
        page,
        `EVOLAS-LIVE-TELEMETRY-${Date.now()}-${attempt}: Give one sentence of press advice. Do not use tools.`,
      );
      if (
        (await receipt.getAttribute("data-measurement-status")) === "failed"
      ) {
        failedReceipt = receipt;
        break;
      }
    }

    expect(
      failedReceipt,
      `BLOCKED: no genuine telemetry outage occurred during ${telemetryAttempts} production responses. Fault injection is forbidden.`,
    ).toBeDefined();
    await expect(
      failedReceipt!.getByRole("button", { name: "Copy response" }),
    ).toBeVisible();
  });

  test("the visible Conductor entrypoint produces an identifiable orchestrated single specialist", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await openChatInAutomaticRoutingMode(page);
    const receipt = await sendAndReadReceipt(
      page,
      `EVOLAS-LIVE-ORCHESTRATED-${Date.now()}: As the most relevant single specialist, give one practical press outreach priority. Do not use tools.`,
    );

    await expect(receipt).toHaveAttribute("data-persona-id", "publicist");
    await expect(receipt).toHaveAttribute(
      "data-measurement-status",
      "recorded",
    );
    expect(await receipt.getAttribute("data-response-id")).toMatch(
      /^[A-Za-z0-9._:-]{1,128}$/,
    );
  });
});

test.describe("@live Evolas unauthenticated production boundary", () => {
  test("unauthenticated users cannot reach the agent response path", async ({
    browser,
  }) => {
    requireProductionOrigin();
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

      await expect(page.getByLabel("email")).toBeVisible({ timeout: 30_000 });
      await expect(
        page.getByRole("button", { name: "Sign In", exact: true }),
      ).toBeVisible();
      await expect(page.getByTestId("main-prompt-input")).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
