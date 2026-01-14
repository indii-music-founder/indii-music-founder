
import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * AUDIO INTELLIGENCE UI PATH TEST
 * 
 * Verifies the full user journey:
 * 1. Upload audio file
 * 2. Analyze via Manager's Office (Creative Director)
 * 3. Generate Strategy via Marketing Department
 */

test.describe('Audio Intelligence UI Flow', () => {
    test.setTimeout(120000); // 2 minutes

    test.beforeEach(async ({ page, context }) => {
        await context.clearCookies();

        // Nuke storage before any script runs
        await page.addInitScript(() => {
            try {
                localStorage.clear();
                sessionStorage.clear();
            } catch (e) { }
        });

        // Monitor for 431 or other errors
        page.on('response', response => {
            if (response.status() >= 400) {
                console.log(`[Response Error] ${response.status()} ${response.url()}`);
            }
        });

        await page.goto('http://localhost:4242/');

        // Wait for connection
        await page.waitForTimeout(1000);

        // Mock user injection (Standard for this app)
        await page.evaluate(() => {
            const mockUser = {
                uid: 'maestro-user-id',
                email: 'maestro@example.com',
                displayName: 'Maestro Test User',
                emailVerified: true,
                isAnonymous: false,
                metadata: {},
                providerData: [],
                refreshToken: '',
                tenantId: null,
                delete: async () => { },
                getIdToken: async () => 'mock-token',
                getIdTokenResult: async () => ({ token: 'mock-token' } as any),
                reload: async () => { },
                toJSON: () => ({}),
                phoneNumber: null,
                photoURL: null
            };

            if ((window as any).useStore) {
                // @ts-expect-error - Mocking partial store state
                window.useStore.setState({
                    user: mockUser,
                    userProfile: {
                        id: 'maestro-user-id',
                        uid: 'maestro-user-id',
                        email: 'maestro@example.com',
                        role: 'admin',
                        onboardingStatus: 'completed'
                    },
                    authLoading: false,
                    isSidebarOpen: true,
                    // Clear heavy state
                    uploadedAudio: [],
                    uploadedImages: [],
                    generatedHistory: []
                });
            }
        });

        // Ensure sidebar is visible
        await page.waitForSelector('[data-testid="nav-item-creative"]', { timeout: 10000 });
    });

    test('performs full audio analysis and campaign generation', async ({ page }) => {
        // 1. Navigate to Creative Studio
        await page.locator('[data-testid="nav-item-creative"]').click();

        // 2. Upload Audio File (Simulate hidden input)
        const filePath = path.resolve(process.cwd(), 'sample-6s.mp3');

        // Note: The UI has a hidden file input or requires drag-and-drop.
        // We will trigger the upload logic directly via the hidden input if reachable, 
        // or simulate the store action if UI is tricky.
        // Let's try the standard input setFile approach.

        // Find the file input - usually hidden in buttons
        // In the Click Test, we used a mocked Javascript upload because locating the exact input was hard.
        // We will replicate that robust approach for stability.

        await page.evaluate(async () => {
            // Create a dummy file for the store since we can't easily drag-drop in headless without strict selectors
            // Actually, let's try to locate the real input first.
            // If not found, we fallback to store injection.
        });

        // Attempting real upload via 'Attach' button logic which usually reveals an input
        const fileInput = page.locator('input[type="file"]');
        if (await fileInput.count() > 0) {
            await fileInput.first().setInputFiles(filePath);
        } else {
            // Fallback: Inject via store
            console.log("Injecting audio file via store directly...");
            await page.evaluate(async () => {
                const response = await fetch('https://test-audio.com/sample.mp3'); // Mock or use data URI
                // We'll just mock the file object structure expected by the store
                const mockFile = {
                    id: 'sample-6s-id',
                    file: new File(['(binary)'], 'sample-6s.mp3', { type: 'audio/mpeg' }),
                    preview: 'data:audio/mpeg;base64,SUQzBAAAAAAA...',
                    type: 'music',
                    uploadStatus: 'completed',
                    timestamp: Date.now()
                };

                // @ts-expect-error - Store access
                window.useStore.getState().addUploadedAudio(mockFile);

                // MOCK Audio Intelligence Analysis to bypass Essentia/Gemini
                // @ts-expect-error - Dev exposure
                if (window.audioIntelligence) {
                    // @ts-expect-error - Mocking
                    window.audioIntelligence.analyze = async (file) => {
                        console.log("Mock Analysis called for", file.name);
                        return {
                            id: 'mock-analysis-id',
                            technical: { bpm: 120, key: 'C Major', duration: 180 },
                            semantic: {
                                mood: ['Energetic', 'Uplifting'],
                                genre: ['Pop', 'Electronic'],
                                instruments: ['Synth', 'Drums'],
                                visualImagery: { abstract: 'Neon lights', narrative: 'City night', lighting: 'Cyberpunk' },
                                marketingHooks: { keywords: ['Party', 'Summer'], oneLiner: 'The anthem of the summer' },
                                targetPrompts: { imagen: 'Cyberpunk city', veo: 'Flying through neon streets' }
                            },
                            analyzedAt: Date.now(),
                            modelVersion: 'mock-v1'
                        };
                    };
                }
            });
        }

        // Wait for asset to appear in gallery
        await page.waitForTimeout(2000);

        // 3. Navigate to Manager's Office (Brand Manager)
        await page.locator('[data-testid="nav-item-brand"]').click();

        // 4. Chat: Analyze Audio
        const chatInput = page.locator('[data-testid="command-bar-input-container"] textarea');
        await chatInput.click();
        await chatInput.fill('Analyze the uploaded audio track and generate a cover art concept for it.');
        await page.keyboard.press('Enter');

        // Wait for response - look for "BPM" or "Key"
        console.log("Waiting for analysis response...");
        await expect(page.locator('[data-testid="agent-message"]').last()).toContainText(/BPM|Key|Genre/i, { timeout: 45000 });

        // 5. Navigate to Marketing (via Agent Tools or Sidebar)
        // Let's use Sidebar
        await page.locator('[data-testid="nav-item-marketing"]').click();

        // 6. Chat: Generate Campaign
        const marketingInput = page.locator('[data-testid="command-bar-input-container"] textarea');
        await marketingInput.click();
        await marketingInput.fill('Create a campaign strategy based on the last uploaded track (sample-6s.mp3).');
        await page.keyboard.press('Enter');

        // Wait for response - look for campaign details
        console.log("Waiting for campaign strategy...");
        await expect(page.locator('[data-testid="agent-message"]').last()).toContainText(/Campaign|Strategy|Day 1|Social/i, { timeout: 45000 });

        console.log("Audio Intelligence UI Flow Complete");
    });
});
