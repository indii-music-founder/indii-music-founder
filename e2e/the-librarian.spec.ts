import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5173';
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
        // 0. Mock Electron API to prevent crashes and simulation
        await page.addInitScript(() => {
            window.electronAPI = {
                getPlatform: async () => 'darwin',
                getAppVersion: async () => '0.0.0',
                auth: {
                    login: async () => { },
                    logout: async () => { },
                    onUserUpdate: (cb) => {
                        cb({ idToken: 'mock-token', accessToken: 'mock-access' });
                        return () => { };
                    }
                },
                audio: { analyze: async () => ({}), getMetadata: async () => ({}) },
                openExternal: async () => { }
            };
        });

        // 1. Load App
        console.log(`[Librarian] Target Secret: ${SECRET_CODE}`);
        await page.goto(BASE_URL);
        await page.waitForLoadState('domcontentloaded');

        // 2. Bypass Auth via Store Injection
        await page.evaluate(() => {
            // @ts-ignore
            if (window.useStore) {
                // @ts-ignore
                window.useStore.setState({
                    isAuthenticated: true,
                    isAuthReady: true,
                    currentModule: 'dashboard',
                    user: { uid: 'test-user', email: 'test@example.com', displayName: 'Test User' },
                    userProfile: { bio: 'Verified Tester', role: 'admin' }, // Prevent onboarding redirect
                    organizations: [{ id: 'org-1', name: 'Test Org', members: ['me'] }],
                    currentOrganizationId: 'org-1'
                });
            }
        });

        // Wait for Dashboard to render (look for "Recent Projects" or similar)
        await expect(page.getByText('Recent Projects')).toBeVisible({ timeout: 10000 });

        // 3. Upload Document to Knowledge Base
        // Dashboard.tsx: <input type="file" ... onChange={handleFileUpload} /> in the dashed border area
        const fileInput = page.locator('input[type="file"]').first();
        await expect(fileInput).toBeAttached();

        console.log('[Librarian] Uploading Manifesto...');

        // Setup Dialog Handler for "Added ... to Knowledge Base!" alert
        page.on('dialog', async dialog => {
            console.log(`[Librarian] Alert: ${dialog.message()}`);
            await dialog.accept();
        });

        await fileInput.setInputFiles(FILE_PATH);

        // Wait for processing simulation (Client side logs, toast, etc.)
        // Ideally we wait for a toast "Added ..."
        // For now, static wait to allow async processing in React
        await page.waitForTimeout(8000);

        // 4. Interrogation Loop (Polling for Indexing)
        // Use the Global Command Bar
        const agentInput = page.getByPlaceholder(/Describe your task/i);
        await expect(agentInput).toBeVisible();

        const maxAttempts = 3; // Reduced retry count for cleaner logs
        let success = false;

        for (let i = 0; i < maxAttempts; i++) {
            console.log(`[Librarian] Interrogation Attempt ${i + 1}/${maxAttempts}`);

            await agentInput.fill(`What is the secret code in the Librarian Protocol manifesto?`);
            await page.keyboard.press('Enter');

            // Wait for Chat Overlay and Response
            // ChatOverlay should open automatically on submit
            const chatOverlay = page.getByTestId('agent-message').first();
            await expect(chatOverlay).toBeVisible({ timeout: 10000 });

            // Wait for generation to complete (streaming indicator gone?)
            // We just wait for the text to appear in last message
            await page.waitForTimeout(8000);

            const lastResponse = page.getByTestId('agent-message').last();
            const responseText = await lastResponse.innerText();
            console.log(`[Librarian] Agent replied: "${responseText.substring(0, 100)}..."`);

            if (responseText.includes(SECRET_CODE)) {
                console.log('[Librarian] SUCCESS: Secret Code retrieved!');
                success = true;
                break;
            } else {
                console.log('[Librarian] Secret not found yet. Retrying...');
                // Close/Clean or just ask again? 
                // Just asking again appends to history.
                await page.waitForTimeout(5000);
            }
        }

        expect(success, `Agent failed to retrieve secret code: ${SECRET_CODE}`).toBeTruthy();
    });
});
