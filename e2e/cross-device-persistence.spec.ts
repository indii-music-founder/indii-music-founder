import { test, expect } from '@playwright/test';
import { chromium } from '@playwright/test';

/**
 * Cross-Device Persistence QA Suite
 *
 * Tests the 4-phase persistence roadmap:
 * - ISSUE-761: Notes cloud sync (phone ↔ iPad)
 * - ISSUE-756: Session pagination (load all conversations)
 * - ISSUE-755: Conversation durability (survive reload)
 * - ISSUE-757: Memory recall (no caps on agent context)
 *
 * Simulates two browsers as phone/iPad by:
 * 1. Creating shared Firestore DB reference
 * 2. Using same auth user for both browsers
 * 3. Verifying real-time sync across tabs
 */

test.describe('Cross-Device Persistence (ISSUE-755/756/757/761)', () => {
  let phoneContext: any;
  let ipadContext: any;
  let phonePage: any;
  let ipadPage: any;

  test.beforeAll(async () => {
    // Launch two independent browser contexts (simulating phone + iPad)
    const browser = await chromium.launch();
    phoneContext = await browser.newContext({ viewport: { width: 430, height: 932 } }); // iPhone
    ipadContext = await browser.newContext({ viewport: { width: 768, height: 1024 } }); // iPad

    phonePage = await phoneContext.newPage();
    ipadPage = await ipadContext.newPage();
  });

  test.afterAll(async () => {
    await phoneContext.close();
    await ipadContext.close();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ISSUE-761: Notes Cloud Sync
  // ─────────────────────────────────────────────────────────────────────────

  test('ISSUE-761: Create note on phone → see on iPad within 2s', async () => {
    // Phone: Navigate and create note
    await phonePage.goto('http://localhost:4242?module=notes');
    await phonePage.fill('input[placeholder*="Note title"]', 'Test Note from Phone');
    await phonePage.fill('textarea', 'This is a test note created on the phone device.');
    await phonePage.click('button:has-text("Save")');

    // Wait for Firestore sync
    await phonePage.waitForTimeout(500);

    // iPad: Navigate to notes, should see the new note immediately
    await ipadPage.goto('http://localhost:4242?module=notes');

    // Wait max 2s for Firestore listener to fire
    const noteTitle = await ipadPage.waitForSelector(
      'text=Test Note from Phone',
      { timeout: 2000 }
    );

    expect(noteTitle).toBeTruthy();
  });

  test('ISSUE-761: Edit note on phone → iPad reflects change within 2s', async () => {
    // Phone: Create and immediately edit
    await phonePage.goto('http://localhost:4242?module=notes');
    await phonePage.fill('input[placeholder*="Note title"]', 'Editable Note');
    await phonePage.fill('textarea', 'Original content');
    await phonePage.click('button:has-text("Save")');
    await phonePage.waitForTimeout(500);

    // Open the note and edit
    await phonePage.click('text=Editable Note');
    await phonePage.fill('textarea', 'Updated content from phone');
    await phonePage.click('button:has-text("Save")');

    // iPad: Open same note (already cached), should update
    await ipadPage.goto('http://localhost:4242?module=notes');
    await ipadPage.click('text=Editable Note');

    const updatedContent = await ipadPage.waitForSelector(
      'text=Updated content from phone',
      { timeout: 2000 }
    );

    expect(updatedContent).toBeTruthy();
  });

  test('ISSUE-761: Offline queueing — create note on phone offline, sync when online', async () => {
    // Phone: Go offline
    await phonePage.context().setOffline(true);

    // Create note while offline
    await phonePage.goto('http://localhost:4242?module=notes');
    await phonePage.fill('input[placeholder*="Note title"]', 'Offline Note');
    await phonePage.fill('textarea', 'Created while offline');
    await phonePage.click('button:has-text("Save")');

    // Verify toast: "Offline — will sync"
    const offlineToast = await phonePage.waitForSelector(
      'text=Offline',
      { timeout: 1000 }
    );
    expect(offlineToast).toBeTruthy();

    // Go back online
    await phonePage.context().setOffline(false);

    // Wait for retry + sync
    await phonePage.waitForTimeout(3000);

    // iPad should see the note
    await ipadPage.goto('http://localhost:4242?module=notes');
    const syncedNote = await ipadPage.waitForSelector(
      'text=Offline Note',
      { timeout: 2000 }
    );

    expect(syncedNote).toBeTruthy();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ISSUE-756: Session Pagination
  // ─────────────────────────────────────────────────────────────────────────

  test('ISSUE-756: Fresh iPad loads all sessions progressively (no 50-cap)', async () => {
    // Phone: Create 100 conversations (bulk create for test speed)
    await phonePage.goto('http://localhost:4242?module=boardroom');

    for (let i = 0; i < 100; i++) {
      // Use API directly to speed up (skip UI)
      await phonePage.evaluate((index) => {
        // Simulated bulk create via store action
        window.__store?.getState().createSession(`Conversation ${index}`, ['indii']);
      }, i);
    }

    await phonePage.waitForTimeout(5000); // Wait for all to Firestore

    // iPad: Fresh login, should load all 100 progressively
    const ipadBrowser = await chromium.launch();
    const freshIpadContext = await ipadBrowser.newContext({ viewport: { width: 768, height: 1024 } });
    const freshIpadPage = await freshIpadContext.newPage();

    await freshIpadPage.goto('http://localhost:4242?module=boardroom');

    // Initial load should have first 50
    await freshIpadPage.waitForTimeout(2000);
    let sessionCount = await freshIpadPage.locator('[data-test="session-item"]').count();
    expect(sessionCount).toBeGreaterThanOrEqual(50);

    // Click "Load More" button
    const loadMoreBtn = await freshIpadPage.locator('button:has-text("Load More Sessions")');
    if (await loadMoreBtn.isVisible()) {
      await loadMoreBtn.click();
      await freshIpadPage.waitForTimeout(2000);
    }

    // Should now have more than initial 50
    sessionCount = await freshIpadPage.locator('[data-test="session-item"]').count();
    expect(sessionCount).toBeGreaterThan(50);

    await freshIpadContext.close();
    await ipadBrowser.close();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ISSUE-755: Conversation Durability
  // ─────────────────────────────────────────────────────────────────────────

  test('ISSUE-755: Create conversation on phone → navigate → return → message persists', async () => {
    await phonePage.goto('http://localhost:4242?module=boardroom');

    // Create new conversation
    await phonePage.click('button:has-text("New Conversation")');
    const sessionId = await phonePage.inputValue('[data-test="session-id"]');

    // Add a message
    await phonePage.fill('[data-test="chat-input"]', 'Test durability message');
    await phonePage.click('button:has-text("Send")');

    // Navigate away
    await phonePage.goto('http://localhost:4242?module=notes');
    await phonePage.waitForTimeout(1000);

    // Navigate back
    await phonePage.goto('http://localhost:4242?module=boardroom');

    // Select the same session
    await phonePage.click(`[data-test="session-${sessionId}"]`);

    // Message should still be there
    const message = await phonePage.waitForSelector(
      'text=Test durability message',
      { timeout: 2000 }
    );

    expect(message).toBeTruthy();
  });

  test('ISSUE-755: Conversation survives full page reload', async () => {
    await phonePage.goto('http://localhost:4242?module=boardroom');

    // Create conversation
    await phonePage.click('button:has-text("New Conversation")');
    const sessionId = await phonePage.inputValue('[data-test="session-id"]');

    // Add messages
    for (let i = 0; i < 3; i++) {
      await phonePage.fill('[data-test="chat-input"]', `Message ${i}`);
      await phonePage.click('button:has-text("Send")');
      await phonePage.waitForTimeout(500);
    }

    const messagesBefore = await phonePage.locator('[data-test="chat-message"]').count();

    // Full page reload
    await phonePage.reload();
    await phonePage.waitForTimeout(2000);

    // Navigate back to same session
    await phonePage.click(`[data-test="session-${sessionId}"]`);

    const messagesAfter = await phonePage.locator('[data-test="chat-message"]').count();

    expect(messagesAfter).toBe(messagesBefore);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ISSUE-757: Memory Recall (No Hard Caps)
  // ─────────────────────────────────────────────────────────────────────────

  test('ISSUE-757: Agent can recall decision from conversation 80 sessions old', async () => {
    // Phone: Create 100 conversations, with decision in the oldest
    await phonePage.goto('http://localhost:4242?module=boardroom');

    // Conversation 1: record a decision
    await phonePage.click('button:has-text("New Conversation")');
    await phonePage.fill('[data-test="chat-input"]', 'My artist name is Luna Synthwave');
    await phonePage.click('button:has-text("Send")');

    const firstSessionId = await phonePage.inputValue('[data-test="session-id"]');

    // Create 99 more conversations to push the first one off the 50-cap
    for (let i = 1; i < 100; i++) {
      await phonePage.click('button:has-text("New Conversation")');
      await phonePage.fill('[data-test="chat-input"]', `Conversation ${i}`);
      await phonePage.click('button:has-text("Send")');
    }

    await phonePage.waitForTimeout(5000); // Firestore sync

    // Go back to the old conversation
    await phonePage.click(`[data-test="session-${firstSessionId}"]`);

    // Ask agent to recall
    await phonePage.fill('[data-test="chat-input"]', 'What is my artist name?');
    await phonePage.click('button:has-text("Send")');

    // Agent should recall correctly (not just say "no record")
    const correctAnswer = await phonePage.waitForSelector(
      'text=/Luna Synthwave|artist name.*Synthwave/i',
      { timeout: 5000 }
    );

    expect(correctAnswer).toBeTruthy();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Integration: All Systems Together
  // ─────────────────────────────────────────────────────────────────────────

  test('Integration: Phone + iPad full workflow (notes + conversations + memory)', async () => {
    // Phone: Create a project with notes and conversations
    await phonePage.goto('http://localhost:4242');

    // Create a note
    await phonePage.goto('http://localhost:4242?module=notes');
    await phonePage.fill('input[placeholder*="Note"]', 'Project Plan');
    await phonePage.fill('textarea', 'Launch strategy: target Gen Z');
    await phonePage.click('button:has-text("Save")');

    // Start conversation with decision
    await phonePage.goto('http://localhost:4242?module=boardroom');
    await phonePage.click('button:has-text("New Conversation")');
    await phonePage.fill('[data-test="chat-input"]', 'Budget allocated: $50k');
    await phonePage.click('button:has-text("Send")');

    await phonePage.waitForTimeout(2000);

    // iPad: Load everything
    await ipadPage.goto('http://localhost:4242');

    // Should see the note
    await ipadPage.goto('http://localhost:4242?module=notes');
    const note = await ipadPage.waitForSelector('text=Project Plan', { timeout: 2000 });
    expect(note).toBeTruthy();

    // Should see the conversation
    await ipadPage.goto('http://localhost:4242?module=boardroom');
    const conversation = await ipadPage.waitForSelector('text=Budget allocated', { timeout: 2000 });
    expect(conversation).toBeTruthy();
  });
});
