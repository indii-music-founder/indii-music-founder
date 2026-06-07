import { test, expect } from './fixtures/auth';

/**
 * Road Manager (Touring) Module E2E Tests
 * Covers: module load, tour list, venue view, waypoint input, route initialization, stops table rendering, interactive edit modals, tab switching, and location gas station scans.
 */

test.describe('Road Manager Module', () => {
    const rawUrl = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:4242";
    const origin = rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;
    const corsHeaders = {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-version, X-HTTP-Session-Id, X-Goog-Api-Key, X-Goog-Api-Client, X-Firebase-Client",
    };

    test.beforeEach(async ({ authedPage: page }) => {
        // Mock generateItinerary Firebase function
        await page.route('**/generateItinerary', async route => {
            if (route.request().method() === "OPTIONS") {
                await route.fulfill({ status: 204, headers: corsHeaders });
                return;
            }
            await route.fulfill({
                status: 200,
                headers: corsHeaders,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: {
                        stops: [
                            {
                                date: '2026-06-08',
                                city: 'Austin, TX',
                                venue: "Antone's Nightclub",
                                activity: 'Show',
                                notes: 'Austin show'
                            },
                            {
                                date: '2026-06-09',
                                city: 'Houston, TX',
                                venue: 'White Oak Music Hall',
                                activity: 'Show',
                                notes: 'Houston show'
                            }
                        ],
                        totalDistanceMiles: 162
                    }
                }),
            });
        });

        // Mock checkLogistics Firebase function
        await page.route('**/checkLogistics', async route => {
            if (route.request().method() === "OPTIONS") {
                await route.fulfill({ status: 204, headers: corsHeaders });
                return;
            }
            await route.fulfill({
                status: 200,
                headers: corsHeaders,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: {
                        isFeasible: true,
                        issues: [],
                        suggestions: ['Looks good']
                    }
                }),
            });
        });

        // Mock findPlaces Firebase function
        await page.route('**/findPlaces', async route => {
            if (route.request().method() === "OPTIONS") {
                await route.fulfill({ status: 204, headers: corsHeaders });
                return;
            }
            await route.fulfill({
                status: 200,
                headers: corsHeaders,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: {
                        places: [
                            {
                                name: 'E2E Gas Station A',
                                vicinity: '123 Main St, Dallas, TX',
                                geometry: {
                                    location: { lat: 32.7767, lng: -96.7970 }
                                },
                                isOpen: true
                            },
                            {
                                name: 'E2E Gas Station B',
                                vicinity: '456 Oak Rd, Dallas, TX',
                                geometry: {
                                    location: { lat: 32.7801, lng: -96.8001 }
                                },
                                isOpen: false
                            }
                        ]
                    }
                }),
            });
        });

        await page.goto('/');
        await page.waitForSelector('#root', { timeout: 15_000 });
        await page.waitForTimeout(2_000);

        const nav = page.locator('[data-testid="nav-item-road"]');
        await nav.waitFor({ state: 'visible', timeout: 15_000 });
        await nav.click();
        await page.waitForTimeout(2_000);
    });

    test('navigates to road manager module and displays components', async ({ authedPage: page }) => {
        await expect(page.locator('text=Tour Parameters')).toBeVisible({ timeout: 15_000 });
    });

    test('verifies touring planning tab flow: initializes route, runs logistics check and edits stops', async ({ authedPage: page }) => {
        // Fill dates
        await page.locator('#startDate').fill('2026-06-08');
        await page.locator('#endDate').fill('2026-06-12');

        // Add Austin, TX waypoint
        const waypointsInput = page.locator('#newLocation');
        await waypointsInput.fill('Austin, TX');
        await page.getByRole('button', { name: 'Add location' }).click();
        await expect(page.locator('text=Austin, TX')).toBeVisible({ timeout: 5_000 });

        // Add Houston, TX waypoint
        await waypointsInput.fill('Houston, TX');
        await waypointsInput.press('Enter');
        await expect(page.locator('text=Houston, TX')).toBeVisible({ timeout: 5_000 });

        // Click Initialize Route
        await page.getByRole('button', { name: 'Initialize Route' }).click();

        // Expect Generated Itinerary table to load
        await expect(page.locator('text=Generated Itinerary')).toBeVisible({ timeout: 15_000 });
        await expect(page.locator('text=Austin, TX')).toBeVisible();
        await expect(page.locator("text=Antone's Nightclub")).toBeVisible();

        // Run Logistics Check
        const logisticsBtn = page.getByRole('button', { name: 'Run Logistics Check' });
        await logisticsBtn.click();
        await expect(page.getByRole('button', { name: 'Logistics Verified' })).toBeVisible({ timeout: 10_000 });

        // Open edit logistics modal
        await page.getByRole('button', { name: 'Edit' }).first().click();
        await expect(page.locator('text=Edit Logistics')).toBeVisible({ timeout: 5_000 });

        // Modify venue
        const editVenueInput = page.locator('#editVenue');
        await editVenueInput.fill('Mohawk Austin');
        await page.getByRole('button', { name: 'Save Changes' }).click();

        // Check that table displays modified venue
        await expect(page.locator('text=Mohawk Austin')).toBeVisible({ timeout: 5_000 });
    });

    test('verifies on the road tab: switches tabs and scans nearby gas stations', async ({ authedPage: page }) => {
        // Switch tab to On The Road
        await page.getByRole('button').filter({ hasText: 'On The Road' }).click();
        await expect(page.locator('text=Command Center')).toBeVisible({ timeout: 10_000 });

        // Enter current location
        const locationInput = page.getByPlaceholder('Current City, State or coordinates (e.g. Austin, TX)');
        await locationInput.fill('Dallas, TX');

        // Scan gas stations
        const scanBtn = locationInput.locator('..').locator('button').nth(1);
        await scanBtn.click();

        // Verify nearby places are rendered in list
        await expect(page.locator('text=E2E Gas Station A')).toBeVisible({ timeout: 10_000 });
        await expect(page.locator('text=E2E Gas Station B')).toBeVisible({ timeout: 10_000 });
    });
});
