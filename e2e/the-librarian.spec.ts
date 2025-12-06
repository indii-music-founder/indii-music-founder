import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://architexture-ai-studio.web.app';
const TEST_TIMESTAMP = Date.now();
const SECRET_CODE = `OMEGA-${TEST_TIMESTAMP}`;
const MANIFESTO_CONTENT = `
CONFIDENTIAL MANIFESTO
Title: The Librarian Protocol
Date: ${new Date().toISOString()}

The secret code for the Librarian protocol is ${SECRET_CODE}.
This document confirms that the RAG pipeline is operational and can ingest, index, and retrieve real-world data.
`;

const FILE_NAME = `librarian-manifesto-${TEST_TIMESTAMP}.txt`;
// Use process.cwd() for ESM compatibility or fix path resolution
const FILE_PATH = path.join(process.cwd(), 'e2e', 'temp_artifacts', FILE_NAME);

test.describe('The Librarian: RAG Pipeline Verification', () => {
    // RAG Ingestion and Cold Start can be slow. Give it 2 minutes.
    test.setTimeout(120000);

    test.beforeAll(async () => {
        // Create the test file locally
        if (!fs.existsSync(path.dirname(FILE_PATH))) {
            fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
        }
        fs.writeFileSync(FILE_PATH, MANIFESTO_CONTENT);
    });

    test.afterAll(async () => {
        // Cleanup
        if (fs.existsSync(FILE_PATH)) {
            fs.unlinkSync(FILE_PATH);
        }
    });

    test('Ingest, Index, and Retrieve Real Data', async ({ page }) => {
        // 1. Login / Land on Dashboard
        console.log(`[Librarian] Target Secret: ${SECRET_CODE}`);
        await page.goto(BASE_URL);
        await page.waitForLoadState('domcontentloaded');

        // Handle "Get Started" if present (Auth flow)
        const getStartedBtn = page.getByRole('button', { name: /get started|launch|sign in/i });
        if (await getStartedBtn.isVisible()) {
            await getStartedBtn.click();
        }

        // 2. Upload Document to Knowledge Base
        // Locate the file input in the Knowledge Base section
        // Based on Dashboard.tsx: "Upload Knowledge Assets"
        const fileInput = page.locator('input[type="file"]').first();
        await expect(fileInput).toBeAttached();

        console.log('[Librarian] Uploading Manifesto...');
        await fileInput.setInputFiles(FILE_PATH);

        // Handle potential alert/toast confirmation
        // Dashboard.tsx says: alert(`Added ${processed.title} to Knowledge Base!`);
        // We need to handle the dialog
        page.on('dialog', async dialog => {
            console.log(`[Librarian] Alert: ${dialog.message()}`);
            await dialog.accept();
        });

        // Wait a bit for the "Simulated" or "Real" processing to kick off
        await page.waitForTimeout(5000);

        // 3. Navigate to an Agent (Creative Studio)
        console.log('[Librarian] Navigating to Creative Agent...');
        await page.goto(`${BASE_URL}/creative`);
        await page.waitForLoadState('domcontentloaded');

        // 4. Interrogation Loop (Polling for Indexing)
        // RAG indexing is async. It might take 10s or 60s. We will retry.
        const maxAttempts = 5;
        let success = false;

        const agentInput = page.getByPlaceholder(/describe your creative task/i);
        await expect(agentInput).toBeVisible();

        for (let i = 0; i < maxAttempts; i++) {
            console.log(`[Librarian] Interrogation Attempt ${i + 1}/${maxAttempts}`);

            await agentInput.fill(`What is the secret code in the Librarian Protocol manifesto?`);
            await page.keyboard.press('Enter');

            // Wait for response bubble
            // Logic: Wait for a new message bubble that appears AFTER our question
            await page.waitForTimeout(5000); // Wait for generation

            // Check last response
            const lastResponse = page.getByTestId('agent-message').last();
            await expect(lastResponse).toBeVisible({ timeout: 60000 }); // Wait up to 60s for response


            const responseText = await lastResponse.innerText();

            console.log(`[Librarian] Agent replied: "${responseText.substring(0, 50)}..."`);

            if (responseText.includes(SECRET_CODE)) {
                console.log('[Librarian] SUCCESS: Secret Code retrieved!');
                success = true;
                break;
            } else {
                console.log('[Librarian] Secret not found yet. waiting...');
                await page.waitForTimeout(10000); // Wait 10s before retry to let indexing finish
            }
        }

        expect(success, 'Agent failed to retrieve secret code after multiple attempts').toBeTruthy();
    });

});
