import { test, expect } from '@playwright/test';
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { setupE2EPage } from './fixtures/auth';

/**
 * Cross-Device Persistence QA Suite
 *
 * Tests real, verified behavior for the persistence roadmap:
 * - ISSUE-761: Notes cloud sync
 * - ISSUE-756: Session pagination (no artificial 50-cap in the render layer)
 * - ISSUE-755: Conversation durability (survive Boardroom exit/re-entry, reload)
 * - ISSUE-757: Memory recall (prior conversation content reaches the model's context)
 *
 * Every selector below was checked against real component source, not invented — and
 * this file was actually run against a live dev server while writing it (see git log),
 * which caught two wrong assumptions from static reading alone (kept here as a record):
 *   - Sidebar.tsx:67       data-testid={`nav-item-${item.id}`} — 'notes' is a real ModuleId (constants.ts)
 *   - Sidebar.tsx:214      the whole desktop sidebar is `hidden md:flex` (hidden below 768px)
 *   - Sidebar.tsx:288      aria-label="Enter Boardroom" toggles conversationMode
 *   - BoardroomModule.tsx:106  data-testid="boardroom-module"
 *   - PromptArea.tsx:412,612  data-testid="main-prompt-input" / "command-bar-run-btn" — both
 *                          strict-mode-violate once resolved to >1 element: "main-prompt-input"
 *                          is ALSO reused on EntryOverlay.tsx:167 (a dashboard-only welcome
 *                          banner), and <PromptArea> itself is mounted in more than one place
 *                          at once (CommandBar.tsx's persistent bottom bar stays mounted behind
 *                          BoardroomConversationPanel.tsx's own copy while Boardroom's overlay
 *                          is open) — so both locators are scoped with the `:visible`
 *                          pseudo-class below to disambiguate. Discovered live, not assumed.
 *   - App.tsx:31-46        isRemoteSurfaceDevice/isStudioExecutorSurface force phone-class
 *                          viewports (isAnyPhone) to MobileRemote.tsx's pairing screen —
 *                          discovered live; the original assumption that MobileTabBar
 *                          renders on phone under this harness was WRONG (App.tsx redirects
 *                          before it would mount at all).
 *   - NotesModule.tsx      opening this module used to throw "Maximum update depth exceeded"
 *                          on mount (unstable useStore selector, no useShallow) — discovered
 *                          live, logged and fixed as ISSUE-1047 (NotesModule.tsx now wraps
 *                          its selector in useShallow), re-verified passing below.
 *   - ConversationHistoryList.tsx:406  exact button text "Load More Sessions"
 *   - notesSlice.ts / agentSessionSlice.ts  real store actions (addNote, createSession, window.useStore)
 *
 * IMPORTANT — what this suite does NOT claim to test:
 * Firestore traffic is intercepted per-page by e2e/fixtures/auth.ts's page.route mocks and answered
 * with static synthetic data. Two independent Playwright BrowserContexts (simulating phone + iPad)
 * each get their OWN independent set of these mocks — there is no shared backend between them.
 * Firestore's web SDK is additionally configured with `experimentalForceLongPolling: true`
 * (packages/renderer/src/services/firebase.ts), so real writes/reads go over a proprietary
 * long-polling WebChannel, not simple discrete REST calls — not something a route mock can
 * feasibly decode and re-serve as a shared fake backend. So genuine "device A writes, device B
 * reads" propagation is NOT observable under this harness. Those assertions are marked
 * test.skip() with the reason inline, rather than asserted as if they were verified.
 */

test.describe('Cross-Device Persistence (ISSUE-755/756/757/761)', () => {
  let browser: Browser;
  let phoneContext: BrowserContext;
  let tabletContext: BrowserContext;
  let phonePage: Page;
  let tabletPage: Page;

  test.beforeAll(async () => {
    browser = await chromium.launch();

    // Phone: 390x844 (iPhone-class, well under useMobile.ts's 640px isAnyPhone ceiling)
    phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    // Tablet: 768x1024 (iPad-class — exactly at Tailwind's `md:` breakpoint, so the
    // desktop Sidebar in Sidebar.tsx:214 (`hidden md:flex`) renders here)
    tabletContext = await browser.newContext({ viewport: { width: 768, height: 1024 } });

    phonePage = await phoneContext.newPage();
    tabletPage = await tabletContext.newPage();

    // Apply the full E2E mock harness independently to each context's page.
    await setupE2EPage(phonePage);
    await setupE2EPage(tabletPage);
  });

  test.afterAll(async () => {
    await phoneContext.close();
    await tabletContext.close();
    await browser.close();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Real, verified architecture (not a bug): phone-class viewports never reach
  // the Studio at all. App.tsx:31-46 (isRemoteSurfaceDevice /
  // isStudioExecutorSurface) forces `currentModule = 'mobile-remote'` whenever
  // `isAnyPhone` is true, rendering MobileRemote.tsx's "Studio Disconnected"
  // pairing screen instead — by design ("The Controller is a command
  // producer, never a Studio executor" — App.tsx:38). Confirmed by actually
  // running this test: the original assumption (MobileTabBar renders with a
  // 'More' drawer) was wrong — that component never mounts on phone widths
  // under this harness because App.tsx redirects before it would.
  // ─────────────────────────────────────────────────────────────────────────

  test('Phone-class viewport is routed to the Remote Controller pairing screen, not Notes/Boardroom', async () => {
    await expect(phonePage.getByRole('heading', { name: 'Studio Disconnected' })).toBeVisible();
    await expect(phonePage.getByRole('button', { name: 'Show Pairing Code' })).toBeVisible();
    await expect(phonePage.getByRole('button', { name: 'Try Reconnecting Now' })).toBeVisible();

    // Neither the desktop Sidebar nor any Notes/Boardroom surface is reachable from here.
    await expect(phonePage.getByTestId('nav-item-notes')).toHaveCount(0);
    await expect(phonePage.getByTestId('boardroom-module')).toHaveCount(0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ISSUE-761: Notes
  // ─────────────────────────────────────────────────────────────────────────

  test.describe('ISSUE-761: Notes', () => {
    test('opening Notes and creating a note updates the tablet\'s own notes list (ISSUE-1047 fixed)', async () => {
      // NotesModule.tsx:7 used to call useStore(state => ({...})) with a plain
      // object-literal selector — no useShallow — which handed useSyncExternalStore
      // a brand-new object every render ("getSnapshot should be cached" warning) and
      // escalated to "Maximum update depth exceeded", crashing the module on mount
      // (caught previously by this exact test; logged as ISSUE-1047). Fixed by
      // wrapping the selector in useShallow, matching the pattern this repo's own
      // CLAUDE.md documents and every other slice-consuming module already follows
      // (ConversationHistoryList.tsx, BoardroomModule.tsx, RightPanel.tsx).
      try {
        await tabletPage.getByTestId('nav-item-notes').click();

        // NotesModule.tsx has no data-testid on the "new note" button (icon-only, no
        // accessible name) — select it structurally via its real sibling relationship
        // to the "Notes" heading (NotesModule.tsx:56-63), not an invented testid.
        const notesHeader = tabletPage.getByRole('heading', { name: 'Notes' }).locator('..');
        await notesHeader.getByRole('button').click();

        // A new note defaults to title "Untitled Note" (NotesModule.tsx:39) and becomes
        // the active note, exposing the real title input (placeholder="Note Title").
        const titleInput = tabletPage.getByPlaceholder('Note Title');
        await expect(titleInput).toBeVisible({ timeout: 5_000 });
        await titleInput.fill('Tablet Test Note');

        const contentArea = tabletPage.getByPlaceholder('Start typing...');
        await contentArea.fill('Written from the tablet context.');

        // No Save button exists — NotesModule persists via onChange (updateNote on
        // every keystroke). The sidebar list reflects the new title with no save step.
        await expect(tabletPage.getByRole('button', { name: /Tablet Test Note/ })).toBeVisible();
      } finally {
        await tabletPage.getByTestId('return-hq-btn').click({ timeout: 5_000 }).catch(() => {});
      }
    });

    test.skip(
      'a note created on the phone appears on the tablet within 2s — NOT OBSERVABLE under this harness',
      async () => {
        // Real cross-device propagation requires a shared Firestore backend. Under the
        // mocked E2E harness, phoneContext and tabletContext each get independent,
        // static page.route responses (see file header) — there is no shared store for
        // a write on one to be read back on the other. Verifying this for real needs
        // the Firestore emulator wired into playwright.config.ts's webServer command
        // (today `npm run test:e2e:emulator` starts the emulator process but the shared
        // webServer command never sets VITE_USE_FUNCTIONS_EMULATOR=true, so even that
        // path doesn't currently connect the app to it — a separate infra gap).
      },
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ISSUE-756: Session list rendering (no artificial cap in the render layer)
  // ─────────────────────────────────────────────────────────────────────────

  test.describe('ISSUE-756: Session list', () => {
    test('60 locally-created sessions all render without a client-side truncation cap', async () => {
      // window.useStore is really exposed (core/store/index.ts:162) and createSession()
      // is a real action (agentSessionSlice.ts:104) — this seeds local Zustand state
      // directly, the same shortcut boardroom_test.spec.ts uses via window.useStore.
      //
      // Note: this does NOT exercise SessionService's cloud-side pagination cursor
      // (hasMoreSessions / loadMoreSessions fetch 50-at-a-time from Firestore via
      // getDocs — SessionService.ts:101,133,199); that fetch is answered by auth.ts's
      // static `:runQuery` mock (always `[]`), so the "Load More Sessions" button
      // (ConversationHistoryList.tsx:406, real text) never appears under the default
      // mock regardless of local session count. What IS verifiable here is that the
      // render layer itself (`Object.values(sessions)` in ConversationHistoryList) has
      // no separate hard-coded slice/truncation once sessions exist locally.
      //
      // Discovered live: RightPanel's outer <aside> is `hidden lg:flex`
      // (RightPanel.tsx:311) — Tailwind's `lg` breakpoint is 1024px, not the 768px
      // `md:` breakpoint that gates the Sidebar. At the tablet context's normal
      // 768px width the Archives panel exists in the DOM (isRightPanelOpen: true)
      // but renders with a 0×0 box (display:none via the unmatched `lg:flex`).
      // boardroom_test.spec.ts independently hit the same wall and works around it
      // by forcing `setViewportSize({width:1280,height:800})` before its scenario —
      // matching that precedent here rather than inventing a new workaround.
      await tabletPage.setViewportSize({ width: 1280, height: 800 });

      await tabletPage.evaluate(() => {
        for (let i = 0; i < 60; i++) {
          (window as any).useStore.getState().createSession(`Local Session ${i}`);
        }
      });

      // Open the session history panel: setRightPanelTab('agent') opens the panel
      // (appSlice.ts:342 sets isRightPanelOpen: true as a side effect), then the real
      // "Archives" tab (aria-label="View Archives", BoardroomModule... RightPanel.tsx)
      // switches to ConversationHistoryList.
      await tabletPage.evaluate(() => {
        (window as any).useStore.getState().setRightPanelTab('agent');
      });
      await tabletPage.getByLabel('View Archives').click();

      await expect(tabletPage.getByRole('button', { name: /Local Session 0$/ })).toBeVisible();
      await expect(tabletPage.getByRole('button', { name: /Local Session 59$/ })).toBeVisible();

      // Restore the real tablet width for tests that run after this one.
      await tabletPage.setViewportSize({ width: 768, height: 1024 });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ISSUE-755: Conversation durability
  // ─────────────────────────────────────────────────────────────────────────

  test.describe('ISSUE-755: Conversation durability', () => {
    test('message survives exiting and re-entering Boardroom in the same tab', async () => {
      await tabletPage.getByLabel('Enter Boardroom').click();
      await expect(tabletPage.getByTestId('boardroom-module')).toBeVisible({ timeout: 15_000 });

      await tabletPage.locator('[data-testid="main-prompt-input"]:visible').fill('Durability check message');
      await tabletPage.locator('[data-testid="command-bar-run-btn"]:visible').click();

      // The mocked generateContentStream route (auth.ts) always fulfills with a fixed
      // reply — we're not asserting on AI comprehension here, only that the user's own
      // message is retained in session state across a mode exit/re-entry.
      await expect(tabletPage.getByTestId('boardroom-module').getByText('Durability check message')).toBeVisible({ timeout: 10_000 });

      const sessionId = await tabletPage.evaluate(() => (window as any).useStore.getState().activeSessionId);
      expect(sessionId).toBeTruthy();

      // Exit Boardroom (Back to Studio), navigate elsewhere, then re-enter.
      // ('dashboard' isn't in the generic nav-item loop — Sidebar.tsx:228's
      // data-testid="return-hq-btn" is the real control that sets it. Also avoids
      // 'notes', which has a separate known crash — see the ISSUE-761 test above.)
      await tabletPage.getByLabel('Back to Studio').click();
      await expect(tabletPage.getByTestId('boardroom-module')).toBeHidden();
      await tabletPage.getByTestId('return-hq-btn').click();

      await tabletPage.getByLabel('Enter Boardroom').click();
      await expect(tabletPage.getByTestId('boardroom-module')).toBeVisible({ timeout: 15_000 });

      const sessionIdAfter = await tabletPage.evaluate(() => (window as any).useStore.getState().activeSessionId);
      expect(sessionIdAfter).toBe(sessionId);
      await expect(tabletPage.getByTestId('boardroom-module').getByText('Durability check message')).toBeVisible();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ISSUE-757: Memory recall — verify context reaches the model, not that the
  // (mocked) model "understands" it. The E2E harness fixes the AI's reply
  // regardless of input, so testing recall *accuracy* end-to-end isn't
  // meaningful here — testing that prior turns are included in the outgoing
  // request is the honest, verifiable substitute.
  // ─────────────────────────────────────────────────────────────────────────

  test.describe('ISSUE-757: Memory recall', () => {
    test('a follow-up prompt includes the earlier decision text in the request sent to the model', async () => {
      const capturedPayloads: string[] = [];
      await tabletPage.route(/generateContentStream|streamGenerateContent/, async (route) => {
        capturedPayloads.push(route.request().postData() || '');
        await route.fulfill({
          status: 200,
          headers: { 'Access-Control-Allow-Origin': '*' },
          contentType: 'application/json',
          body: JSON.stringify({
            candidates: [{ content: { role: 'model', parts: [{ text: 'Noted.' }] }, finishReason: 'STOP' }],
          }),
        });
      });

      if (!(await tabletPage.getByTestId('boardroom-module').isVisible().catch(() => false))) {
        await tabletPage.getByLabel('Enter Boardroom').click();
        await expect(tabletPage.getByTestId('boardroom-module')).toBeVisible({ timeout: 15_000 });
      }

      await tabletPage.locator('[data-testid="main-prompt-input"]:visible').fill('My artist name is Luna Synthwave');
      await tabletPage.locator('[data-testid="command-bar-run-btn"]:visible').click();
      await expect(tabletPage.getByTestId('boardroom-module').getByText('Noted.').first()).toBeVisible({ timeout: 10_000 });

      await tabletPage.locator('[data-testid="main-prompt-input"]:visible').fill('What is my artist name?');
      await tabletPage.locator('[data-testid="command-bar-run-btn"]:visible').click();
      await expect(tabletPage.getByTestId('boardroom-module').getByText('Noted.').nth(1)).toBeVisible({ timeout: 10_000 });

      const secondRequestOnward = capturedPayloads.slice(1).join('\n');
      expect(secondRequestOnward).toContain('Luna Synthwave');
    });
  });
});
